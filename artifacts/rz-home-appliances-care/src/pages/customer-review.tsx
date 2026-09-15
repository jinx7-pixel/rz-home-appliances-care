import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getAuthMeQueryKey,
  getGetCustomerReviewEligibleQueryKey,
  getGetCustomerReviewTargetQueryKey,
  type CustomerReviewInput,
  useAuthMe,
  useCreateCustomerReview,
  useGetCustomerReviewEligible,
  useGetCustomerReviewTarget,
} from '@workspace/api-client-react';
import { ArrowLeft, CheckCircle2, House, LoaderCircle, ShieldCheck, Star } from 'lucide-react';
import { useLocation } from 'wouter';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

function readReviewIdentifiers(location: string): {
  requestId?: string;
  bookingId?: string;
} {
  const browserSearch =
    typeof window !== 'undefined' ? window.location.search : '';
  const locationSearch = location.split('?')[1] ?? '';
  const search = browserSearch || (locationSearch ? `?${locationSearch}` : '');
  const params = new URLSearchParams(search);
  let requestId = params.get('requestId') ?? undefined;
  let bookingId = params.get('bookingId') ?? undefined;

  const pathname =
    typeof window !== 'undefined'
      ? window.location.pathname
      : location.split('?')[0];
  const routeMatch = pathname.match(
    /\/customer\/review\/(request|booking)\/([^/?#]+)/,
  );
  if (!requestId && !bookingId && routeMatch) {
    const sourceId = decodeURIComponent(routeMatch[2]);
    if (routeMatch[1] === 'request') requestId = sourceId;
    if (routeMatch[1] === 'booking') bookingId = sourceId;
  }

  return { requestId, bookingId };
}

function BrandMark() {
  return (
    <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white">
      <House className="size-5" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-2.5 text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

export function CustomerReviewPage() {
  const [location, setLocation] = useLocation();
  const { requestId, bookingId } = useMemo(
    () => readReviewIdentifiers(location),
    [location],
  );
  const targetParams = useMemo(() => ({ ...(requestId ? { requestId } : {}), ...(bookingId ? { bookingId } : {}) }), [bookingId, requestId]);
  const auth = useAuthMe({ query: { queryKey: getAuthMeQueryKey(), retry: false } });
  const eligible = useGetCustomerReviewEligible({ query: { queryKey: getGetCustomerReviewEligibleQueryKey(), enabled: auth.data?.authenticated === true, retry: false } });
  const target = useGetCustomerReviewTarget(targetParams, {
    query: { queryKey: getGetCustomerReviewTargetQueryKey(targetParams), enabled: auth.data?.authenticated === true && Boolean(requestId || bookingId), retry: false },
  });
  const createReview = useCreateCustomerReview();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [showFirstName, setShowFirstName] = useState(false);
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if ((auth.isSuccess && !auth.data.authenticated) || errorStatus(auth.error) === 401) setLocation('/sign-in');
  }, [auth.data, auth.error, auth.isSuccess, setLocation]);

  useEffect(() => {
    if (target.data?.existingReview) {
      setRating(target.data.existingReview.rating);
      setMessage(target.data.existingReview.reviewMessage);
      setShowFirstName(target.data.existingReview.showFirstName);
    }
  }, [target.data?.existingReview]);

  const eligibleTarget = eligible.data?.find((item) => item.sourceId === (requestId ?? bookingId));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation('');
    if (!rating) return setValidation('Choose a rating from 1 to 5 stars.');
    if (message.trim().length < 10) return setValidation('Your review must be at least 10 characters.');
    if (message.trim().length > 1000) return setValidation('Your review must be 1000 characters or fewer.');
    if (!requestId && !bookingId) return setValidation('Open this page from a completed repair or booking.');
    const data: CustomerReviewInput = { requestId: requestId ?? null, bookingId: bookingId ?? null, rating, reviewMessage: message.trim(), showFirstName };
    createReview.mutate({ data }, {
      onSuccess: () => setNotice('Thank you for your feedback. Your review has been submitted for approval.'),
      onError: (error) => {
        if (errorStatus(error) === 401) setLocation('/sign-in');
        else setValidation(errorMessage(error, 'We could not submit your review. Please try again.'));
      },
    });
  };

  const busy = auth.isPending || (Boolean(requestId || bookingId) && target.isPending);
  const existing = target.data?.existingReview ?? (eligibleTarget?.reviewSubmitted ? { status: eligibleTarget.reviewStatus } : null);

  if (auth.isPending || busy) {
    return <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-8"><div className="mx-auto max-w-[760px] animate-pulse"><div className="h-12 w-64 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="mt-16 h-10 w-80 rounded-xl bg-[hsl(210_36%_93%)]" /><div className="mt-6 h-72 rounded-[2rem] bg-[hsl(210_36%_93%)]" /></div></main>;
  }

  if (auth.isError && errorStatus(auth.error) !== 401) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_98%)] px-5"><div className="max-w-md rounded-[1.6rem] border border-red-200 bg-red-50 p-7 text-red-800"><h1 className="text-2xl font-extrabold">We could not verify your account.</h1><p className="mt-3 text-sm leading-6">{errorMessage(auth.error, 'Please try again.')}</p><button className="mt-6 min-h-11 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-sm font-extrabold text-white" data-testid="button-retry-review-auth" onClick={() => void auth.refetch()} type="button">Try again</button></div></main>;
  }

  const appliance = target.data?.applianceType ?? eligibleTarget?.applianceType ?? 'Completed appliance service';
  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-[760px]">
        <header className="flex items-center justify-between border-b border-[hsl(215_35%_86%)] pb-6">
          <a aria-label="RZ Home Appliances Care home" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]" data-testid="link-review-home" href={appPath('/')}>
            <BrandMark /><span><span className="block text-[0.9rem] font-extrabold">RZ Home Appliances</span><span className="mt-0.5 block text-[0.61rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care customer portal</span></span>
          </a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[0.75rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" data-testid="link-back-dashboard" href={appPath('/customer-dashboard')}><ArrowLeft className="size-4" /> Dashboard</a>
        </header>
        <section className="pt-12 sm:pt-16">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">YOUR EXPERIENCE MATTERS</p>
          <h1 className="mt-3 text-[clamp(2.7rem,7vw,5rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">Tell us how it went.</h1>
          <p className="mt-5 max-w-[37rem] text-[0.98rem] leading-[1.7] text-[hsl(215_20%_45%)]">A few honest words help our local team keep the standard high and help neighbours know what to expect.</p>
        </section>
        <section className="mt-9 rounded-[2rem] border border-[hsl(215_35%_84%)] bg-[hsl(204_100%_99%)] p-6 shadow-[0_24px_58px_-42px_hsl(215_53%_23%/0.62)] sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-6">
            <div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_20%_52%)]">SERVICE COMPLETED</p><h2 className="mt-2 text-[1.35rem] font-extrabold tracking-[-0.04em]" data-testid="text-review-target">{appliance}</h2><p className="mt-1 text-[0.78rem] text-[hsl(215_20%_51%)]">{target.data?.sourceType === 'booking' ? 'Booking' : 'Repair request'} · {target.data?.sourceId ?? requestId ?? bookingId ?? 'Not specified'}</p></div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(151_55%_91%)] px-3 py-2 text-[0.69rem] font-extrabold text-[hsl(150_55%_28%)]"><CheckCircle2 className="size-4" /> Verified service</span>
          </div>
          {target.isError ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700" data-testid="text-review-target-error">{errorMessage(target.error, 'We could not load this completed service.')}</div> : existing || notice ? (
            <div className="mt-8 rounded-[1.35rem] bg-[hsl(199_82%_94%)] p-6" data-testid="status-review-submitted"><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_74%_36%)]">REVIEW RECEIVED</p><h2 className="mt-3 text-xl font-extrabold">{notice || 'You have already shared feedback for this service.'}</h2><p className="mt-3 text-sm leading-6 text-[hsl(215_32%_35%)]">Our team will review it before it appears publicly.</p></div>
          ) : (
            <form className="mt-7" onSubmit={submit}>
              <fieldset><legend className="text-[0.78rem] font-extrabold text-[hsl(215_32%_28%)]">How would you rate the service?</legend><div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rating from 1 to 5 stars">{[1, 2, 3, 4, 5].map((value) => <button aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} aria-checked={rating === value} className={`rounded-xl p-2 transition hover:bg-[hsl(42_90%_95%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] ${rating >= value ? 'text-[hsl(39_86%_55%)]' : 'text-[hsl(215_35%_80%)]'}`} data-testid={`button-rating-${value}`} key={value} onClick={() => setRating(value)} role="radio" type="button"><Star className="size-8 fill-current" /></button>)}</div></fieldset>
              <label className="mt-8 block text-[0.78rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="review-message">Your review</label>
              <textarea className="mt-3 min-h-44 w-full resize-y rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] p-4 text-[0.9rem] leading-[1.65] outline-none transition placeholder:text-[hsl(215_20%_60%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.22)]" data-testid="textarea-review-message" id="review-message" maxLength={1000} minLength={10} onChange={(event) => setMessage(event.target.value)} placeholder="What stood out about the visit?" required value={message} /><div className="mt-2 flex justify-between text-[0.68rem] text-[hsl(215_20%_53%)]"><span>10–1000 characters</span><span data-testid="text-review-character-count">{message.length}/1000</span></div>
              <label className="mt-6 flex items-start gap-3 text-[0.82rem] font-semibold text-[hsl(215_32%_28%)]"><input checked={showFirstName} className="mt-0.5 size-4 accent-[hsl(215_82%_38%)]" data-testid="checkbox-show-first-name" onChange={(event) => setShowFirstName(event.target.checked)} type="checkbox" /> <span>Show my first name with this review</span></label>
              {validation ? <p className="mt-5 rounded-xl bg-[hsl(4_72%_95%)] p-3 text-sm font-semibold text-[hsl(4_62%_40%)]" data-testid="text-review-validation" role="alert">{validation}</p> : null}
              <button className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.82rem] font-extrabold text-white shadow-[0_14px_24px_-18px_hsl(215_82%_30%)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" data-testid="button-submit-review" disabled={createReview.isPending} type="submit">{createReview.isPending ? <><LoaderCircle className="size-4 animate-spin" /> Sending feedback...</> : 'Submit review'}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}