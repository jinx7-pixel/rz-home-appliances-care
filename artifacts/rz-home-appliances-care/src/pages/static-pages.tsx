import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  House,
  LockKeyhole,
  Mail,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
import { useLocation } from 'wouter';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function BrandMark() {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]">
      <House className="size-5" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-2.5 text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="flex items-center justify-between gap-4 border-b border-[hsl(215_35%_86%)] pb-6">
          <a className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]" href={appPath('/')}>
            <BrandMark />
            <span>
              <span className="block text-[0.92rem] font-extrabold tracking-[-0.02em]">RZ Home Appliances</span>
              <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care</span>
            </span>
          </a>
          <a className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" href={appPath('/')}>
            <ArrowLeft className="size-4" /> Back to home
          </a>
        </header>
        {children}
      </div>
    </main>
  );
}

function FrontendOnlyNotice() {
  return (
    <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[hsl(199_82%_72%)] bg-[hsl(199_82%_94%)] p-4 text-[0.82rem] font-semibold leading-[1.6] text-[hsl(215_74%_28%)]">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[hsl(174_54%_40%)]" />
      <p>This is a frontend-only preview. The server, database, email, and account features are not connected in this edition.</p>
    </div>
  );
}

function Field({ label, type = 'text', placeholder, autoComplete }: { label: string; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <label className="grid gap-2 text-[0.84rem] font-extrabold text-[hsl(215_32%_28%)]">
      {label}
      <input autoComplete={autoComplete ?? (type === 'password' ? 'current-password' : undefined)} className="min-h-13 rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.92rem] font-medium outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]" placeholder={placeholder} type={type} />
    </label>
  );
}

export function AccountPage() {
  const [location] = useLocation();
  const [message, setMessage] = useState('');
  const isSignUp = location.includes('sign-up');
  const isForgot = location.includes('forgot-password');
  const isReset = location.includes('reset-password');
  const title = isSignUp ? 'Create your account' : isForgot ? 'Reset your password' : isReset ? 'Set a new password' : 'Welcome back';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('This form is ready for a future authentication provider, but no account data is sent or stored by this frontend-only edition.');
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-[620px] py-14 sm:py-20">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">RZ HOME APPLIANCES CARE</p>
        <h1 className="mt-4 text-[clamp(2.7rem,7vw,5rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">{title}</h1>
        <p className="mt-5 max-w-[38rem] text-[0.98rem] leading-[1.7] text-[hsl(215_20%_45%)]">
          {isForgot || isReset ? 'Password recovery will be available when an authentication provider is connected.' : 'Manage repair requests and bookings from one place.'}
        </p>
        <FrontendOnlyNotice />
        <form className="mt-8 grid gap-5 rounded-[1.8rem] border border-[hsl(215_35%_82%)] bg-white p-6 shadow-[0_24px_58px_-42px_hsl(215_53%_23%/0.62)] sm:p-8" onSubmit={submit}>
          {isSignUp ? <Field label="Full name" placeholder="Your name" /> : null}
          {!isReset ? <Field autoComplete="email" label="Email address" placeholder="you@example.com" type="email" /> : null}
          {!isForgot ? <Field autoComplete={isReset || isSignUp ? 'new-password' : 'current-password'} label={isReset ? 'New password' : 'Password'} placeholder="Enter a password" type="password" /> : null}
          {isSignUp || isReset ? <Field autoComplete="new-password" label="Confirm password" placeholder="Repeat your password" type="password" /> : null}
          {message ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[0.82rem] font-semibold leading-[1.6] text-amber-900" role="status">{message}</p> : null}
          <button className="inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" type="submit">
            {isForgot ? 'Request reset link' : isSignUp ? 'Create account' : isReset ? 'Reset password' : 'Sign in'}
            <ArrowRight className="size-4" />
          </button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.82rem] font-bold text-[hsl(215_74%_28%)]">
          <a href={appPath('/sign-in')}>Sign in</a>
          <a href={appPath('/sign-up')}>Create account</a>
          <a href={appPath('/forgot-password')}>Forgot password?</a>
        </div>
      </section>
    </PageShell>
  );
}

