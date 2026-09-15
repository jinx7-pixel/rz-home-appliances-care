import { useEffect, useMemo, useState } from 'react';
import {
  getAdminAuthMeQueryKey,
  getGetAdminReviewQueryKey,
  getGetAdminReviewsQueryKey,
  ReviewStatus,
  type AdminReview,
  type GetAdminReviewsParams,
  type ReviewStatus as ReviewStatusValue,
  useAdminAuthMe,
  useAdminAuthLogout,
  useDeleteAdminReview,
  useGetAdminReview,
  useGetAdminReviews,
  useUpdateAdminReview,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, ChevronDown, FileText, Filter, House, LogOut, Menu, MessageSquareQuote, Search, ShieldCheck, Star, Trash2, X } from 'lucide-react';
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
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') return (data as { error: string }).error;
  }
  return fallback;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-[hsl(42_90%_92%)] text-[hsl(30_68%_34%)]',
    approved: 'bg-[hsl(151_55%_90%)] text-[hsl(150_55%_28%)]',
    rejected: 'bg-[hsl(4_72%_94%)] text-[hsl(4_62%_40%)]',
    hidden: 'bg-[hsl(210_36%_93%)] text-[hsl(215_32%_28%)]',
  };
  return map[status] ?? map.pending;
}

function BrandMark() {
  return <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white"><House className="size-5" /><span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]"><ShieldCheck className="size-2.5 text-[hsl(215_74%_28%)]" /></span></span>;
}

function Stars({ rating, large = false }: { rating: number; large?: boolean }) {
  return <span aria-label={`${rating} out of 5 stars`} className="inline-flex gap-0.5 text-[hsl(39_86%_55%)]" data-testid={`stars-${rating}`}>{[1, 2, 3, 4, 5].map((value) => <Star className={`${large ? 'size-5' : 'size-3.5'} ${value <= rating ? 'fill-current' : ''}`} key={value} />)}</span>;
}

