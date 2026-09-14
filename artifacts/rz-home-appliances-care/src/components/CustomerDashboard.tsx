import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  HelpCircle,
  House,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Refrigerator,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

type DashboardStat = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'blue' | 'teal' | 'amber' | 'ink';
};

type RepairBooking = {
  id: string;
  appliance: string;
  service: string;
  date: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  amount: string;
  icon: LucideIcon;
};

type ServiceAppointment = {
  service: string;
  date: string;
  time: string;
  technician: string;
  address: string;
  status: 'Confirmed';
};

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
};

// TODO: Replace these demo records with the authenticated customer's dashboard response.
const dashboardStats: DashboardStat[] = [
  {
    label: 'Total Bookings',
    value: '12',
    detail: 'Since joining RZ Care',
    icon: ClipboardList,
    tone: 'blue',
  },
  {
    label: 'Active Requests',
    value: '02',
    detail: 'One visit scheduled',
    icon: CircleDashed,
    tone: 'teal',
  },
  {
    label: 'Completed Repairs',
    value: '10',
    detail: 'Dependable fixes',
    icon: CheckCircle2,
    tone: 'ink',
  },
  {
    label: 'Pending Payments',
    value: '₹1,500',
    detail: 'Across 2 bookings',
    icon: IndianRupee,
    tone: 'amber',
  },
];

// TODO: Replace this static list with the customer's paginated repair-bookings query.
const recentBookings: RepairBooking[] = [
  {
    id: '#RZ1001',
    appliance: 'Washing Machine',
    service: 'Washing Machine Repair',
    date: '12 Sep 2026',
    status: 'Completed',
    amount: '₹800',
    icon: Wrench,
  },
  {
    id: '#RZ1002',
    appliance: 'Refrigerator',
    service: 'Refrigerator Repair',
    date: '14 Sep 2026',
    status: 'In Progress',
    amount: '₹1,200',
    icon: Refrigerator,
  },
  {
    id: '#RZ1003',
    appliance: 'LED TV',
    service: 'LED TV Repair',
    date: '16 Sep 2026',
    status: 'Pending',
    amount: '₹600',
    icon: Settings2,
  },
];

// TODO: Replace with the next confirmed appointment from the customer's service schedule.
const upcomingAppointment: ServiceAppointment = {
  service: 'Refrigerator Repair',
  date: '18 September 2026',
  time: '10:30 AM – 12:00 PM',
  technician: 'Assigned Technician',
  address: 'Customer Address',
  status: 'Confirmed',
};

const sidebarItems: SidebarItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#dashboard', active: true },
  { label: 'My Repair Bookings', icon: ClipboardList, href: '#bookings' },
  { label: 'Service Requests', icon: Wrench, href: '#service-requests' },
  { label: 'Saved Addresses', icon: MapPinned, href: '#saved-addresses' },
  { label: 'Notifications', icon: Bell, href: '#notifications' },
  { label: 'Profile Settings', icon: UserRound, href: '#profile-settings' },
  { label: 'Help & Support', icon: HelpCircle, href: '#support' },
  { label: 'Logout', icon: LogOut, href: '/' },
];

const toneStyles = {
  blue: {
    icon: 'bg-[hsl(211_82%_92%)] text-[hsl(215_82%_38%)]',
    rule: 'bg-[hsl(215_82%_52%)]',
  },
  teal: {
    icon: 'bg-[hsl(176_52%_90%)] text-[hsl(174_54%_36%)]',
    rule: 'bg-[hsl(174_54%_48%)]',
  },
  amber: {
    icon: 'bg-[hsl(40_92%_91%)] text-[hsl(32_72%_42%)]',
    rule: 'bg-[hsl(39_86%_60%)]',
  },
  ink: {
    icon: 'bg-[hsl(216_34%_91%)] text-[hsl(215_48%_22%)]',
    rule: 'bg-[hsl(215_48%_30%)]',
  },
} as const;

const statusStyles = {
  Completed:
    'bg-[hsl(164_54%_92%)] text-[hsl(164_60%_30%)] ring-[hsl(164_54%_82%)]',
  'In Progress':
    'bg-[hsl(211_82%_93%)] text-[hsl(215_74%_34%)] ring-[hsl(211_72%_84%)]',
  Pending:
    'bg-[hsl(39_86%_93%)] text-[hsl(32_72%_38%)] ring-[hsl(39_72%_84%)]',
  Confirmed:
    'bg-[hsl(164_54%_92%)] text-[hsl(164_60%_30%)] ring-[hsl(164_54%_82%)]',
} as const;

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_10px_18px_-10px_hsl(215_82%_10%/0.75)]"
    >
      <House className="size-[1.2rem] stroke-[1.8]" />
      <span className="absolute -bottom-1 -right-1 flex size-[1.03rem] items-center justify-center rounded-full border-2 border-[hsl(215_48%_14%)] bg-[hsl(184_85%_64%)]">
        <ShieldCheck className="size-[0.62rem] stroke-[2.5] text-[hsl(215_74%_23%)]" />
      </span>
    </span>
  );
}

