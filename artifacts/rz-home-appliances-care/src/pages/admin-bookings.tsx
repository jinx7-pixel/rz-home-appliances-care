import { useEffect, useMemo, useState } from 'react';
import {
  AdminBookingStatus,
  type AdminBooking,
  type AdminBookingStatus as AdminBookingStatusValue,
  type GetAdminBookingsParams,
  useAdminAuthLogout,
  useAdminAuthMe,
  useGetAdminBooking,
  useGetAdminBookings,
  useUpdateAdminBooking,
  getAdminAuthMeQueryKey,
  getGetAdminBookingQueryKey,
  getGetAdminBookingsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  House,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

const statusOptions: Array<{ value: AdminBookingStatusValue; label: string }> = [
  { value: AdminBookingStatus.pending, label: 'Pending' },
  { value: AdminBookingStatus.contacted, label: 'Contacted' },
  { value: AdminBookingStatus.confirmed, label: 'Confirmed' },
  { value: AdminBookingStatus.in_progress, label: 'In progress' },
  { value: AdminBookingStatus.completed, label: 'Completed' },
  { value: AdminBookingStatus.cancelled, label: 'Cancelled' },
];

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

function labelForStatus(status: string): string {
  return status.split(/[-_ ]+/).filter(Boolean).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(' ');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date);
}

function statusClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-[hsl(42_90%_92%)] text-[hsl(30_68%_34%)]',
    contacted: 'bg-[hsl(199_82%_92%)] text-[hsl(215_74%_28%)]',
    confirmed: 'bg-[hsl(219_57%_92%)] text-[hsl(215_74%_28%)]',
    in_progress: 'bg-[hsl(174_54%_90%)] text-[hsl(166_52%_30%)]',
    completed: 'bg-[hsl(151_55%_90%)] text-[hsl(150_55%_28%)]',
    cancelled: 'bg-[hsl(4_72%_94%)] text-[hsl(4_62%_40%)]',
  };
  return classes[status] ?? 'bg-[hsl(210_36%_93%)] text-[hsl(215_32%_28%)]';
}

function BrandMark() {
  return (
    <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]">
      <House className="size-5 stroke-[1.8]" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[1.05rem] items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]"><ShieldCheck className="size-[0.65rem] stroke-[2.4] text-[hsl(215_74%_28%)]" /></span>
    </span>
  );
}