export function AdminReviewsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const auth = useAdminAuthMe({ query: { queryKey: getAdminAuthMeQueryKey(), retry: false } });
  const authenticated = auth.data?.authenticated === true;
  const logout = useAdminAuthLogout();
  const update = useUpdateAdminReview();
  const remove = useDeleteAdminReview();
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [status, setStatus] = useState<ReviewStatusValue | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const params = useMemo<GetAdminReviewsParams>(() => ({ search: search.trim() || undefined, rating: rating === 'all' ? undefined : Number(rating), status: status === 'all' ? undefined : status, sort }), [rating, search, sort, status]);
  const list = useGetAdminReviews(params, { query: { queryKey: getGetAdminReviewsQueryKey(params), enabled: authenticated, retry: false } });
  const detail = useGetAdminReview(selectedId ?? '', { query: { queryKey: getGetAdminReviewQueryKey(selectedId ?? ''), enabled: authenticated && Boolean(selectedId), retry: false } });
  const reviews = list.data ?? [];
  const selectedFromList = useMemo(() => reviews.find((item) => item.reviewId === selectedId) ?? null, [reviews, selectedId]);
  const selected: AdminReview | null = detail.data ?? selectedFromList;

  useEffect(() => {
    if ((auth.isSuccess && !auth.data.authenticated) || errorStatus(auth.error) === 401 || errorStatus(auth.error) === 403) setLocation('/admin/login');
  }, [auth.data, auth.error, auth.isSuccess, setLocation]);
  useEffect(() => {
    if ([list.error, detail.error].some((error) => errorStatus(error) === 401 || errorStatus(error) === 403)) setLocation('/admin/login');
  }, [detail.error, list.error, setLocation]);
  useEffect(() => {
    if (!reviews.length) setSelectedId(null);
    else if (!selectedId || !reviews.some((item) => item.reviewId === selectedId)) setSelectedId(reviews[0].reviewId);
  }, [reviews, selectedId]);
  useEffect(() => { setNotes(selected?.adminNotes ?? ''); setNotice(''); }, [selected?.reviewId, selected?.adminNotes]);

  const afterMutation = (updated: AdminReview, message: string) => {
    setNotice(message);
    setNotes(updated.adminNotes ?? '');
    queryClient.setQueryData(getGetAdminReviewQueryKey(updated.reviewId), updated);
    void queryClient.invalidateQueries({ queryKey: getGetAdminReviewsQueryKey(params) });
  };
  const moderate = (nextStatus: ReviewStatusValue) => {
    if (!selected) return;
    setNotice('');
    update.mutate({ reviewId: selected.reviewId, data: { status: nextStatus } }, { onSuccess: (updated) => afterMutation(updated, `Review ${nextStatus}.`), onError: (error) => setNotice(errorMessage(error, 'We could not update this review.')) });
  };
  const saveNotes = () => {
    if (!selected) return;
    update.mutate({ reviewId: selected.reviewId, data: { adminNotes: notes.trim() || null } }, { onSuccess: (updated) => afterMutation(updated, 'Internal notes saved.'), onError: (error) => setNotice(errorMessage(error, 'We could not save the internal notes.')) });
  };
  const deleteReview = () => {
    if (!selected || !window.confirm('Delete this review permanently?')) return;
    remove.mutate({ reviewId: selected.reviewId }, { onSuccess: () => { setSelectedId(null); setNotice('Review deleted.'); void queryClient.invalidateQueries({ queryKey: getGetAdminReviewsQueryKey(params) }); }, onError: (error) => setNotice(errorMessage(error, 'We could not delete this review.')) });
  };
  const signOut = () => logout.mutate(undefined, { onSettled: () => setLocation('/admin/login') });

  if (auth.isPending) return <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] p-6"><div className="mx-auto max-w-[1320px] animate-pulse"><div className="h-16 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="mt-10 h-12 w-72 rounded-xl bg-[hsl(210_36%_93%)]" /><div className="mt-8 h-96 rounded-2xl bg-[hsl(210_36%_93%)]" /></div></main>;
  if (auth.isError && errorStatus(auth.error) !== 401 && errorStatus(auth.error) !== 403) return <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_97%)] px-5"><div className="max-w-md rounded-[1.6rem] border border-red-200 bg-red-50 p-7 text-red-800"><h1 className="text-2xl font-extrabold">We could not open reviews.</h1><p className="mt-3 text-sm leading-6">{errorMessage(auth.error, 'Please try again.')}</p><button className="mt-6 min-h-11 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-sm font-extrabold text-white" data-testid="button-retry-reviews-auth" onClick={() => void auth.refetch()} type="button">Try again</button></div></main>;

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] text-[hsl(215_32%_14%)]">
      <header className="sticky top-0 z-30 border-b border-[hsl(215_35%_86%/0.9)] bg-[hsl(210_40%_98%/0.94)] backdrop-blur-xl"><div className="mx-auto flex min-h-[4.7rem] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12"><a aria-label="RZ Home Appliances Care home" className="inline-flex items-center gap-3 rounded-xl" data-testid="link-reviews-brand-home" href={appPath('/')}><BrandMark /><span><span className="block text-[0.9rem] font-extrabold">RZ Home Appliances</span><span className="mt-0.5 block text-[0.61rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care operations</span></span></a><div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full bg-[hsl(174_54%_90%)] px-3 py-2 text-[0.68rem] font-extrabold text-[hsl(166_52%_30%)] sm:inline-flex"><span className="size-1.5 rounded-full bg-[hsl(166_52%_42%)]" /> Live workspace</span><button aria-label="Open reviews menu" className="inline-flex size-11 items-center justify-center rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] lg:hidden" data-testid="button-open-reviews-menu" onClick={() => setMobileMenu((open) => !open)} type="button">{mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}</button><button className="hidden min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] px-4 text-[0.76rem] font-extrabold text-[hsl(215_74%_28%)] lg:inline-flex" data-testid="button-reviews-sign-out" disabled={logout.isPending} onClick={signOut} type="button"><LogOut className="size-4" /> Sign out</button></div></div>{mobileMenu ? <div className="flex gap-5 border-t border-[hsl(215_35%_88%)] px-5 py-3 lg:hidden"><a className="inline-flex min-h-11 items-center gap-2 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)]" data-testid="link-mobile-reviews-bookings" href={appPath('/admin/bookings')}><CalendarDays className="size-4" /> Bookings</a><button className="inline-flex min-h-11 items-center gap-2 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)]" data-testid="button-mobile-reviews-sign-out" onClick={signOut} type="button"><LogOut className="size-4" /> Sign out</button></div> : null}</header>
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:px-12 lg:py-12">
        <aside className="hidden lg:block"><div className="sticky top-28"><p className="px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_20%_52%)]">Workspace</p><nav className="mt-4 grid gap-1" aria-label="Operations navigation"><a className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" data-testid="nav-reviews-requests" href={appPath('/admin/dashboard')}><FileText className="size-4" /> Repair requests</a><a className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" data-testid="nav-reviews-bookings" href={appPath('/admin/bookings')}><CalendarDays className="size-4" /> Bookings</a><span className="flex min-h-11 items-center gap-3 rounded-xl bg-[hsl(215_82%_38%)] px-3 text-[0.78rem] font-extrabold text-white" data-testid="nav-reviews-active"><MessageSquareQuote className="size-4" /> Reviews</span></nav><div className="mt-12 rounded-[1.4rem] border border-[hsl(215_35%_84%)] bg-[hsl(204_67%_95%)] p-4"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_74%_36%)]">Signed in as</p><p className="mt-2 break-words text-[0.86rem] font-extrabold">{auth.data?.admin?.displayName ?? auth.data?.admin?.username}</p></div></div></aside>
        <section className="min-w-0"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">CUSTOMER FEEDBACK</p><h1 className="mt-3 text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[0.93] tracking-[-0.08em]">The review desk.</h1><p className="mt-4 max-w-[38rem] text-[0.96rem] leading-[1.7] text-[hsl(215_20%_45%)]">Read every voice, keep the useful context private, and publish only the feedback that represents the care your team provides.</p></div></div>
          <section className="mt-9 rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-4 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-5"><div className="flex flex-col gap-4 border-b border-[hsl(215_35%_90%)] pb-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-[1.18rem] font-extrabold tracking-[-0.04em]">All reviews</h2><p className="mt-1 text-[0.76rem] text-[hsl(215_20%_51%)]">{reviews.length} shown</p></div><div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto] xl:min-w-[42rem]"><label className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /><span className="sr-only">Search reviews</span><input className="min-h-11 w-full rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] pl-10 pr-3 text-[0.78rem] outline-none focus:border-[hsl(199_82%_52%)]" data-testid="input-review-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, message, ID" value={search} /></label><label className="relative"><span className="sr-only">Filter reviews by rating</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold" data-testid="select-review-rating" onChange={(event) => setRating(event.target.value as typeof rating)} value={rating}><option value="all">All ratings</option>{[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} stars</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4" /></label><label className="relative"><span className="sr-only">Filter reviews by status</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold" data-testid="select-review-status" onChange={(event) => setStatus(event.target.value as ReviewStatusValue | 'all')} value={status}><option value="all">All statuses</option>{Object.values(ReviewStatus).map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4" /></label></div></div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(215_35%_90%)] py-3"><p className="inline-flex items-center gap-2 text-[0.72rem] font-bold text-[hsl(215_20%_51%)]"><Filter className="size-3.5" /> Sort by submitted date</p><div className="flex gap-1 rounded-xl bg-[hsl(210_36%_95%)] p-1"><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'newest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} data-testid="button-review-sort-newest" onClick={() => setSort('newest')} type="button">Newest</button><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'oldest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} data-testid="button-review-sort-oldest" onClick={() => setSort('oldest')} type="button">Oldest</button></div></div>
            <div aria-live="polite" className="mt-2">{list.isPending ? <div className="grid gap-2 py-3">{[1, 2, 3].map((item) => <div className="h-20 animate-pulse rounded-xl bg-[hsl(210_36%_95%)]" key={item} />)}</div> : list.isError ? <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700" data-testid="text-reviews-list-error" role="alert">{errorMessage(list.error, 'We could not load the review queue.')} <button className="font-extrabold underline" data-testid="button-retry-reviews-list" onClick={() => void list.refetch()} type="button">Try again</button></div> : reviews.length === 0 ? <div className="my-4 rounded-2xl border border-dashed border-[hsl(215_35%_82%)] bg-[hsl(210_40%_98%)] p-8 text-center" data-testid="empty-admin-reviews"><MessageSquareQuote className="mx-auto size-7 text-[hsl(199_82%_43%)]" /><p className="mt-3 text-[0.92rem] font-extrabold">No reviews match this view.</p><p className="mt-2 text-[0.78rem] text-[hsl(215_20%_51%)]">Try another filter or clear the search.</p></div> : <div className="divide-y divide-[hsl(215_35%_91%)]">{reviews.map((review) => <button className={`grid w-full gap-3 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-inset md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto_auto] md:items-center md:gap-5 ${selectedId === review.reviewId ? 'bg-[hsl(199_82%_97%)]' : 'hover:bg-[hsl(210_40%_98%)]'}`} data-testid={`button-select-review-${review.reviewId}`} key={review.reviewId} onClick={() => setSelectedId(review.reviewId)} type="button"><div className="min-w-0 pl-2"><p className="truncate text-[0.86rem] font-extrabold">{review.customerName}</p><p className="mt-1 truncate text-[0.72rem] text-[hsl(215_20%_51%)]">{review.sourceId} · {review.applianceType}</p></div><div className="flex min-w-0 items-center gap-3"><Stars rating={review.rating} /><span className="truncate text-[0.76rem] text-[hsl(215_20%_47%)]">{review.reviewMessage}</span></div><span className={`w-fit rounded-full px-2.5 py-1.5 text-[0.65rem] font-extrabold ${statusClass(review.status)}`}>{review.status}</span><span className="text-[0.7rem] font-semibold text-[hsl(215_20%_53%)]">{dateLabel(review.createdAt)}</span></button>)}</div>}</div></section>
          <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]"><div className="rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-5 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-6">{selected ? <><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-5"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(188_75%_43%)]">REVIEW DETAIL</p><h2 className="mt-2 break-all text-[1.3rem] font-extrabold">{selected.reviewId}</h2></div><span className={`rounded-full px-3 py-1.5 text-[0.7rem] font-extrabold ${statusClass(selected.status)}`}>{selected.status}</span></div><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Customer</p><p className="mt-2 text-[1.05rem] font-extrabold">{selected.customerName}</p><p className="mt-1 break-all text-[0.8rem] text-[hsl(215_20%_48%)]">{selected.customerEmail}</p></div><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Related service</p><p className="mt-2 text-[1.05rem] font-extrabold">{selected.applianceType}</p><p className="mt-1 text-[0.8rem] text-[hsl(215_20%_48%)]">{selected.sourceType === 'booking' ? 'Booking' : 'Repair request'} · {selected.sourceId}</p></div></div><div className="mt-6 rounded-2xl bg-[hsl(210_40%_97%)] p-5"><div className="flex items-center justify-between gap-3"><Stars large rating={selected.rating} /><span className="text-[0.75rem] font-semibold text-[hsl(215_20%_51%)]">{dateLabel(selected.createdAt)}</span></div><p className="mt-5 whitespace-pre-wrap text-[1rem] leading-[1.75] text-[hsl(215_32%_28%)]">{selected.reviewMessage}</p></div><dl className="mt-6 grid gap-5 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.8rem] sm:grid-cols-2"><div><dt className="font-extrabold text-[hsl(215_20%_53%)]">Public name</dt><dd className="mt-1 font-semibold">{selected.showFirstName ? 'First name allowed' : 'Anonymous'}</dd></div><div><dt className="font-extrabold text-[hsl(215_20%_53%)]">Verified service</dt><dd className="mt-1 font-semibold">{selected.isVerified ? 'Yes' : 'No'}</dd></div></dl></> : <div className="flex min-h-[22rem] flex-col items-center justify-center text-center"><MessageSquareQuote className="size-8 text-[hsl(199_82%_43%)]" /><h2 className="mt-4 text-lg font-extrabold">Select a review</h2><p className="mt-2 max-w-[20rem] text-sm leading-6 text-[hsl(215_20%_51%)]">Choose feedback from the queue to review its related service and moderation controls.</p></div>}</div><aside className="rounded-[1.6rem] bg-[hsl(215_48%_14%)] p-5 text-[hsl(210_40%_98%)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(184_85%_68%)]">MODERATION</p><h2 className="mt-2 text-[1.25rem] font-extrabold">Make the call.</h2></div><ShieldCheck className="size-5 text-[hsl(184_85%_64%)]" /></div>{selected ? <div className="mt-6 grid gap-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(184_85%_64%)] px-3 text-[0.75rem] font-extrabold text-[hsl(215_74%_20%)] disabled:opacity-60" data-testid="button-approve-review" disabled={update.isPending} onClick={() => moderate(ReviewStatus.approved)} type="button"><Check className="size-4" /> Approve</button><button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[hsl(215_25%_34%)] px-3 text-[0.75rem] font-extrabold text-[hsl(210_40%_98%)] disabled:opacity-60" data-testid="button-reject-review" disabled={update.isPending} onClick={() => moderate(ReviewStatus.rejected)} type="button">Reject</button><button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[hsl(215_25%_34%)] px-3 text-[0.75rem] font-extrabold text-[hsl(210_40%_98%)] disabled:opacity-60" data-testid="button-hide-review" disabled={update.isPending} onClick={() => moderate(ReviewStatus.hidden)} type="button">Hide</button><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[hsl(4_55%_45%)] px-3 text-[0.75rem] font-extrabold text-[hsl(4_78%_78%)] disabled:opacity-60" data-testid="button-delete-review" disabled={remove.isPending} onClick={deleteReview} type="button"><Trash2 className="size-4" /> Delete</button></div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="review-internal-notes">Internal notes</label><textarea className="min-h-36 w-full resize-y rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] p-3 text-[0.8rem] leading-[1.6] text-[hsl(210_40%_98%)] outline-none placeholder:text-[hsl(215_24%_58%)]" data-testid="textarea-review-internal-notes" id="review-internal-notes" maxLength={5000} onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the team..." value={notes} />{notice ? <p className={`text-[0.76rem] font-semibold leading-5 ${notice.includes('could not') ? 'text-[hsl(4_78%_74%)]' : 'text-[hsl(184_85%_72%)]'}`} data-testid="text-review-moderation-notice" role="status">{notice}</p> : null}<button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[hsl(184_85%_64%)] px-4 text-[0.8rem] font-extrabold text-[hsl(215_74%_20%)] disabled:opacity-60" data-testid="button-save-review-notes" disabled={update.isPending} onClick={saveNotes} type="button">{update.isPending ? 'Saving...' : 'Save internal notes'}</button></div> : <p className="mt-6 text-[0.84rem] leading-6 text-[hsl(215_24%_73%)]">Select a review to moderate it or leave an internal note.</p>}</aside></section>
        </section>
      </div>
    </main>
  );
}