export function BookingPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('Your booking details were captured in this preview only. Call +91 80738 48334 or use WhatsApp to arrange a real visit.');
  };
  return (
    <PageShell>
      <section className="py-14 sm:py-20">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">SERVICE BOOKING</p>
        <h1 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">Book a repair visit.</h1>
        <p className="mt-5 max-w-[40rem] text-[1rem] leading-[1.7] text-[hsl(215_20%_45%)]">Choose a service and preferred time. This form demonstrates the customer experience without sending information anywhere.</p>
        <FrontendOnlyNotice />
        <form className="mt-9 grid gap-5 rounded-[1.8rem] border border-[hsl(215_35%_82%)] bg-white p-6 shadow-[0_24px_58px_-42px_hsl(215_53%_23%/0.62)] sm:grid-cols-2 sm:p-8" onSubmit={submit}>
          <Field label="Phone number" placeholder="10-digit phone number" type="tel" />
          <label className="grid gap-2 text-[0.84rem] font-extrabold text-[hsl(215_32%_28%)]">Appliance service<select className="min-h-13 rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 font-medium" defaultValue=""><option disabled value="">Choose a service</option><option>Washing Machine Repair</option><option>Refrigerator Repair</option><option>Micro Oven Repair</option><option>LED TV Repair</option></select></label>
          <Field label="Preferred date" type="date" />
          <Field label="Preferred time" placeholder="Morning or afternoon" />
          <label className="grid gap-2 text-[0.84rem] font-extrabold text-[hsl(215_32%_28%)] sm:col-span-2">Address<textarea className="min-h-28 rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] p-4 font-medium outline-none focus:border-[hsl(199_82%_52%)]" placeholder="House number, street, area, Bengaluru" /></label>
          {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[0.82rem] font-semibold leading-[1.6] text-emerald-900 sm:col-span-2" role="status">{message}</p> : null}
          <button className="inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] sm:col-span-2 sm:w-fit" type="submit">Preview booking request <ArrowRight className="size-4" /></button>
        </form>
      </section>
    </PageShell>
  );
}

type PublicReview = {
  reviewId: string;
  rating: number;
  reviewMessage: string;
  customerLabel: string;
  applianceType: string | null;
  isVerified: boolean;
  createdAt: string;
};

