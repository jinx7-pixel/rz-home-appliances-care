import { useEffect, useMemo, useState } from 'react';
import {
  AdminRequestStatus,
  type AdminRepairRequest,
  type AdminRequestStatus as AdminRequestStatusValue,
  type GetAdminRepairRequestsParams,
  useAdminAuthMe,
  useAdminAuthLogout,
  useGetAdminRepairRequest,
  useGetAdminRepairRequests,
  useUpdateAdminRepairRequest,
  getAdminAuthMeQueryKey,
  getGetAdminRepairRequestQueryKey,
  getGetAdminRepairRequestsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, FileText, Filter, House, LogOut, Mail, MapPin, Menu, Phone, Search, ShieldCheck, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import { useLocation } from 'wouter';

const statusOptions: Array<{ value: AdminRequestStatusValue; label: string }> = [
  { value: AdminRequestStatus.pending, label: 'Pending' },
  { value: AdminRequestStatus.contacted, label: 'Contacted' },
  { value: AdminRequestStatus.in_progress, label: 'In progress' },
  { value: AdminRequestStatus.completed, label: 'Completed' },
  { value: AdminRequestStatus.cancelled, label: 'Cancelled' },
];

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

function formatStatus(status: string): string {
  return status.split(/[-_ ]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function formatDate(value: string | null): string {
  if (!value) return 'Not provided';
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(parsed);
}

function statusClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-[hsl(42_90%_92%)] text-[hsl(30_68%_34%)]',
    contacted: 'bg-[hsl(199_82%_92%)] text-[hsl(215_74%_28%)]',
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
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[1.05rem] items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-[0.65rem] stroke-[2.4] text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

function StatCard({ label, value, detail, tone, icon: Icon }: { label: string; value: number; detail: string; tone: string; icon: LucideIcon }) {
  return (
    <article className={`rounded-[1.4rem] border border-[hsl(215_35%_84%/0.8)] p-5 ${tone}`} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_20%_49%)]">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-xl bg-[hsl(204_100%_99%/0.72)] text-[hsl(215_74%_36%)]"><Icon aria-hidden="true" className="size-4" /></span>
      </div>
      <p className="mt-4 text-[2rem] font-extrabold leading-none tracking-[-0.07em] text-[hsl(215_32%_14%)]" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
      <p className="mt-2 text-[0.72rem] font-semibold text-[hsl(215_20%_51%)]">{detail}</p>
    </article>
  );
}

export function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const authMeQuery = useAdminAuthMe({ query: { queryKey: getAdminAuthMeQueryKey(), retry: false } });
  const isAuthenticated = authMeQuery.data?.authenticated === true;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminRequestStatusValue | 'all'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'guest' | 'registered'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [notice, setNotice] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const logout = useAdminAuthLogout();
  const updateRequest = useUpdateAdminRepairRequest();

  const requestParams = useMemo<GetAdminRepairRequestsParams>(() => ({
    search: search.trim() || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    customerType: customerTypeFilter === 'all' ? undefined : customerTypeFilter,
    sort,
  }), [customerTypeFilter, search, sort, statusFilter]);
  const overviewParams = useMemo<GetAdminRepairRequestsParams>(() => ({ sort: 'newest' }), []);
  const listQuery = useGetAdminRepairRequests(requestParams, {
    query: { queryKey: getGetAdminRepairRequestsQueryKey(requestParams), enabled: isAuthenticated, retry: false },
  });
  const overviewQuery = useGetAdminRepairRequests(overviewParams, {
    query: { queryKey: getGetAdminRepairRequestsQueryKey(overviewParams), enabled: isAuthenticated, retry: false },
  });
  const detailQuery = useGetAdminRepairRequest(selectedRequestId ?? '', {
    query: { queryKey: getGetAdminRepairRequestQueryKey(selectedRequestId ?? ''), enabled: isAuthenticated && Boolean(selectedRequestId), retry: false },
  });

  const selectedFromList = useMemo(
    () => listQuery.data?.find((request) => request.requestId === selectedRequestId) ?? null,
    [listQuery.data, selectedRequestId],
  );
  const selectedRequest: AdminRepairRequest | null = detailQuery.data ?? selectedFromList;
  const overview = overviewQuery.data ?? [];
  const filteredRequests = listQuery.data ?? [];
  const stats = useMemo(() => ({
    total: overview.length,
    pending: overview.filter((request) => request.status === AdminRequestStatus.pending).length,
    inProgress: overview.filter((request) => request.status === AdminRequestStatus.in_progress).length,
    completed: overview.filter((request) => request.status === AdminRequestStatus.completed).length,
    guest: overview.filter((request) => request.customerType === 'guest').length,
    registered: overview.filter((request) => request.customerType === 'registered').length,
  }), [overview]);

  useEffect(() => {
    if (authMeQuery.isSuccess && !authMeQuery.data.authenticated) setLocation('/admin/login');
    if (getErrorStatus(authMeQuery.error) === 401 || getErrorStatus(authMeQuery.error) === 403) setLocation('/admin/login');
  }, [authMeQuery.data, authMeQuery.error, authMeQuery.isSuccess, setLocation]);

  useEffect(() => {
    if (
      getErrorStatus(listQuery.error) === 401 ||
      getErrorStatus(listQuery.error) === 403 ||
      getErrorStatus(overviewQuery.error) === 401 ||
      getErrorStatus(overviewQuery.error) === 403 ||
      getErrorStatus(detailQuery.error) === 401 ||
      getErrorStatus(detailQuery.error) === 403
    ) {
      setLocation('/admin/login');
    }
  }, [detailQuery.error, listQuery.error, overviewQuery.error, setLocation]);

  useEffect(() => {
    if (!filteredRequests.length) {
      setSelectedRequestId(null);
      return;
    }
    if (!selectedRequestId || !filteredRequests.some((request) => request.requestId === selectedRequestId)) {
      setSelectedRequestId(filteredRequests[0].requestId);
    }
  }, [filteredRequests, selectedRequestId]);

  useEffect(() => {
    if (selectedRequest) {
      setNotes(selectedRequest.adminNotes ?? '');
      setCancellationReason(selectedRequest.cancellationReason ?? '');
    }
  }, [selectedRequest?.requestId, selectedRequest?.adminNotes, selectedRequest?.cancellationReason]);

  const refreshAfterUpdate = (updated: AdminRepairRequest, message: string) => {
    setNotes(updated.adminNotes ?? '');
    setCancellationReason(updated.cancellationReason ?? '');
    setNotice(message);
    queryClient.setQueryData(getGetAdminRepairRequestQueryKey(updated.requestId), updated);
    void queryClient.invalidateQueries({ queryKey: getGetAdminRepairRequestsQueryKey(requestParams) });
    void queryClient.invalidateQueries({ queryKey: getGetAdminRepairRequestsQueryKey(overviewParams) });
  };

  const updateStatus = (status: AdminRequestStatusValue) => {
    if (!selectedRequest) return;
    setNotice('');
    updateRequest.mutate({
      requestId: selectedRequest.requestId,
      data: {
        status,
        cancellationReason: cancellationReason.trim() || null,
      },
    }, {
      onSuccess: (updated) => refreshAfterUpdate(updated, `Status updated to ${formatStatus(status)}.`),
      onError: (error) => {
        if (getErrorStatus(error) === 401 || getErrorStatus(error) === 403) {
          setLocation('/admin/login');
          return;
        }
        setNotice(getErrorMessage(error, 'We could not update this request.'));
      },
    });
  };

  const saveNotes = () => {
    if (!selectedRequest) return;
    setNotice('');
    updateRequest.mutate({
      requestId: selectedRequest.requestId,
      data: {
        adminNotes: notes.trim() || null,
        cancellationReason: cancellationReason.trim() || null,
      },
    }, {
      onSuccess: (updated) => refreshAfterUpdate(updated, 'Internal notes saved.'),
      onError: (error) => {
        if (getErrorStatus(error) === 401 || getErrorStatus(error) === 403) {
          setLocation('/admin/login');
          return;
        }
        setNotice(getErrorMessage(error, 'We could not save the internal notes.'));
      },
    });
  };

  const signOut = () => {
    logout.mutate(undefined, { onSettled: () => setLocation('/admin/login') });
  };

  if (authMeQuery.isPending) {
    return <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] p-6"><div className="mx-auto max-w-[1320px] animate-pulse"><div className="h-16 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="mt-10 h-12 w-72 rounded-xl bg-[hsl(210_36%_93%)]" /><div className="mt-8 grid gap-4 md:grid-cols-3"><div className="h-32 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="h-32 rounded-2xl bg-[hsl(210_36%_93%)]" /><div className="h-32 rounded-2xl bg-[hsl(210_36%_93%)]" /></div></div></main>;
  }

  if (authMeQuery.isError && getErrorStatus(authMeQuery.error) !== 401 && getErrorStatus(authMeQuery.error) !== 403) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_97%)] px-5"><div className="max-w-md rounded-[1.6rem] border border-red-200 bg-red-50 p-7 text-red-800"><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em]">Access check failed</p><h1 className="mt-3 text-2xl font-extrabold">We could not open the operations desk.</h1><p className="mt-3 text-sm leading-6">Please try again. If the issue continues, contact your system administrator.</p><button className="mt-6 min-h-11 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-sm font-extrabold text-white" data-testid="button-retry-admin-auth" onClick={() => void authMeQuery.refetch()} type="button">Try again</button></div></main>;
  }

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] text-[hsl(215_32%_14%)]">
      <header className="sticky top-0 z-30 border-b border-[hsl(215_35%_86%/0.9)] bg-[hsl(210_40%_98%/0.94)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.7rem] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <a aria-label="RZ Home Appliances Care home" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4" data-testid="link-dashboard-brand-home" href={appPath('/')}>
              <BrandMark />
              <span><span className="block text-[0.9rem] font-extrabold tracking-[-0.02em]">RZ Home Appliances</span><span className="mt-0.5 block text-[0.61rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care operations</span></span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full bg-[hsl(174_54%_90%)] px-3 py-2 text-[0.68rem] font-extrabold text-[hsl(166_52%_30%)] sm:inline-flex"><span className="size-1.5 rounded-full bg-[hsl(166_52%_42%)]" /> Live workspace</span>
            <button aria-label="Open dashboard menu" className="inline-flex size-11 items-center justify-center rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] lg:hidden" data-testid="button-open-admin-menu" onClick={() => setIsMobileMenuOpen((open) => !open)} type="button">{isMobileMenuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}</button>
             <a className="hidden min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] px-4 text-[0.76rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:border-[hsl(199_82%_52%)] hover:bg-[hsl(199_82%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] lg:inline-flex" data-testid="link-admin-bookings" href={appPath('/admin/bookings')}><CalendarDays aria-hidden="true" className="size-4" /> Bookings</a>
             <button className="hidden min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(204_100%_99%)] px-4 text-[0.76rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:border-[hsl(199_82%_52%)] hover:bg-[hsl(199_82%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:opacity-60 lg:inline-flex" data-testid="button-admin-sign-out" disabled={logout.isPending} onClick={signOut} type="button"><LogOut aria-hidden="true" className="size-4" /> {logout.isPending ? 'Signing out' : 'Sign out'}</button>
          </div>
        </div>
         {isMobileMenuOpen ? <div className="flex items-center gap-4 border-t border-[hsl(215_35%_88%)] px-5 py-3 lg:hidden"><a className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)]" data-testid="link-mobile-admin-bookings" href={appPath('/admin/bookings')}><CalendarDays aria-hidden="true" className="size-4" /> Bookings</a><button className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)]" data-testid="button-mobile-admin-sign-out" disabled={logout.isPending} onClick={signOut} type="button"><LogOut aria-hidden="true" className="size-4" /> Sign out</button></div> : null}
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:px-12 lg:py-12">
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_20%_52%)]">Workspace</p>
            <nav className="mt-4 grid gap-1" aria-label="Operations navigation">
              <span className="flex min-h-11 items-center gap-3 rounded-xl bg-[hsl(215_82%_38%)] px-3 text-[0.78rem] font-extrabold text-white" data-testid="nav-admin-requests"><FileText aria-hidden="true" className="size-4" /> Repair requests</span>
            </nav>
            <div className="mt-12 rounded-[1.4rem] border border-[hsl(215_35%_84%)] bg-[hsl(204_67%_95%)] p-4"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_74%_36%)]">Signed in as</p><p className="mt-2 break-words text-[0.86rem] font-extrabold text-[hsl(215_32%_19%)]">{authMeQuery.data?.admin?.displayName ?? authMeQuery.data?.admin?.username}</p><p className="mt-1 text-[0.72rem] text-[hsl(215_20%_48%)]">{authMeQuery.data?.admin?.username}</p></div>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="admin-dashboard-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">REPAIR REQUESTS</p><h1 className="mt-3 text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[0.93] tracking-[-0.08em] text-[hsl(215_32%_14%)]" id="admin-dashboard-heading">The work queue.</h1><p className="mt-4 max-w-[38rem] text-[0.96rem] leading-[1.7] text-[hsl(215_20%_45%)]">A clear view of every customer request, from first contact to completed repair.</p></div>
            <div className="hidden items-center gap-2 text-[0.76rem] font-bold text-[hsl(215_20%_49%)] sm:flex"><Clock3 aria-hidden="true" className="size-4 text-[hsl(188_75%_43%)]" /> Updated as you work</div>
          </div>

          <section className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Request overview counts">
            <StatCard detail="all sources" icon={FileText} label="Total" tone="bg-[hsl(204_67%_95%)]" value={stats.total} />
            <StatCard detail="needs a first touch" icon={Clock3} label="Pending" tone="bg-[hsl(42_90%_96%)]" value={stats.pending} />
            <StatCard detail="being handled" icon={ArrowRight} label="In progress" tone="bg-[hsl(174_54%_95%)]" value={stats.inProgress} />
            <StatCard detail="closed successfully" icon={Check} label="Completed" tone="bg-[hsl(151_55%_95%)]" value={stats.completed} />
            <StatCard detail="no account needed" icon={UserRound} label="Guest" tone="bg-[hsl(210_36%_95%)]" value={stats.guest} />
            <StatCard detail="account holders" icon={Users} label="Registered" tone="bg-[hsl(219_57%_96%)]" value={stats.registered} />
          </section>

          <section className="mt-9 rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-4 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-5" aria-labelledby="request-list-heading">
            <div className="flex flex-col gap-4 border-b border-[hsl(215_35%_90%)] pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div><h2 className="text-[1.18rem] font-extrabold tracking-[-0.04em]" id="request-list-heading">All requests</h2><p className="mt-1 text-[0.76rem] text-[hsl(215_20%_51%)]">{filteredRequests.length} shown{search || statusFilter !== 'all' || customerTypeFilter !== 'all' ? ' with current filters' : ''}</p></div>
              <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto] xl:min-w-[42rem]">
                <label className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /><span className="sr-only">Search requests</span><input className="min-h-11 w-full rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] pl-10 pr-3 text-[0.78rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.24)]" data-testid="input-admin-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, ID" value={search} /></label>
                <label className="relative"><span className="sr-only">Filter by status</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold text-[hsl(215_32%_28%)] outline-none focus:border-[hsl(199_82%_52%)]" data-testid="select-admin-status-filter" onChange={(event) => setStatusFilter(event.target.value as AdminRequestStatusValue | 'all')} value={statusFilter}><option value="all">All statuses</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /></label>
                <label className="relative"><span className="sr-only">Filter by customer type</span><select className="min-h-11 w-full appearance-none rounded-xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-3 pr-9 text-[0.78rem] font-bold text-[hsl(215_32%_28%)] outline-none focus:border-[hsl(199_82%_52%)]" data-testid="select-admin-customer-filter" onChange={(event) => setCustomerTypeFilter(event.target.value as 'all' | 'guest' | 'registered')} value={customerTypeFilter}><option value="all">All customers</option><option value="guest">Guest</option><option value="registered">Registered</option></select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" /></label>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(215_35%_90%)] py-3"><p className="inline-flex items-center gap-2 text-[0.72rem] font-bold text-[hsl(215_20%_51%)]"><Filter aria-hidden="true" className="size-3.5" /> Sort by request date</p><div className="flex gap-1 rounded-xl bg-[hsl(210_36%_95%)] p-1"><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'newest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} data-testid="button-sort-newest" onClick={() => setSort('newest')} type="button">Newest</button><button className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-extrabold ${sort === 'oldest' ? 'bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] shadow-sm' : 'text-[hsl(215_20%_51%)]'}`} data-testid="button-sort-oldest" onClick={() => setSort('oldest')} type="button">Oldest</button></div></div>

            <div aria-live="polite" className="mt-2">
              {listQuery.isPending ? <div className="grid gap-2 py-3">{[1, 2, 3].map((item) => <div className="h-20 animate-pulse rounded-xl bg-[hsl(210_36%_95%)]" key={item} />)}</div> : listQuery.isError ? <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700" data-testid="text-admin-list-error" role="alert">{getErrorMessage(listQuery.error, 'We could not load the request queue.')}<button className="ml-2 font-extrabold underline" data-testid="button-retry-admin-list" onClick={() => void listQuery.refetch()} type="button">Try again</button></div> : filteredRequests.length === 0 ? <div className="my-4 rounded-2xl border border-dashed border-[hsl(215_35%_82%)] bg-[hsl(210_40%_98%)] p-8 text-center"><p className="text-[0.92rem] font-extrabold text-[hsl(215_32%_28%)]">No requests match this view.</p><p className="mt-2 text-[0.78rem] text-[hsl(215_20%_51%)]">Try a different search or clear one of the filters.</p></div> : <div className="divide-y divide-[hsl(215_35%_91%)]">{filteredRequests.map((request) => <button className={`grid w-full gap-3 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-inset md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-5 ${selectedRequestId === request.requestId ? 'bg-[hsl(199_82%_97%)]' : 'hover:bg-[hsl(210_40%_98%)]'}`} data-testid={`button-select-request-${request.requestId}`} key={request.requestId} onClick={() => setSelectedRequestId(request.requestId)} type="button"><div className="min-w-0 pl-2"><p className="truncate text-[0.86rem] font-extrabold text-[hsl(215_32%_19%)]">{request.customerName}</p><p className="mt-1 truncate text-[0.72rem] text-[hsl(215_20%_51%)]">{request.requestId} · {request.applianceType}</p></div><div className="flex min-w-0 items-center gap-2 text-[0.75rem] text-[hsl(215_20%_47%)]"><Mail aria-hidden="true" className="size-3.5 shrink-0" /><span className="truncate">{request.email}</span></div><span className={`w-fit rounded-full px-2.5 py-1.5 text-[0.65rem] font-extrabold ${statusClass(request.status)}`}>{formatStatus(request.status)}</span><span className="text-[0.7rem] font-semibold text-[hsl(215_20%_53%)] md:pr-2">{formatDate(request.createdAt)}</span></button>)}</div>}
            </div>
          </section>

          <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]" aria-labelledby="request-detail-heading">
            <div className="rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] p-5 shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-6">
              {selectedRequest ? <><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-5"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(188_75%_43%)]">REQUEST DETAIL</p><h2 className="mt-2 break-all text-[1.3rem] font-extrabold tracking-[-0.04em]" id="request-detail-heading">{selectedRequest.requestId}</h2></div><span className={`rounded-full px-3 py-1.5 text-[0.7rem] font-extrabold ${statusClass(selectedRequest.status)}`}>{formatStatus(selectedRequest.status)}</span></div><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Customer</p><p className="mt-2 text-[1.05rem] font-extrabold">{selectedRequest.customerName}</p><p className="mt-1 text-[0.8rem] text-[hsl(215_20%_48%)]">{selectedRequest.customerType === 'registered' ? 'Registered customer' : 'Guest request'}</p></div><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Appliance</p><p className="mt-2 text-[1.05rem] font-extrabold">{selectedRequest.applianceType}</p><p className="mt-1 text-[0.8rem] text-[hsl(215_20%_48%)]">Submitted {formatDate(selectedRequest.createdAt)}</p></div></div><div className="mt-6 rounded-2xl bg-[hsl(210_40%_97%)] p-4"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Problem description</p><p className="mt-3 whitespace-pre-wrap text-[0.88rem] leading-[1.7] text-[hsl(215_32%_28%)]">{selectedRequest.problemDescription}</p></div><dl className="mt-6 grid gap-5 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.8rem] sm:grid-cols-2"><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><Mail className="size-3.5" /> Email</dt><dd className="mt-1 break-all font-semibold text-[hsl(215_74%_28%)]">{selectedRequest.email}</dd></div><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><Phone className="size-3.5" /> Phone</dt><dd className="mt-1 font-semibold text-[hsl(215_74%_28%)]">{selectedRequest.phone}</dd></div><div><dt className="flex items-center gap-2 font-extrabold text-[hsl(215_20%_53%)]"><MapPin className="size-3.5" /> Address</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-[hsl(215_32%_28%)]">{selectedRequest.address}</dd></div><div><dt className="font-extrabold text-[hsl(215_20%_53%)]">Preferred window</dt><dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{selectedRequest.preferredDate ? formatDate(selectedRequest.preferredDate) : 'No date'}{selectedRequest.preferredTime ? ` · ${selectedRequest.preferredTime}` : ''}</dd></div></dl><div className="mt-6 border-t border-[hsl(215_35%_90%)] pt-5"><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.15em] text-[hsl(215_20%_53%)]">Request timeline</p><p className="mt-2 text-[0.78rem] text-[hsl(215_20%_48%)]">Last updated {formatDate(selectedRequest.updatedAt)} · Customer email {selectedRequest.emailStatus}</p></div></> : <div className="flex min-h-[22rem] flex-col items-center justify-center text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-[hsl(199_82%_92%)] text-[hsl(215_74%_32%)]"><FileText className="size-5" /></div><h2 className="mt-4 text-lg font-extrabold">Select a request</h2><p className="mt-2 max-w-[20rem] text-sm leading-6 text-[hsl(215_20%_51%)]">Choose a request from the queue to review its details and update the team handoff.</p></div>}
            </div>

             <aside className="rounded-[1.6rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(215_48%_14%)] p-5 text-[hsl(210_40%_98%)] shadow-[0_24px_52px_-42px_hsl(215_53%_23%/0.6)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(184_85%_68%)]">TEAM HANDOFF</p><h2 className="mt-2 text-[1.25rem] font-extrabold tracking-[-0.04em]">Keep it current.</h2></div><ShieldCheck aria-hidden="true" className="size-5 text-[hsl(184_85%_64%)]" /></div>{selectedRequest ? <div className="mt-6 grid gap-5"><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="admin-status">Request status</label><div className="relative mt-2"><select className="min-h-12 w-full appearance-none rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] px-3 pr-9 text-[0.8rem] font-bold text-[hsl(210_40%_98%)] outline-none focus:border-[hsl(184_85%_64%)] focus:ring-2 focus:ring-[hsl(184_85%_64%/0.22)]" data-testid="select-admin-request-status" disabled={updateRequest.isPending} id="admin-status" onChange={(event) => updateStatus(event.target.value as AdminRequestStatusValue)} value={selectedRequest.status}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_24%_72%)]" /></div></div><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="admin-notes">Internal notes</label><textarea className="mt-2 min-h-36 w-full resize-y rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] p-3 text-[0.8rem] leading-[1.6] text-[hsl(210_40%_98%)] outline-none placeholder:text-[hsl(215_24%_58%)] focus:border-[hsl(184_85%_64%)] focus:ring-2 focus:ring-[hsl(184_85%_64%/0.22)]" data-testid="textarea-admin-notes" id="admin-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Add context for the technician or next shift..." value={notes} /></div><div><label className="text-[0.72rem] font-extrabold text-[hsl(215_24%_77%)]" htmlFor="admin-cancellation-reason">Cancellation reason <span className="font-semibold text-[hsl(215_24%_58%)]">(optional)</span></label><textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[hsl(215_25%_34%)] bg-[hsl(215_42%_19%)] p-3 text-[0.8rem] leading-[1.6] text-[hsl(210_40%_98%)] outline-none placeholder:text-[hsl(215_24%_58%)] focus:border-[hsl(184_85%_64%)] focus:ring-2 focus:ring-[hsl(184_85%_64%/0.22)]" data-testid="textarea-admin-cancellation-reason" id="admin-cancellation-reason" maxLength={2000} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Optional context to share with the customer..." value={cancellationReason} /></div>{notice ? <p className={`text-[0.76rem] font-semibold leading-5 ${notice.includes('could not') || notice.includes('not ') ? 'text-[hsl(4_78%_74%)]' : 'text-[hsl(184_85%_72%)]'}`} data-testid="text-admin-update-notice" role="status">{notice}</p> : null}<button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(184_85%_64%)] px-4 text-[0.8rem] font-extrabold text-[hsl(215_74%_20%)] transition hover:bg-[hsl(184_85%_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_14%)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-save-admin-notes" disabled={updateRequest.isPending} onClick={saveNotes} type="button">{updateRequest.isPending ? 'Saving...' : 'Save internal notes'}</button></div> : <p className="mt-6 text-[0.84rem] leading-6 text-[hsl(215_24%_73%)]">Select a request to update its status or leave an internal note.</p>}</aside>
          </section>
        </section>
      </div>
    </main>
  );
}