function SidebarContent({
  onNavigate,
  onClose,
}: {
  onNavigate: (label: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center gap-3 px-6 pb-9 pt-7">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-[0.88rem] font-extrabold tracking-[-0.03em] text-[hsl(210_40%_98%)]">
            RZ Home Appliances
          </p>
          <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.21em] text-[hsl(184_85%_68%)]">
            Care
          </p>
        </div>
        {onClose ? (
          <button
            aria-label="Close dashboard menu"
            className="ml-auto inline-flex size-9 items-center justify-center rounded-xl text-[hsl(215_24%_76%)] transition hover:bg-[hsl(215_38%_22%)] hover:text-[hsl(210_40%_98%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="px-4">
        <p className="px-3 pb-3 text-[0.61rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_24%_60%)]">
          Customer workspace
        </p>
        <nav aria-label="Customer dashboard navigation" className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                aria-current={item.active ? 'page' : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-[0.85rem] px-3 text-[0.78rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] ${
                  item.active
                    ? 'bg-[hsl(199_82%_62%/0.16)] text-[hsl(184_85%_74%)] shadow-[inset_3px_0_0_hsl(184_85%_64%)]'
                    : 'text-[hsl(215_24%_76%)] hover:bg-[hsl(215_38%_22%)] hover:text-[hsl(210_40%_98%)]'
                }`}
                href={item.href}
                key={item.label}
                onClick={() => {
                  onNavigate(item.label);
                  onClose?.();
                }}
              >
                <Icon aria-hidden="true" className="size-[1.05rem] shrink-0 stroke-[1.8]" />
                <span>{item.label}</span>
                {item.active ? (
                  <span className="ml-auto size-1.5 rounded-full bg-[hsl(184_85%_64%)]" />
                ) : null}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-5 pb-6 pt-10">
        <div className="rounded-[1.1rem] border border-[hsl(215_31%_30%)] bg-[hsl(215_38%_20%/0.58)] p-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[hsl(184_85%_64%/0.14)] text-[hsl(184_85%_70%)]">
            <ShieldCheck aria-hidden="true" className="size-4" />
          </div>
          <p className="mt-3 text-[0.73rem] font-bold text-[hsl(210_40%_98%)]">Service you can trust</p>
          <p className="mt-1 text-[0.67rem] leading-[1.5] text-[hsl(215_24%_68%)]">
            Clear updates, careful work, and no runaround.
          </p>
        </div>
        <p className="mt-5 px-1 text-[0.62rem] text-[hsl(215_24%_55%)]">RZ Care · Bengaluru</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: RepairBooking['status'] | ServiceAppointment['status'] }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.66rem] font-extrabold ring-1 ring-inset ${statusStyles[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  actionLabel,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[0.61rem] font-extrabold uppercase tracking-[0.19em] text-[hsl(188_75%_40%)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[1.2rem] font-extrabold tracking-[-0.045em] text-[hsl(215_32%_16%)] sm:text-[1.32rem]">
          {title}
        </h2>
      </div>
      {action ? (
        <a
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[0.72rem] font-extrabold text-[hsl(215_74%_38%)] transition hover:bg-[hsl(211_82%_93%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
          href={action}
        >
          {actionLabel}
          <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      ) : null}
    </div>
  );
}

function CustomerDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleNavigation = (label: string) => {
    if (label === 'Logout') {
      return;
    }
    setNotice(`${label} is ready for connected customer data.`);
  };

  return (
    <div
      className="min-h-[100dvh] bg-[hsl(210_40%_97%)] text-[hsl(215_32%_19%)]"
      id="dashboard"
    >
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17.25rem] bg-[hsl(215_48%_14%)] lg:block">
        <SidebarContent onNavigate={handleNavigation} />
      </aside>

      {isMobileMenuOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-[hsl(215_48%_14%/0.58)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}
      <aside
        aria-label="Mobile customer dashboard menu"
        id="mobile-dashboard-menu"
        className={`fixed inset-y-0 left-0 z-50 w-[min(87vw,19rem)] bg-[hsl(215_48%_14%)] shadow-[20px_0_50px_-30px_hsl(215_48%_8%/0.9)] transition-transform duration-300 lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          onClose={() => setIsMobileMenuOpen(false)}
          onNavigate={handleNavigation}
        />
      </aside>

      <div className="min-w-0 lg:pl-[17.25rem]">
        <header className="sticky top-0 z-30 border-b border-[hsl(214_30%_88%/0.82)] bg-[hsl(210_40%_97%/0.9)] backdrop-blur-xl">
          <div className="mx-auto flex min-h-[4.65rem] max-w-[1320px] items-center gap-3 px-4 sm:px-7 lg:px-10">
            <button
              aria-controls="mobile-dashboard-menu"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(214_30%_84%)] bg-[hsl(204_100%_99%)] text-[hsl(215_74%_28%)] transition hover:border-[hsl(215_65%_62%)] hover:bg-[hsl(211_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] lg:hidden"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              ref={menuButtonRef}
              type="button"
            >
              {isMobileMenuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-[1.05rem] font-extrabold tracking-[-0.04em] text-[hsl(215_32%_16%)] sm:text-[1.18rem]">
                Customer Dashboard
              </p>
              <p className="mt-0.5 hidden text-[0.68rem] font-medium text-[hsl(215_20%_48%)] sm:block">
                Keep an eye on every repair, without the guesswork.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <label className="relative hidden w-[13rem] md:block xl:w-[17rem]">
                <span className="sr-only">Search bookings</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                <input
                  aria-label="Search bookings"
                  className="h-10 w-full rounded-xl border border-[hsl(214_30%_86%)] bg-[hsl(204_100%_99%/0.78)] pl-9 pr-3 text-[0.74rem] font-semibold text-[hsl(215_32%_20%)] outline-none placeholder:text-[hsl(215_20%_58%)] focus:border-[hsl(215_65%_62%)] focus:ring-2 focus:ring-[hsl(211_100%_73%/0.42)]"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search bookings"
                  type="search"
                  value={searchQuery}
                />
              </label>
              <button
                aria-label="View notifications"
                className="relative inline-flex size-10 items-center justify-center rounded-xl border border-[hsl(214_30%_86%)] bg-[hsl(204_100%_99%/0.78)] text-[hsl(215_74%_28%)] transition hover:border-[hsl(215_65%_62%)] hover:bg-[hsl(211_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
                onClick={() => setNotice('Notifications are ready for connected customer data.')}
                type="button"
              >
                <Bell aria-hidden="true" className="size-[1.05rem] stroke-[1.8]" />
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[hsl(188_75%_45%)] ring-2 ring-[hsl(204_100%_99%)]" />
              </button>
              <div className="hidden items-center gap-2.5 border-l border-[hsl(214_30%_86%)] pl-3 sm:flex">
                <span className="flex size-9 items-center justify-center rounded-full bg-[hsl(215_82%_38%)] text-[0.73rem] font-extrabold text-[hsl(210_40%_98%)]">
                  CU
                </span>
                <div className="hidden leading-none xl:block">
                  <p className="text-[0.72rem] font-extrabold text-[hsl(215_32%_19%)]">Customer User</p>
                  <p className="mt-1 text-[0.61rem] font-medium text-[hsl(215_20%_52%)]">Customer account</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1320px] px-4 pb-12 pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-16">
          {notice ? (
            <div
              aria-live="polite"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[hsl(211_72%_83%)] bg-[hsl(211_82%_94%)] px-4 py-2.5 text-[0.73rem] font-semibold text-[hsl(215_74%_32%)]"
            >
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                className="rounded-md p-1 text-[hsl(215_74%_40%)] hover:bg-[hsl(211_82%_88%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
                onClick={() => setNotice('')}
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          ) : null}

          <section
            aria-labelledby="welcome-heading"
            className="relative isolate overflow-hidden rounded-[1.55rem] bg-[hsl(215_82%_38%)] px-5 py-7 text-[hsl(210_40%_98%)] shadow-[0_24px_50px_-30px_hsl(215_82%_22%/0.65)] sm:px-8 sm:py-8 lg:px-10 lg:py-9"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 -z-10 size-80 rounded-full border-[1.5rem] border-[hsl(199_82%_62%/0.16)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-[23%] -z-10 size-48 rounded-full bg-[hsl(184_85%_64%/0.1)] blur-2xl" />
            <div className="relative max-w-[40rem]">
              <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(184_85%_72%)]">
                RZ HOME APPLIANCES CARE
              </p>
              <h1 id="welcome-heading" className="mt-3 text-[clamp(1.75rem,3.8vw,2.85rem)] font-extrabold leading-[1.04] tracking-[-0.065em]">
                Good morning, Customer User.
              </h1>
              <p className="mt-3 max-w-[33rem] text-[0.83rem] leading-[1.65] text-[hsl(215_24%_86%)] sm:text-[0.9rem]">
                Your home appliance care, all in one place. See what is next, check a booking, or start a new repair when you need us.
              </p>
              <a
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(184_85%_64%)] px-4 text-[0.76rem] font-extrabold text-[hsl(215_74%_23%)] shadow-[0_12px_22px_-14px_hsl(215_82%_12%/0.7)] transition hover:-translate-y-0.5 hover:bg-[hsl(184_85%_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_80%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_82%_38%)]"
                href="/#contact-us"
              >
                Book a Repair
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </div>
            <div aria-hidden="true" className="absolute bottom-6 right-8 hidden items-end gap-2 opacity-70 sm:flex">
              <span className="h-14 w-2 rounded-full bg-[hsl(184_85%_64%/0.32)]" />
              <span className="h-24 w-2 rounded-full bg-[hsl(184_85%_64%/0.2)]" />
              <span className="h-36 w-2 rounded-full bg-[hsl(184_85%_64%/0.12)]" />
            </div>
          </section>

          <section aria-label="Dashboard summary" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((stat) => {
              const Icon = stat.icon;
              const styles = toneStyles[stat.tone];
              return (
                <article
                  className="relative overflow-hidden rounded-[1.1rem] border border-[hsl(214_30%_87%)] bg-[hsl(204_100%_99%)] p-5 shadow-[0_12px_26px_-24px_hsl(215_45%_28%/0.8)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-23px_hsl(215_45%_28%/0.72)]"
                  key={stat.label}
                >
                  <div className={`flex size-9 items-center justify-center rounded-[0.7rem] ${styles.icon}`}>
                    <Icon aria-hidden="true" className="size-[1.05rem] stroke-[1.8]" />
                  </div>
                  <p className="mt-5 text-[0.68rem] font-bold text-[hsl(215_20%_49%)]">{stat.label}</p>
                  <p className="mt-1 text-[1.72rem] font-extrabold leading-none tracking-[-0.065em] text-[hsl(215_32%_16%)]">{stat.value}</p>
                  <p className="mt-2 text-[0.64rem] font-semibold text-[hsl(215_20%_56%)]">{stat.detail}</p>
                  <span className={`absolute bottom-0 left-0 h-1 w-1/3 rounded-r-full ${styles.rule}`} />
                </article>
              );
            })}
          </section>

          <div className="mt-7 grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.82fr)]">
            <section aria-labelledby="bookings-heading" className="min-w-0" id="bookings">
              <SectionHeading action="#bookings" actionLabel="View All Bookings" eyebrow="YOUR ACTIVITY" title="Recent repair bookings" />
              <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[hsl(214_30%_87%)] bg-[hsl(204_100%_99%)] shadow-[0_12px_28px_-25px_hsl(215_45%_28%/0.75)]">
                <div className="hidden grid-cols-[1.2fr_1.2fr_0.9fr_0.78fr_0.55fr] gap-4 border-b border-[hsl(214_30%_90%)] bg-[hsl(210_36%_97%)] px-5 py-3 text-[0.59rem] font-extrabold uppercase tracking-[0.13em] text-[hsl(215_20%_54%)] lg:grid">
                  <span>Booking</span>
                  <span>Service</span>
                  <span>Date</span>
                  <span>Status</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-[hsl(214_30%_91%)]">
                  {recentBookings
                    .filter((booking) => {
                      const query = searchQuery.trim().toLowerCase();
                      return !query || `${booking.id} ${booking.appliance} ${booking.service} ${booking.status}`.toLowerCase().includes(query);
                    })
                    .map((booking) => {
                      const Icon = booking.icon;
                      return (
                        <article className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.2fr_1.2fr_0.9fr_0.78fr_0.55fr] lg:items-center lg:gap-4" key={booking.id}>
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.7rem] bg-[hsl(211_82%_94%)] text-[hsl(215_82%_38%)]">
                              <Icon aria-hidden="true" className="size-[1.05rem] stroke-[1.8]" />
                            </div>
                            <div>
                              <p className="text-[0.77rem] font-extrabold text-[hsl(215_32%_18%)]">{booking.id}</p>
                              <p className="mt-1 text-[0.69rem] font-medium text-[hsl(215_20%_51%)]">{booking.appliance}</p>
                            </div>
                          </div>
                          <div className="hidden lg:block">
                            <p className="text-[0.72rem] font-semibold text-[hsl(215_32%_27%)]">{booking.service}</p>
                          </div>
                          <div className="flex items-center justify-between lg:block">
                            <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[hsl(215_20%_57%)] lg:hidden">Date</span>
                            <p className="text-[0.72rem] font-semibold text-[hsl(215_32%_27%)]">{booking.date}</p>
                          </div>
                          <div className="flex items-center justify-between lg:block">
                            <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[hsl(215_20%_57%)] lg:hidden">Status</span>
                            <StatusPill status={booking.status} />
                          </div>
                          <div className="flex items-center justify-between lg:block lg:text-right">
                            <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[hsl(215_20%_57%)] lg:hidden">Amount</span>
                            <p className="text-[0.78rem] font-extrabold text-[hsl(215_32%_19%)]">{booking.amount}</p>
                          </div>
                        </article>
                      );
                    })}
                  {recentBookings.filter((booking) => {
                    const query = searchQuery.trim().toLowerCase();
                    return !query || `${booking.id} ${booking.appliance} ${booking.service} ${booking.status}`.toLowerCase().includes(query);
                  }).length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm font-bold text-[hsl(215_32%_25%)]">No matching bookings</p>
                      <p className="mt-1 text-xs text-[hsl(215_20%_51%)]">Try a booking number or appliance name.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section aria-labelledby="appointment-heading" className="min-w-0" id="service-requests">
              <SectionHeading eyebrow="NEXT ON THE CALENDAR" title="Upcoming service appointment" />
              <article className="relative mt-4 overflow-hidden rounded-[1.25rem] border border-[hsl(211_72%_83%)] bg-[hsl(211_82%_95%)] p-5 shadow-[0_18px_32px_-27px_hsl(215_55%_30%/0.72)] sm:p-6">
                <div aria-hidden="true" className="absolute -right-9 -top-9 size-28 rounded-full bg-[hsl(199_82%_62%/0.13)]" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-[0.7rem] bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_9px_17px_-12px_hsl(215_82%_20%)]">
                    <CalendarDays aria-hidden="true" className="size-[1.1rem] stroke-[1.8]" />
                  </div>
                  <StatusPill status={upcomingAppointment.status} />
                </div>
                <h2 className="relative mt-5 text-[1.05rem] font-extrabold tracking-[-0.035em] text-[hsl(215_32%_17%)]" id="appointment-heading">
                  {upcomingAppointment.service}
                </h2>
                <div className="relative mt-4 space-y-3 border-t border-[hsl(211_72%_83%)] pt-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(215_74%_38%)]" />
                    <div>
                      <p className="text-[0.74rem] font-bold text-[hsl(215_32%_25%)]">{upcomingAppointment.date}</p>
                      <p className="mt-0.5 text-[0.68rem] font-medium text-[hsl(215_20%_49%)]">{upcomingAppointment.time}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(215_74%_38%)]" />
                    <div>
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[hsl(215_20%_56%)]">Technician</p>
                      <p className="mt-0.5 text-[0.74rem] font-bold text-[hsl(215_32%_25%)]">{upcomingAppointment.technician}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(215_74%_38%)]" />
                    <div>
                      <p className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[hsl(215_20%_56%)]">Address</p>
                      <p className="mt-0.5 text-[0.74rem] font-bold text-[hsl(215_32%_25%)]">{upcomingAppointment.address}</p>
                    </div>
                  </div>
                </div>
                <div className="relative mt-5 flex flex-wrap gap-2">
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[hsl(215_65%_62%/0.58)] bg-[hsl(204_100%_99%/0.65)] px-3 text-[0.68rem] font-extrabold text-[hsl(215_74%_33%)] transition hover:bg-[hsl(204_100%_99%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
                    disabled
                    title="Appointment details will be available when customer data is connected"
                    type="button"
                  >
                    View Details
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[0.68rem] font-extrabold text-[hsl(215_74%_38%)] transition hover:bg-[hsl(211_82%_90%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled
                    title="Rescheduling will be available when customer data is connected"
                    type="button"
                  >
                    Reschedule
                  </button>
                </div>
              </article>
            </section>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
            <section aria-labelledby="quick-actions-heading" id="profile-settings">
              <SectionHeading eyebrow="MAKE IT EASY" title="Quick actions" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: 'Book a New Repair', detail: 'Tell us what needs attention.', icon: Plus, href: '/#contact-us' },
                  { label: 'Track Service Request', detail: 'Follow your active repair.', icon: MapPinned, href: '#service-requests' },
                  { label: 'Contact Support', detail: 'Get a clear answer from our team.', icon: MessageCircle, href: '#support' },
                  { label: 'Update Profile', detail: 'Keep your details current.', icon: Settings2, href: '#profile-settings' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <a
                      className="group flex min-h-[5.1rem] items-center gap-3 rounded-[1.05rem] border border-[hsl(214_30%_87%)] bg-[hsl(204_100%_99%)] px-4 py-3.5 shadow-[0_10px_25px_-25px_hsl(215_45%_28%/0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(211_72%_78%)] hover:shadow-[0_16px_28px_-24px_hsl(215_45%_28%/0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
                      href={action.href}
                      key={action.label}
                      onClick={() => setNotice(`${action.label} is ready for connected customer data.`)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.7rem] bg-[hsl(211_82%_94%)] text-[hsl(215_82%_38%)] transition group-hover:bg-[hsl(215_82%_38%)] group-hover:text-[hsl(210_40%_98%)]">
                        <Icon aria-hidden="true" className="size-[1.05rem] stroke-[1.9]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.75rem] font-extrabold text-[hsl(215_32%_20%)]">{action.label}</span>
                        <span className="mt-1 block truncate text-[0.65rem] font-medium text-[hsl(215_20%_53%)]">{action.detail}</span>
                      </span>
                      <ArrowUpRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-[hsl(215_20%_62%)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[hsl(215_82%_38%)]" />
                    </a>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="support-heading" id="support">
              <SectionHeading eyebrow="WE ARE HERE TO HELP" title="Need a hand?" />
              <article className="mt-4 rounded-[1.25rem] bg-[hsl(215_48%_18%)] p-5 text-[hsl(210_40%_98%)] shadow-[0_20px_38px_-28px_hsl(215_48%_12%/0.85)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[1.03rem] font-extrabold tracking-[-0.035em]" id="support-heading">Talk to RZ Care</h2>
                    <p className="mt-2 max-w-[19rem] text-[0.7rem] leading-[1.6] text-[hsl(215_24%_76%)]">
                      Have a question about a repair? Our team is ready with a practical answer.
                    </p>
                  </div>
                  <span className="flex size-9 items-center justify-center rounded-[0.7rem] bg-[hsl(184_85%_64%/0.14)] text-[hsl(184_85%_70%)]">
                    <HelpCircle aria-hidden="true" className="size-[1.1rem]" />
                  </span>
                </div>
                <div className="mt-5 space-y-2.5 border-t border-[hsl(215_25%_32%)] pt-4">
                  <a
                    className="flex items-center gap-2.5 text-[0.72rem] font-semibold text-[hsl(210_40%_98%)] transition hover:text-[hsl(184_85%_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)]"
                    href="tel:+918073848334"
                  >
                    <Phone aria-hidden="true" className="size-3.5 text-[hsl(184_85%_64%)]" />
                    +91 80738 48334
                  </a>
                  <a
                    className="flex items-center gap-2.5 break-all text-[0.72rem] font-semibold text-[hsl(210_40%_98%)] transition hover:text-[hsl(184_85%_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)]"
                    href="mailto:homeappliancesrestore@gmail.com"
                  >
                    <Mail aria-hidden="true" className="size-3.5 shrink-0 text-[hsl(184_85%_64%)]" />
                    homeappliancesrestore@gmail.com
                  </a>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[hsl(184_85%_64%)] px-3 text-[0.68rem] font-extrabold text-[hsl(215_74%_23%)] transition hover:bg-[hsl(184_85%_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_80%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_18%)]"
                    href="tel:+918073848334"
                  >
                    Contact Support
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </a>
                  <a
                    aria-label="Chat with RZ Care on WhatsApp"
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[hsl(215_25%_38%)] px-3 text-[0.68rem] font-extrabold text-[hsl(210_40%_98%)] transition hover:border-[hsl(184_85%_64%)] hover:text-[hsl(184_85%_70%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)]"
                    href="https://wa.me/918073848334"
                    rel="noreferrer"
                    target="_blank"
                  >
                    WhatsApp
                  </a>
                </div>
              </article>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CustomerDashboard;