function ReviewCards({ reviews, dark = false }: { reviews: PublicReview[]; dark?: boolean }) {
  return (
    <div className={`grid gap-5 ${dark ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>
      {reviews.map((review) => (
        <article className={`rounded-[1.7rem] border p-6 shadow-[0_18px_48px_-38px_hsl(215_53%_23%/0.5)] sm:p-7 ${dark ? 'flex min-h-[16rem] flex-col border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] shadow-none' : 'bg-white border-[hsl(215_35%_86%)]'}`} key={review.reviewId}>
          <div className="flex items-center justify-between gap-4">
            <span aria-label={`${review.rating} out of 5 stars`} className="flex gap-1 text-[hsl(39_92%_53%)]">
              {[1, 2, 3, 4, 5].map((star) => <Star className={`size-4 ${star <= review.rating ? 'fill-current' : ''}`} key={star} />)}
            </span>
            {review.isVerified ? <span className={`text-[0.64rem] font-extrabold uppercase tracking-[0.08em] ${dark ? 'text-[hsl(174_54%_76%)]' : 'text-[hsl(150_55%_28%)]'}`}>Verified service</span> : null}
          </div>
          <blockquote className={`mt-6 text-[1.05rem] font-semibold leading-[1.65] ${dark ? 'text-white' : ''}`}>“{review.reviewMessage}”</blockquote>
          <footer className={`mt-7 border-t pt-5 text-[0.76rem] font-bold ${dark ? 'mt-auto border-[hsl(215_25%_30%)] text-[hsl(215_24%_72%)]' : 'border-[hsl(215_35%_91%)] text-[hsl(215_20%_48%)]'}`}>
            <span className={dark ? 'text-[hsl(184_85%_72%)]' : 'text-[hsl(215_74%_28%)]'}>{review.customerLabel}</span> · {review.applianceType ?? 'Appliance service'}
          </footer>
        </article>
      ))}
    </div>
  );
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reviews?limit=100', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load reviews.');
        if (!cancelled) setReviews(body);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load reviews.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell>
      <section className="py-14 sm:py-20">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">REAL WORDS FROM REAL HOMES</p>
        <h1 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.075em] text-[hsl(215_74%_28%)]">What Our Customers Say</h1>
        <p className="mt-5 max-w-[38rem] text-[0.98rem] leading-[1.75] text-[hsl(215_20%_45%)]">Reviews from customers whose completed service has been approved by our team.</p>
        {error ? <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}
        {isLoading ? <p className="mt-12 rounded-2xl border border-[hsl(215_35%_86%)] bg-white p-8 text-center font-semibold text-[hsl(215_20%_48%)]">Loading approved reviews…</p> : null}
        {!isLoading && !error && reviews.length === 0 ? <p className="mt-12 rounded-2xl border border-dashed border-[hsl(215_35%_78%)] bg-white p-10 text-center font-semibold text-[hsl(215_20%_48%)]">No approved reviews yet. Check back after your service.</p> : null}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {!isLoading && !error ? <ReviewCards reviews={reviews} /> : null}
        </div>
      </section>
    </PageShell>
  );
}

export function ReviewPage() {
  const [location] = useLocation();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [showFirstName, setShowFirstName] = useState(true);
  const [target, setTarget] = useState<{ sourceType: 'repair_request' | 'booking'; sourceId: string; applianceType: string; existingReview: PublicReview & { status: string } | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  const requestId = params.get('requestId');
  const bookingId = params.get('bookingId');

  useEffect(() => {
    const query = new URLSearchParams();
    if (token) query.set('token', token);
    if (requestId) query.set('requestId', requestId);
    if (bookingId) query.set('bookingId', bookingId);
    let cancelled = false;
    fetch(`/api/customer/review-target?${query.toString()}`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'This review link is invalid or expired.');
        if (!cancelled) {
          setTarget(body);
          if (body.existingReview) {
            setRating(body.existingReview.rating);
            setMessage(body.existingReview.reviewMessage);
            setShowFirstName(body.existingReview.showFirstName);
          }
        }
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'This review link is invalid or expired.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [location, token, requestId, bookingId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rating === 0 || message.trim().length < 10) {
      setError('Choose a rating and write at least 10 characters.');
      return;
    }
    if (!target) return;
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/customer/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          requestId: token ? undefined : requestId,
          bookingId: token ? undefined : bookingId,
          rating,
          reviewMessage: message.trim(),
          showFirstName,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not submit your review.');
      setNotice('Thank you. Your review was submitted and is waiting for moderation before it appears publicly.');
      setTarget((current) => current ? { ...current, existingReview: { ...body, customerLabel: showFirstName ? 'You' : 'Your review', isVerified: true, createdAt: body.createdAt } } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your review.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <PageShell>
      <section className="mx-auto max-w-[760px] py-14 sm:py-20">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">YOUR EXPERIENCE MATTERS</p>
        <h1 className="mt-4 text-[clamp(2.7rem,7vw,5rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">Tell us how it went.</h1>
        <p className="mt-5 max-w-[37rem] text-[0.98rem] leading-[1.7] text-[hsl(215_20%_45%)]">Share a few honest words about your completed {target?.applianceType ?? 'appliance'} service.</p>
        {isLoading ? <p className="mt-8 rounded-2xl border border-[hsl(215_35%_86%)] bg-white p-6 font-semibold">Checking your secure review link…</p> : null}
        {error ? <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900" role="alert">{error}</p> : null}
        {target?.existingReview ? <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900" role="status">A review has already been submitted for this service ({target.existingReview.status}). Thank you for your feedback.</p> : null}
        {notice ? <p className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900" role="status">{notice}</p> : null}
        {target && !target.existingReview && !notice ? <form className="mt-9 rounded-[2rem] border border-[hsl(215_35%_84%)] bg-white p-6 shadow-[0_24px_58px_-42px_hsl(215_53%_23%/0.62)] sm:p-9" onSubmit={submit}>
          <p className="text-[0.78rem] font-extrabold">How would you rate the service?</p>
          <div className="mt-3 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button aria-label={`${value} stars`} className={`rounded-xl p-2 ${rating >= value ? 'text-[hsl(39_86%_55%)]' : 'text-[hsl(215_35%_80%)]'}`} key={value} onClick={() => setRating(value)} type="button"><Star className="size-8 fill-current" /></button>)}</div>
          <label className="mt-8 block text-[0.78rem] font-extrabold" htmlFor="review-message">Your review</label>
          <textarea className="mt-3 min-h-44 w-full resize-y rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] p-4 text-[0.9rem] leading-[1.65] outline-none focus:border-[hsl(199_82%_52%)]" id="review-message" minLength={10} onChange={(event) => setMessage(event.target.value)} placeholder="What stood out about the visit?" required value={message} />
           <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input checked={showFirstName} onChange={(event) => setShowFirstName(event.target.checked)} type="checkbox" /> Show my first name on the public review</label>
           <button className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.82rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] disabled:cursor-wait disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Submitting…' : 'Submit review'} <ArrowRight className="size-4" /></button>
        </form> : null}
      </section>
    </PageShell>
  );
}

type AdminReview = {
  reviewId: string;
  customerName: string;
  customerEmail: string;
  sourceType: 'repair_request' | 'booking';
  sourceId: string;
  applianceType: string;
  relatedStatus: string;
  relatedDate: string | null;
  relatedTime: string | null;
  relatedAddress: string | null;
  relatedProblemDescription: string | null;
  rating: number;
  reviewMessage: string;
  showFirstName: boolean;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

function AdminReviewsPanel({ onLogout }: { onLogout: () => void }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadReviews = async () => {
    setIsLoading(true);
    setError('');
    const query = new URLSearchParams({ sort });
    if (search.trim()) query.set('search', search.trim());
    if (status) query.set('status', status);
    if (rating) query.set('rating', rating);
    try {
      const response = await fetch(`/api/admin/reviews?${query.toString()}`, { credentials: 'include', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load reviews.');
      setReviews(body);
      setNotes(Object.fromEntries((body as AdminReview[]).map((review) => [review.reviewId, review.adminNotes ?? ''])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load reviews.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [status, rating, sort]);

  const updateReview = async (reviewId: string, values: { status?: string; adminNotes?: string | null }) => {
    setUpdatingId(reviewId);
    setError('');
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not update review.');
      setReviews((current) => current.map((review) => review.reviewId === reviewId ? body : review));
      setNotes((current) => ({ ...current, [reviewId]: body.adminNotes ?? '' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update review.');
    } finally {
      setUpdatingId('');
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    setUpdatingId(reviewId);
    setError('');
    try {
      const response = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Could not delete review.');
      }
      setReviews((current) => current.filter((review) => review.reviewId !== reviewId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete review.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <section className="mt-12" aria-labelledby="admin-reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">CUSTOMER FEEDBACK</p>
          <h1 className="mt-3 text-[clamp(2.7rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.08em] text-[hsl(215_74%_28%)]" id="admin-reviews-heading">Review moderation.</h1>
          <p className="mt-5 max-w-[40rem] text-[1rem] leading-[1.7] text-[hsl(215_20%_45%)]">Review customer feedback, keep internal notes, and decide what appears publicly.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-xs font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" href={appPath('/admin/dashboard')}><ArrowLeft className="size-4" /> Dashboard</a>
          <button className="inline-flex min-h-10 items-center rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-xs font-extrabold text-[hsl(215_74%_28%)] disabled:opacity-60" disabled={isLoading} onClick={() => void loadReviews()} type="button"><RefreshCw className={`mr-2 size-4 ${isLoading ? 'animate-spin' : ''}`} /> {isLoading ? 'Refreshing…' : 'Refresh'}</button>
          <button className="inline-flex min-h-10 items-center rounded-xl bg-[hsl(215_82%_38%)] px-4 text-xs font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" onClick={onLogout} type="button">Sign out</button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl border border-[hsl(215_35%_86%)] bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input aria-label="Search reviews" className="min-h-10 rounded-xl border border-[hsl(215_35%_82%)] px-3 text-sm" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadReviews(); }} placeholder="Search customer, email, review ID…" value={search} />
        <select aria-label="Filter review status" className="min-h-10 rounded-xl border border-[hsl(215_35%_82%)] px-3 text-sm" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="hidden">Hidden</option><option value="rejected">Rejected</option></select>
        <select aria-label="Filter review rating" className="min-h-10 rounded-xl border border-[hsl(215_35%_82%)] px-3 text-sm" onChange={(event) => setRating(event.target.value)} value={rating}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select>
        <select aria-label="Sort reviews" className="min-h-10 rounded-xl border border-[hsl(215_35%_82%)] px-3 text-sm" onChange={(event) => setSort(event.target.value)} value={sort}><option value="newest">Newest</option><option value="oldest">Oldest</option></select>
      </div>
      {isLoading ? <p className="mt-5 rounded-2xl border border-[hsl(215_35%_86%)] bg-white p-6 text-sm font-semibold text-[hsl(215_20%_48%)]" role="status">Loading reviews…</p> : null}
      {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}
      {!isLoading && !error && reviews.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-[hsl(215_35%_78%)] bg-white p-8 text-center text-sm font-semibold text-[hsl(215_20%_48%)]">No reviews match these filters.</p> : null}
      <div className="mt-5 grid gap-4">
        {reviews.map((review) => (
          <article className="rounded-[1.5rem] border border-[hsl(215_35%_84%)] bg-white p-5 shadow-[0_18px_48px_-38px_hsl(215_53%_23%/0.5)]" key={review.reviewId}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[hsl(188_75%_43%)]">{review.reviewId} · {review.sourceType === 'booking' ? 'Booking' : 'Repair request'} {review.sourceId}</p><h3 className="mt-2 text-lg font-extrabold text-[hsl(215_74%_28%)]">{review.customerName}</h3><p className="text-sm text-[hsl(215_20%_48%)]">{review.customerEmail} · {review.applianceType}</p></div>
              <label className="grid gap-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[hsl(215_20%_48%)]">Status<select aria-label={`Moderate ${review.reviewId}`} className="min-h-9 rounded-xl border border-[hsl(199_82%_72%)] bg-[hsl(199_82%_94%)] px-3 text-xs font-extrabold uppercase text-[hsl(215_74%_28%)]" disabled={updatingId === review.reviewId} onChange={(event) => void updateReview(review.reviewId, { status: event.target.value })} value={review.status}><option value="pending">Pending</option><option value="approved">Approve</option><option value="hidden">Hide</option><option value="rejected">Reject</option></select></label>
            </div>
            <div className="mt-4 flex gap-1 text-[hsl(39_92%_53%)]">{[1, 2, 3, 4, 5].map((star) => <Star className={`size-4 ${star <= review.rating ? 'fill-current' : ''}`} key={star} />)}</div>
            <blockquote className="mt-3 text-sm font-semibold leading-6">“{review.reviewMessage}”</blockquote>
            <details className="mt-4 rounded-xl bg-[hsl(210_40%_98%)] p-3 text-sm"><summary className="cursor-pointer font-extrabold text-[hsl(215_74%_28%)]">Service details</summary><div className="mt-3 grid gap-2 text-[hsl(215_20%_42%)] sm:grid-cols-2"><p>Status: {review.relatedStatus}</p><p>Date: {review.relatedDate ?? 'Not specified'}</p><p>Time: {review.relatedTime ?? 'Not specified'}</p><p>Address: {review.relatedAddress ?? 'Not available'}</p><p className="sm:col-span-2">Problem: {review.relatedProblemDescription ?? 'Not available'}</p></div></details>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-xs font-extrabold text-[hsl(215_20%_48%)]">Internal notes<textarea className="min-h-16 rounded-xl border border-[hsl(215_35%_82%)] p-3 text-sm font-medium text-[hsl(215_32%_14%)]" disabled={updatingId === review.reviewId} onChange={(event) => setNotes((current) => ({ ...current, [review.reviewId]: event.target.value }))} value={notes[review.reviewId] ?? ''} /></label><div className="flex gap-2"><button className="min-h-10 rounded-xl border border-[hsl(215_35%_82%)] px-3 text-xs font-extrabold text-[hsl(215_74%_28%)] disabled:opacity-50" disabled={updatingId === review.reviewId} onClick={() => void updateReview(review.reviewId, { adminNotes: notes[review.reviewId] ?? null })} type="button">{updatingId === review.reviewId ? 'Saving…' : 'Save notes'}</button><button className="min-h-10 rounded-xl border border-red-200 px-3 text-xs font-extrabold text-red-700 disabled:opacity-50" disabled={updatingId === review.reviewId} onClick={() => void deleteReview(review.reviewId)} type="button">{updatingId === review.reviewId ? 'Working…' : 'Delete'}</button></div></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdminPage() {
  const [location, setLocation] = useLocation();
  const isLoginPage = location === '/admin/login';
  const isReviewsPage = location === '/admin/reviews';
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(!isLoginPage);
  const [adminName, setAdminName] = useState('');
  const [requests, setRequests] = useState<AdminRepairRequest[]>([]);
  const [requestError, setRequestError] = useState('');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [updatingRequestId, setUpdatingRequestId] = useState('');
  const [websiteEnabled, setWebsiteEnabled] = useState(true);
  const [isUpdatingWebsite, setIsUpdatingWebsite] = useState(false);

  useEffect(() => {
    if (isLoginPage) {
      setIsCheckingSession(false);
      return;
    }

    let cancelled = false;
    setIsCheckingSession(true);

    const loadDashboard = async () => {
      try {
        const sessionResponse = await fetch('/api/admin/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });
        const session = await sessionResponse.json();
        if (!session.authenticated) {
          setLocation('/admin/login');
          return;
        }

        if (cancelled) return;
        setAdminName(session.admin?.displayName || session.admin?.username || 'Administrator');
        const siteStatusResponse = await fetch('/api/admin/site-status', {
          credentials: 'include',
          cache: 'no-store',
        });
        const siteStatus = await siteStatusResponse.json();
        if (!siteStatusResponse.ok) {
          throw new Error(siteStatus.error || 'Could not load website status.');
        }
        setWebsiteEnabled(siteStatus.enabled === true);
        if (!isReviewsPage) {
          setIsLoadingRequests(true);
          const requestsResponse = await fetch(
            '/api/admin/repair-requests?customerType=guest&sort=newest',
            { credentials: 'include', cache: 'no-store' },
          );
          const requestsBody = await requestsResponse.json();
          if (!requestsResponse.ok) {
            throw new Error(requestsBody.error || 'Could not load repair requests.');
          }
          if (!cancelled) {
            setRequests(requestsBody);
            setRequestError('');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setRequestError(error instanceof Error ? error.message : 'Could not load repair requests.');
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
          setIsLoadingRequests(false);
        }
      }
    };

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [isLoginPage, isReviewsPage, setLocation]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Invalid admin credentials.');
      }
      setLocation('/admin/dashboard');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Invalid admin credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const refreshRequests = async () => {
    setRequestError('');
    setIsLoadingRequests(true);
    try {
      const response = await fetch(
        '/api/admin/repair-requests?customerType=guest&sort=newest',
        { credentials: 'include', cache: 'no-store' },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Could not load repair requests.');
      }
      setRequests(body);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not load repair requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: AdminRepairStatus,
  ) => {
    setRequestError('');
    setUpdatingRequestId(requestId);
    try {
      const response = await fetch(
        `/api/admin/repair-requests/${encodeURIComponent(requestId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Could not update request status.');
      }
      setRequests((current) =>
        current.map((request) =>
          request.requestId === requestId
            ? { ...request, status: body.status }
            : request,
        ),
      );
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not update request status.');
    } finally {
      setUpdatingRequestId('');
    }
  };

  const updateWebsiteStatus = async (enabled: boolean) => {
    setIsUpdatingWebsite(true);
    setRequestError('');
    try {
      const response = await fetch('/api/admin/site-status', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Could not update website status.');
      }
      setWebsiteEnabled(body.enabled === true);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not update website status.');
    } finally {
      setIsUpdatingWebsite(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setLocation('/admin/login');
  };

  if (isLoginPage) {
    return (
      <PageShell>
        <section className="mx-auto max-w-[560px] py-14 sm:py-20">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">PRIVATE OPERATIONS</p>
          <h1 className="mt-4 text-[clamp(2.7rem,7vw,5rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">Admin sign in.</h1>
          <p className="mt-5 text-[0.98rem] leading-[1.7] text-[hsl(215_20%_45%)]">Sign in to view guest repair requests submitted from the public website.</p>
          <form className="mt-9 grid gap-5 rounded-[1.8rem] border border-[hsl(215_35%_82%)] bg-white p-6 shadow-[0_24px_58px_-42px_hsl(215_53%_23%/0.62)] sm:p-8" onSubmit={login}>
            <label className="grid gap-2 text-[0.84rem] font-extrabold text-[hsl(215_32%_28%)]">
              Username
              <input autoComplete="username" className="min-h-13 rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.92rem] font-medium outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]" onChange={(event) => setUsername(event.target.value)} value={username} />
            </label>
            <label className="grid gap-2 text-[0.84rem] font-extrabold text-[hsl(215_32%_28%)]">
              Password
              <input autoComplete="current-password" className="min-h-13 rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.92rem] font-medium outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>
            {loginError ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[0.82rem] font-semibold leading-[1.6] text-red-900" role="alert">{loginError}</p> : null}
            <button className="inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoggingIn} type="submit">
              {isLoggingIn ? 'Signing in…' : 'Sign in to dashboard'}
              <ArrowRight className="size-4" />
            </button>
          </form>
        </section>
      </PageShell>
    );
  }

  if (isCheckingSession) {
    return (
      <PageShell>
        <section className="py-20 text-center">
          <p className="font-extrabold text-[hsl(215_74%_28%)]">Checking administrator session…</p>
        </section>
      </PageShell>
    );
  }

  if (isReviewsPage) {
    return (
      <PageShell>
        <AdminReviewsPanel onLogout={() => void logout()} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="py-14 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">PRIVATE OPERATIONS</p>
            <h1 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.08em]">Repair requests.</h1>
            <p className="mt-5 max-w-[40rem] text-[1rem] leading-[1.7] text-[hsl(215_20%_45%)]">Welcome, {adminName}. Guest requests from the public contact form appear here.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)] disabled:opacity-60" disabled={isLoadingRequests} onClick={() => void refreshRequests()} type="button">
              <RefreshCw className={`size-4 ${isLoadingRequests ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" href={appPath('/admin/reviews')}>
              <MessageSquareQuote className="size-4" /> Reviews
            </a>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-[0.78rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" onClick={() => void logout()} type="button">
              Sign out
            </button>
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <article className="rounded-[1.5rem] border border-[hsl(215_35%_84%)] bg-white p-5"><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-[hsl(215_20%_48%)]">Guest requests</p><p className="mt-3 text-3xl font-extrabold text-[hsl(215_74%_28%)]">{requests.length}</p></article>
          <article className="rounded-[1.5rem] border border-[hsl(215_35%_84%)] bg-white p-5"><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-[hsl(215_20%_48%)]">Pending</p><p className="mt-3 text-3xl font-extrabold text-[hsl(215_74%_28%)]">{requests.filter((request) => request.status === 'pending').length}</p></article>
          <article className="rounded-[1.5rem] border border-[hsl(215_35%_84%)] bg-white p-5"><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-[hsl(215_20%_48%)]">Latest request</p><p className="mt-3 truncate text-lg font-extrabold text-[hsl(215_74%_28%)]">{requests[0]?.requestId || '—'}</p></article>
        </div>
        <section className={`mt-6 rounded-[1.5rem] border p-5 ${websiteEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-[0.7rem] font-extrabold uppercase tracking-[0.12em] ${websiteEnabled ? 'text-emerald-700' : 'text-red-700'}`}>Public website</p>
              <p className={`mt-2 text-lg font-extrabold ${websiteEnabled ? 'text-emerald-900' : 'text-red-900'}`}>
                {websiteEnabled ? 'Website is ON' : 'Website is OFF'}
              </p>
              <p className={`mt-1 text-sm leading-6 ${websiteEnabled ? 'text-emerald-800' : 'text-red-800'}`}>
                {websiteEnabled ? 'Customers can open the website and submit repair requests.' : 'Customers see an unavailable message. Admin access remains available.'}
              </p>
            </div>
            <button
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-[0.78rem] font-extrabold text-white disabled:cursor-wait disabled:opacity-60 ${websiteEnabled ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              disabled={isUpdatingWebsite}
              onClick={() => void updateWebsiteStatus(!websiteEnabled)}
              type="button"
            >
              {isUpdatingWebsite ? 'Updating…' : websiteEnabled ? 'Turn website off' : 'Turn website on'}
            </button>
          </div>
        </section>
        {requestError ? <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[0.82rem] font-semibold leading-[1.6] text-red-900" role="alert">{requestError}</p> : null}
        <div className="mt-10 grid gap-5">
          {requests.length === 0 && !isLoadingRequests ? (
            <div className="rounded-[1.7rem] border border-dashed border-[hsl(215_35%_78%)] bg-white p-10 text-center">
              <Wrench className="mx-auto size-8 text-[hsl(199_82%_43%)]" />
              <h2 className="mt-4 text-lg font-extrabold">No guest requests yet</h2>
              <p className="mt-2 text-sm leading-6 text-[hsl(215_20%_48%)]">New public repair requests will appear here after submission.</p>
            </div>
          ) : null}
          {requests.map((request) => (
            <article className="rounded-[1.7rem] border border-[hsl(215_35%_84%)] bg-white p-6 shadow-[0_18px_48px_-38px_hsl(215_53%_23%/0.5)] sm:p-7" key={request.requestId}>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_91%)] pb-5">
                <div>
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-[hsl(188_75%_43%)]">Request ID</p>
                  <h2 className="mt-2 text-xl font-extrabold text-[hsl(215_74%_28%)]">{request.requestId}</h2>
                </div>
                <label className="grid gap-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-[hsl(215_20%_48%)]">
                  Status
                  <select
                    aria-label={`Update status for ${request.requestId}`}
                    className="min-h-9 rounded-xl border border-[hsl(199_82%_72%)] bg-[hsl(199_82%_94%)] px-3 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-[hsl(215_74%_28%)] outline-none focus:ring-2 focus:ring-[hsl(199_82%_62%/0.35)] disabled:cursor-wait disabled:opacity-60"
                    disabled={updatingRequestId === request.requestId}
                    onChange={(event) => void updateRequestStatus(request.requestId, event.target.value as AdminRepairStatus)}
                    value={request.status}
                  >
                    <option value="pending">Pending</option>
                    <option value="contacted">Contacted</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 grid gap-5 text-[0.84rem] sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Customer</p><p className="mt-1 font-semibold">{request.customerName}</p></div>
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Phone</p><a className="mt-1 block font-semibold text-[hsl(215_74%_28%)] hover:underline" href={`tel:${request.phone}`}>{request.phone}</a></div>
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Email</p><a className="mt-1 block break-words font-semibold text-[hsl(215_74%_28%)] hover:underline" href={`mailto:${request.email}`}>{request.email}</a></div>
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Appliance</p><p className="mt-1 font-semibold">{request.applianceType}</p></div>
              </div>
              <div className="mt-5 grid gap-5 text-[0.84rem] sm:grid-cols-2">
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Problem</p><p className="mt-1 leading-6">{request.problemDescription}</p></div>
                <div><p className="font-extrabold text-[hsl(215_20%_48%)]">Address</p><p className="mt-1 leading-6">{request.address}</p></div>
              </div>
              <p className="mt-5 text-[0.72rem] font-semibold text-[hsl(215_20%_52%)]">Submitted {new Date(request.createdAt).toLocaleString('en-IN')}</p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

type AdminRepairRequest = {
  requestId: string;
  customerName: string;
  email: string;
  phone: string;
  applianceType: string;
  problemDescription: string;
  address: string;
  status: 'pending' | 'contacted' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
};

type AdminRepairStatus =
  | 'pending'
  | 'contacted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';