export function AdminBookingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const auth = useAdminAuthMe({ query: { queryKey: getAdminAuthMeQueryKey(), retry: false } });
  const logout = useAdminAuthLogout();
  const updateBooking = useUpdateAdminBooking();
  const authenticated = auth.data?.authenticated === true;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminBookingStatusValue | 'all'>('all');
  const [customerType, setCustomerType] = useState<'all' | 'guest' | 'registered'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  const params = useMemo<GetAdminBookingsParams>(() => ({
    search: search.trim() || undefined,
    status: status === 'all' ? undefined : status,
    customerType: customerType === 'all' ? undefined : customerType,
    sort,
  }), [customerType, search, sort, status]);
  const query = useGetAdminBookings(params, {
    query: { queryKey: getGetAdminBookingsQueryKey(params), enabled: authenticated, retry: false },
  });
  const detail = useGetAdminBooking(selectedId ?? '', {
    query: { queryKey: getGetAdminBookingQueryKey(selectedId ?? ''), enabled: authenticated && Boolean(selectedId), retry: false },
  });
  const bookings = query.data ?? [];
  const selectedFromList = useMemo(() => bookings.find((booking) => booking.bookingId === selectedId) ?? null, [bookings, selectedId]);
  const selected: AdminBooking | null = detail.data ?? selectedFromList;

  useEffect(() => {
    if (auth.isSuccess && !auth.data.authenticated) setLocation('/admin/login');
    if (errorStatus(auth.error) === 401 || errorStatus(auth.error) === 403) setLocation('/admin/login');
  }, [auth.data, auth.error, auth.isSuccess, setLocation]);

  useEffect(() => {
    if ([query.error, detail.error].some((error) => errorStatus(error) === 401 || errorStatus(error) === 403)) setLocation('/admin/login');
  }, [detail.error, query.error, setLocation]);

  useEffect(() => {
    if (!bookings.length) {
      setSelectedId(null);
    } else if (!selectedId || !bookings.some((booking) => booking.bookingId === selectedId)) {
      setSelectedId(bookings[0].bookingId);
    }
  }, [bookings, selectedId]);

  useEffect(() => {
    if (selected) {
      setNotes(selected.adminNotes ?? '');
      setCancellationReason(selected.cancellationReason ?? '');
    }
  }, [selected?.bookingId, selected?.adminNotes, selected?.cancellationReason]);

  const afterUpdate = (updated: AdminBooking, message: string) => {
    setNotes(updated.adminNotes ?? '');
    setCancellationReason(updated.cancellationReason ?? '');
    setNotice(message);
    queryClient.setQueryData(getGetAdminBookingQueryKey(updated.bookingId), updated);
    void queryClient.invalidateQueries({ queryKey: getGetAdminBookingsQueryKey(params) });
  };

  const save = (data: { status?: AdminBookingStatusValue; adminNotes?: string | null; cancellationReason?: string | null }, successMessage: string) => {
    if (!selected) return;
    setNotice('');
    updateBooking.mutate({ bookingId: selected.bookingId, data }, {
      onSuccess: (updated) => afterUpdate(updated, successMessage),
      onError: (error) => {
        if (errorStatus(error) === 401 || errorStatus(error) === 403) {
          setLocation('/admin/login');
        } else {
          setNotice(errorMessage(error, 'We could not save this booking.'));
        }
      },
    });
  };

  const signOut = () => logout.mutate(undefined, { onSettled: () => setLocation('/admin/login') });

  if (auth.isPending) {
    return <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] p-6"><div className="mx-auto max-w-[1320px] animate-pulse"><div className="h-16 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="mt-10 h-12 w-72 rounded-xl bg-[hsl(210_36%_93%)]" /><div className="mt-8 h-80 rounded-2xl bg-[hsl(210_36%_93%)]" /></div></main>;
  }

  if (auth.isError && errorStatus(auth.error) !== 401 && errorStatus(auth.error) !== 403) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_97%)] px-5"><div className="max-w-md rounded-[1.6rem] border border-red-200 bg-red-50 p-7 text-red-800"><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em]">Access check failed</p><h1 className="mt-3 text-2xl font-extrabold">We could not open bookings.</h1><p className="mt-3 text-sm leading-6">Try again, or contact your system administrator if the issue continues.</p><button className="mt-6 min-h-11 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-sm font-extrabold text-white" onClick={() => void auth.refetch()} type="button">Try again</button></div></main>;
  }

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] text-[hsl(215_32%_14%)]">
      <header className="sticky top-0 z-30 border-b border-[hsl(215_35%_86%/0.9)] bg-[hsl(210_40%_98%/0.94)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.7rem] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <a aria-label="RZ Home Appliances Care home" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4" href={appPath('/')}><BrandMark /><span><span className="block text-[0.9rem] font-extrabold tracking-[-0.02em]">RZ Home Appliances</span><span className="mt-0.5 block text-[0.61rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care operations</span></span></a>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full bg-[hsl(174_54%_90%)] px-3 py-2 text-[0.68rem] font-extrabold text-[hsl(166_52%_30%)] sm:inline-flex"><span className="size-1.5 rounded-full bg-[hsl(166_52%_42%)]" /> Live workspace</span>
            <button aria-label={mobileMenu ? 'Close bookings menu' : 'Open bookings menu'} className="inline-flex size-11 items-center justify-center rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] lg:hidden" onClick={() => setMobileMenu((open) => !open)} type="button">{mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}</button>
            <button className="hidden min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] px-4 text-[0.76rem] font-extrabold text-[hsl(215_74%_28%)] lg:inline-flex" disabled={logout.isPending} onClick={signOut} type="button"><LogOut className="size-4" /> {logout.isPending ? 'Signing out' : 'Sign out'}</button>
          </div>
        </div>
        {mobileMenu ? <div className="border-t border-[hsl(215_35%_88%)] px-5 py-3 lg:hidden"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)]" disabled={logout.isPending} onClick={signOut} type="button"><LogOut className="size-4" /> Sign out</button></div> : null}
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:px-12 lg:py-12">
        <aside className="hidden lg:block"><div className="sticky top-28"><p className="px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_20%_52%)]">Workspace</p><nav className="mt-4 grid gap-1" aria-label="Operations navigation"><a className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)]" href={appPath('/admin/dashboard')}><FileText className="size-4" /> Repair requests</a><span className="flex min-h-11 items-center gap-3 rounded-xl bg-[hsl(215_82%_38%)] px-3 text-[0.78rem] font-extrabold text-white"><CalendarDays className="size-4" /> Bookings</span></nav><div className="mt-12 rounded-[1.4rem] border border-[hsl(215_35%_84%)] bg-[hsl(204_67%_95%)] p-4"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_74%_36%)]">Signed in as</p><p className="mt-2 break-words text-[0.86rem] font-extrabold">{auth.data?.admin?.displayName ?? auth.data?.admin?.username}</p><p className="mt-1 text-[0.72rem] text-[hsl(215_20%_48%)]">{auth.data?.admin?.username}</p></div></div></aside>

        <section className="min-w-0" aria-labelledby="bookings-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">SERVICE BOOKINGS</p><h1 className="mt-3 text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[0.93] tracking-[-0.08em]" id="bookings-heading">The appointment desk.</h1><p className="mt-4 max-w-[38rem] text-[0.96rem] leading-[1.7] text-[hsl(215_20%_45%)]">Keep every scheduled visit clear, current, and ready for the next handoff.</p></div><div className="hidden items-center gap-2 text-[0.76rem] font-bold text-[hsl(215_20%_49%)] sm:flex"><Clock3 className="size-4 text-[hsl(188_75%_43%)]" /> Updated as you work</div></div>

          <section className="mt-9 rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-4 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-5" aria-labelledby="booking-queue-heading">
            <div className="flex flex-col gap-4 border-b border-[hsl(215_35%_90%)] pb-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-[1.18rem] font-extrabold tracking-[-0.04em]" id="booking-queue-heading">Booking queue</h2><p className="mt-1 text-[0.76rem] text-[hsl(215_20%_51%)]">{bookings.length} shown{search || status !== 'all' || customerType !== 'all' ? ' with current filters' : ''}</p></div><div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto] xl:min-w-[42rem]"><label className="relative block"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /><span className="sr-only">Search bookings</span><input className="min-h-11 w-full rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] pl-10 pr-3 text-[0.78rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.24)]" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, ID" type="search" value={search} /></label><label className="relative"><span className="sr-only">Filter bookings by status</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold outline-none" onChange={(event) => setStatus(event.target.value as AdminBookingStatusValue | 'all')} value={status}><option value="all">All statuses</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /></label><label className="relative"><span className="sr-only">Filter bookings by customer type</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold outline-none" onChange={(event) => setCustomerType(event.target.value as 'all' | 'guest' | 'registered')} value={customerType}><option value="all">All customers</option><option value="guest">Guest</option><option value="registered">Registered</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /></label></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(215_35%_90%)] py-3"><p className="inline-flex items-center gap-2 text-[0.72rem] font-bold text-[hsl(215_20%_51%)]"><Filter className="size-3.5" /> Sort by booking date</p><div className="flex gap-1 rounded-xl bg-[hsl(210_36%_95%)] p-1"><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'newest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} onClick={() => setSort('newest')} type="button">Newest</button><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'oldest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} onClick={() => setSort('oldest')} type="button">Oldest</button></div></div>
             <div aria-live="polite" className="mt-2">{query.isPending ? <div className="grid gap-2 py-3">{[1, 2, 3].map((item) => <div className="h-20 animate-pulse rounded-xl bg-[hsl(210_36%_95%)]" key={item} />)}</div> : query.isError ? <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700" role="alert">{errorMessage(query.error, 'We could not load the booking queue.')}<button className="ml-2 font-extrabold underline" onClick={() => void query.refetch()} type="button">Try again</button></div> : bookings.length === 0 ? <div className="my-4 rounded-2xl border border-dashed border-[hsl(215_35%_82%)] bg-[hsl(210_40%_98%)] p-8 text-center"><p className="text-[0.92rem] font-extrabold">No bookings match this view.</p><p className="mt-2 text-[0.78rem] text-[hsl(215_20%_51%)]">Try a different search or clear one of the filters.</p></div> : <div className="md:divide-y md:divide-[hsl(215_35%_91%)]">{bookings.map((booking) => <button aria-label={`View and manage booking ${booking.bookingId}`} className={`my-2 grid w-full gap-3 rounded-xl border border-[hsl(215_35%_90%)] bg-[hsl(210_40%_99%)] p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-inset md:my-0 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-5 ${selectedId === booking.bookingId ? 'bg-[hsl(199_82%_97%)] md:bg-[hsl(199_82%_97%)]' : 'hover:bg-[hsl(210_40%_98%)]'}`} data-testid={`button-view-manage-booking-${booking.bookingId}`} key={booking.bookingId} onClick={() => setSelectedId(booking.bookingId)} type="button"><div className="min-w-0"><p className="truncate text-[0.86rem] font-extrabold">{booking.customerName}</p><p className="mt-1 truncate text-[0.72rem] text-[hsl(215_20%_51%)]">{booking.bookingId} · {booking.applianceType}</p></div><div className="flex min-w-0 items-center gap-2 text-[0.75rem] text-[hsl(215_20%_47%)]"><Mail className="size-3.5 shrink-0" /><span className="truncate">{booking.email}</span></div><span className={`w-fit rounded-full px-2.5 py-1.5 text-[0.65rem] font-extrabold ${statusClass(booking.status)}`}>{labelForStatus(booking.status)}</span><span className="text-[0.7rem] font-semibold text-[hsl(215_20%_53%)] md:pr-2"><span className="block">{formatDate(booking.createdAt)}</span><span className="mt-1 block text-[0.65rem] font-extrabold text-[hsl(215_74%_36%)]">View details · Manage</span></span></button>)}</div>}</div>
          </section>

          <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]" aria-labelledby="booking-detail-heading">
            <div className="rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-5 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-6">
              {selected ? <><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-5"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(188_75%_43%)]">BOOKING DETAIL</p><h2 className="mt-2 break-all text-[1.3rem] font-extrabold tracking-[-0.04em]" id="booking-detail-heading">{selected.bookingId}</h2></div><span className={`rounded-full px-3 py-1.5 text-[0.7rem] font-extrabold ${statusClass(selected.status)}`}>{labelForStatus(selected.status)}</span></div><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Customer</p><p className="mt-2 text-[1.05rem] font-extrabold">{selected.customerName}</p><p className="mt-1 text-[0.8rem] text-[hsl(215_20%_48%)]">{selected.customerType === 'registered' ? 'Registered customer' : 'Guest booking'}</p></div><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Appliance</p><p className="mt-2 text-[1.05rem] font-extrabold">{selected.applianceType}</p><p className="mt-1 text-[0.8rem] text-[hsl(215_20%_48%)]">Booked {formatDate(selected.createdAt)}</p></div></div><div className="mt-6 rounded-2xl bg-[hsl(210_40%_97%)] p-4"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Problem description</p><p className="mt-3 whitespace-pre-wrap text-[0.88rem] leading-[1.7] text-[hsl(215_32%_28%)]">{selected.problemDescription}</p></div><dl className="mt-6 grid gap-5 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.8rem] sm:grid-cols-2"><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><Mail className="size-3.5" /> Email</dt><dd className="mt-1 break-all font-semibold text-[hsl(215_74%_28%)]">{selected.email}</dd></div><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><Phone className="size-3.5" /> Phone</dt><dd className="mt-1 font-semibold text-[hsl(215_74%_28%)]">{selected.phone}</dd></div><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><MapPin className="size-3.5" /> Address</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-[hsl(215_32%_28%)]">{selected.address}</dd></div><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><CalendarDays className="size-3.5" /> Preferred window</dt><dd className="mt-1 font-semibold">{formatDate(selected.preferredDate)} · {selected.preferredTime}</dd></div><div className="sm:col-span-2"><dt className="font-extrabold text-[hsl(215_20%_53%)]">Additional notes</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-[hsl(215_32%_28%)]">{selected.additionalNotes || 'None provided'}</dd></div></dl><div className="mt-6 border-t border-[hsl(215_35%_90%)] pt-5"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Booking timeline</p><p className="mt-2 text-[0.78rem] text-[hsl(215_20%_48%)]">Last updated {formatDate(selected.updatedAt)} · Customer email {selected.emailStatus}</p></div></> : <div className="flex min-h-[22rem] flex-col items-center justify-center text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-[hsl(199_82%_92%)] text-[hsl(215_74%_32%)]"><CalendarDays className="size-5" /></div><h2 className="mt-4 text-lg font-extrabold">Select a booking</h2><p className="mt-2 max-w-[20rem] text-sm leading-6 text-[hsl(215_20%_51%)]">Choose a booking from the queue to review its details and update the service handoff.</p></div>}
            </div>

            <aside className="rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(215_48%_14%)] p-5 text-[hsl(210_40%_98%)] shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(184_85%_68%)]">TEAM HANDOFF</p><h2 className="mt-2 text-[1.25rem] font-extrabold tracking-[-0.04em]">Keep it current.</h2></div><ShieldCheck className="size-5 text-[hsl(184_85%_64%)]" /></div>{selected ? <div className="mt-6 grid gap-5"><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="booking-status">Booking status</label><div className="relative mt-2"><select className="min-h-12 w-full appearance-none rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] px-3 pr-9 text-[0.8rem] font-bold text-[hsl(210_40%_98%)] outline-none" disabled={updateBooking.isPending} id="booking-status" onChange={(event) => save({ status: event.target.value as AdminBookingStatusValue, cancellationReason: cancellationReason.trim() || null }, `Status updated to ${labelForStatus(event.target.value)}.`)} value={selected.status}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_24%_72%)]" /></div></div><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="booking-notes">Internal notes</label><textarea className="mt-2 min-h-36 w-full resize-y rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] p-3 text-[0.8rem] leading-[1.6] text-[hsl(210_40%_98%)] outline-none placeholder:text-[hsl(215_24%_58%)]" id="booking-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the technician or next shift..." value={notes} /></div><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="booking-cancellation">Cancellation reason <span className="font-semibold text-[hsl(215_24%_58%)]">(optional)</span></label><textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] p-3 text-[0.8rem] leading-[1.6] text-[hsl(210_40%_98%)] outline-none placeholder:text-[hsl(215_24%_58%)]" id="booking-cancellation" maxLength={2000} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Add cancellation context..." value={cancellationReason} /></div>{notice ? <p className={`text-[0.76rem] font-semibold leading-5 ${notice.includes('could not') ? 'text-[hsl(4_78%_74%)]' : 'text-[hsl(184_85%_72%)]'}`} role="status">{notice}</p> : null}<button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(184_85%_64%)] px-4 text-[0.8rem] font-extrabold text-[hsl(215_74%_20%)] disabled:cursor-not-allowed disabled:opacity-60" disabled={updateBooking.isPending} onClick={() => save({ adminNotes: notes.trim() || null, cancellationReason: cancellationReason.trim() || null }, 'Internal notes saved.')} type="button">{updateBooking.isPending ? 'Saving...' : 'Save internal notes'}</button></div> : <p className="mt-6 text-[0.84rem] leading-6 text-[hsl(215_24%_73%)]">Select a booking to update its status or leave an internal note.</p>}</aside>
          </section>
        </section>
      </div>
    </main>
  );
}