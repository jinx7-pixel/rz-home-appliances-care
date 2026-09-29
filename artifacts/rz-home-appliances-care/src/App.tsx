import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { ReviewCarousel } from '@/components/review-carousel';
import { MenuHoverLink } from '@/components/ui/menu-hover-effects';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AdminPage,
  ReviewPage,
  ReviewsPage,
} from '@/pages/static-pages';
import applianceCareImage from '@assets/ChatGPT_Image_Sep_14,_2026,_03_54_12_PM_1789381955049.png';
import siddiqBashaImage from '@assets/IMG_20260916_205205_1789572132299.jpg';
import {
  ArrowRight,
  Check,
  House,
  Mail,
  MapPin,
  Menu,
  Microwave,
  Phone,
  Refrigerator,
  ShieldCheck,
  Star,
  Tv,
  WashingMachine,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

const navigationLinks = [
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Why RZ Appliances Care', href: '#why-rz-appliances-care' },
  { label: 'Contact Us', href: '#contact-us' },
] as const;

type ServiceCard = {
  label: string;
  title: string;
  description: string;
  accent: string;
  icon: LucideIcon;
  iconLabel: string;
  decoration: string;
};

const serviceCards: ServiceCard[] = [
  {
    label: '01 / SERVICE',
    title: 'All Types of Washing Machine Repair',
    description:
      'Top-load, front-load, semi-automatic, and fully automatic machines diagnosed and repaired.',
    accent: 'bg-[hsl(215_82%_43%)] text-[hsl(210_40%_98%)]',
    icon: WashingMachine,
    iconLabel: 'Washing machine repair',
    decoration:
      'bg-[radial-gradient(circle_at_38%_38%,hsl(199_82%_62%_/_0.28),hsl(199_82%_62%_/_0.08)_62%,transparent_63%)]',
  },
  {
    label: '02 / SERVICE',
    title: 'All Types of Refrigerator Repair',
    description:
      'Careful replacement of faulty appliance parts with clear guidance and dependable workmanship.',
    accent: 'bg-[hsl(188_75%_45%)] text-[hsl(210_40%_98%)]',
    icon: Refrigerator,
    iconLabel: 'Refrigerator repair',
    decoration:
      'bg-[radial-gradient(circle_at_38%_38%,hsl(188_75%_55%_/_0.24),hsl(188_75%_55%_/_0.07)_62%,transparent_63%)]',
  },
  {
    label: '03 / SERVICE',
    title: 'Micro Oven Repair',
    description:
      'Heating, control panel, turntable, sparking, and power issues handled with safety-first care.',
    accent: 'bg-[hsl(215_48%_18%)] text-[hsl(210_40%_98%)]',
    icon: Microwave,
    iconLabel: 'Microwave repair',
    decoration:
      'bg-[radial-gradient(circle_at_38%_38%,hsl(174_54%_66%_/_0.21),hsl(174_54%_66%_/_0.06)_62%,transparent_63%)]',
  },
  {
    label: '04 / SERVICE',
    title: 'LED TV Repair',
    description:
      'Display, sound, backlight, power, and connectivity faults diagnosed for all common LED TVs.',
    accent: 'bg-[hsl(215_82%_43%)] text-[hsl(210_40%_98%)]',
    icon: Tv,
    iconLabel: 'LED TV repair',
    decoration:
      'bg-[radial-gradient(circle_at_38%_38%,hsl(215_82%_62%_/_0.2),hsl(215_82%_62%_/_0.06)_62%,transparent_63%)]',
  },
];

type HowItWorksStep = {
  number: string;
  title: string;
  description: string;
};

const howItWorksSteps: HowItWorksStep[] = [
  {
    number: '01',
    title: 'Tell us what is happening',
    description:
      'Share a few details in the form or give us a call. A real person reviews every request.',
  },
  {
    number: '02',
    title: 'Choose a time that works',
    description:
      'We find a practical appointment window and arrive ready to diagnose the problem.',
  },
  {
    number: '03',
    title: 'Get back to normal',
    description:
      'You get a clear quote before work starts, then a careful fix with no surprises.',
  },
];

const whyRzPoints = [
  'Clear, upfront quotes',
  'Respectful in-home service',
  'Quality replacement parts',
  'A team that answers',
] as const;

const repairServiceOptions = [
  'Washing Machine Repair',
  'Refrigerator Repair',
  'Micro Oven Repair',
  'LED TV Repair',
] as const;

const footerQuickLinks = [
  { label: 'Home', href: '#top' },
  { label: 'Services', href: '#services' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'About Us', href: '#about' },
  { label: 'Why Choose Us', href: '#why-rz-appliances-care' },
  { label: 'Contact Us', href: '#contact-us' },
] as const;

const footerServiceLinks = [
  { label: 'Washing Machine Repair', href: '#services' },
  { label: 'Refrigerator Repair', href: '#services' },
  { label: 'Micro Oven Repair', href: '#services' },
  { label: 'LED TV Repair', href: '#services' },
] as const;

type RepairFormValues = {
  name: string;
  phone: string;
  email: string;
  service: string;
  issue: string;
  address: string;
};

type RepairFormErrors = Partial<Record<keyof RepairFormValues, string>>;

function getRepairRequestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error;
    }
  }

  return 'We could not submit your repair request. Please try again.';
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]"
    >
      <House className="size-[1.25rem] stroke-[1.8]" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[1.05rem] items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-[0.65rem] stroke-[2.4] text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

function HomeNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      menuButtonRef.current?.focus({ preventScroll: true });
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
      <header className="sticky top-0 z-50 w-full border-b border-[hsl(214_30%_88%/0.86)] bg-[hsl(210_40%_98%/0.94)] shadow-[0_10px_30px_-25px_hsl(215_40%_25%/0.55)] backdrop-blur-xl">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex min-h-[4.75rem] w-full max-w-[1440px] items-center justify-between gap-6 px-5 py-3 sm:px-8 lg:px-12"
      >
        <a
          aria-label="RZ Home Appliances Care home"
          className="group flex min-w-0 items-center gap-3 rounded-xl py-1.5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)]"
          data-testid="link-brand-home"
          href="#top"
          onClick={closeMenu}
        >
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate font-sans text-[0.9rem] font-extrabold tracking-[-0.02em] text-[hsl(215_32%_19%)] transition-colors duration-200 group-hover:text-[hsl(215_82%_38%)] sm:text-[0.98rem]">
              RZ Home Appliances
            </span>
            <span className="mt-0.5 block text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">
              Care
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-1.5 lg:flex">
          {navigationLinks.map((link) => {
            const isContact = link.label === 'Contact Us';

            if (isContact) {
              return (
                <a
                  className="ml-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.79rem] font-bold tracking-[0.01em] text-[hsl(210_40%_98%)] shadow-[0_10px_20px_-14px_hsl(215_82%_38%)] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] hover:shadow-[0_14px_24px_-14px_hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-0"
                  data-testid="link-contact-us"
                  href={link.href}
                  key={link.label}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              );
            }

            return (
              <MenuHoverLink
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[0.78rem] font-semibold tracking-[0.005em] text-[hsl(215_74%_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)]"
                data-testid={`link-${link.label.toLowerCase().replaceAll(' ', '-')}`}
                href={link.href}
                key={link.label}
                onClick={closeMenu}
              >
                {link.label}
              </MenuHoverLink>
            );
          })}
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(214_30%_84%)] bg-[hsl(204_100%_99%/0.75)] text-[hsl(215_74%_28%)] transition duration-200 hover:border-[hsl(215_65%_62%)] hover:bg-[hsl(199_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)] lg:hidden"
          data-testid="button-mobile-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
          ref={menuButtonRef}
          type="button"
        >
          {isMenuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </nav>

      <div
        aria-hidden={!isMenuOpen}
        className={`overflow-hidden border-t border-[hsl(214_30%_88%/0.86)] bg-[hsl(204_100%_99%/0.98)] transition-[max-height,opacity,transform] duration-300 ease-out lg:hidden ${
          isMenuOpen
            ? 'pointer-events-auto max-h-[32rem] translate-y-0 opacity-100'
            : 'pointer-events-none max-h-0 -translate-y-2 opacity-0'
        }`}
        id="mobile-navigation"
      >
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-1 px-5 py-4 sm:px-8">
          {navigationLinks.map((link, index) => {
            const isContact = link.label === 'Contact Us';

            if (isContact) {
              return (
                <a
                  className="mt-2 flex min-h-12 items-center justify-between rounded-xl bg-[hsl(215_82%_38%)] px-4 text-[0.9rem] font-semibold text-[hsl(210_40%_98%)] shadow-[0_10px_22px_-15px_hsl(215_82%_38%)] transition duration-200 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_100%_99%)]"
                  data-testid={`mobile-link-${index + 1}`}
                  href={link.href}
                  key={link.label}
                  onClick={closeMenu}
                  tabIndex={isMenuOpen ? 0 : -1}
                >
                  <span>{link.label}</span>
                  <ArrowRight aria-hidden="true" className="size-4" />
                </a>
              );
            }

            return (
              <MenuHoverLink
                className="flex min-h-12 items-center justify-between rounded-xl px-4 text-[0.9rem] font-semibold text-[hsl(215_74%_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_100%_99%)]"
                data-testid={`mobile-link-${index + 1}`}
                endContent={<ArrowRight aria-hidden="true" className="size-4" />}
                href={link.href}
                key={link.label}
                onClick={closeMenu}
                tabIndex={isMenuOpen ? 0 : -1}
              >
                {link.label}
              </MenuHoverLink>
            );
          })}
        </div>
      </div>
    </header>
  );
}

function ServicesSection() {
  return (
    <section
      aria-labelledby="services-heading"
      className="scroll-mt-24 bg-[hsl(210_40%_99.3%)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="services"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[0.82fr_1fr] lg:gap-16 xl:gap-24">
          <div>
            <p
              className="mb-5 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_40%)] sm:text-[0.72rem]"
              data-testid="text-services-eyebrow"
            >
              WHAT WE FIX
            </p>
            <h2
              className="max-w-[12ch] text-[clamp(2.65rem,5.2vw,4.65rem)] font-extrabold leading-[0.98] tracking-[-0.075em] text-[hsl(215_32%_14%)]"
              data-testid="heading-services"
              id="services-heading"
            >
              <span className="block">The essentials,</span>
              <span className="block">handled.</span>
            </h2>
          </div>
          <p
            className="max-w-[38rem] pb-1 text-[1rem] leading-[1.72] tracking-[-0.015em] text-[hsl(215_20%_40%)] sm:text-[1.06rem] lg:justify-self-end"
            data-testid="text-services-description"
          >
            From the first strange sound to the final spin cycle, our technicians bring practical answers and the right parts to every visit.
          </p>
        </header>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 xl:mt-16 xl:grid-cols-4">
          {serviceCards.map((service, index) => {
            const Icon = service.icon;

            return (
              <article
                className={`group relative isolate flex min-h-[27rem] flex-col overflow-hidden rounded-[2rem] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_38px_-28px_hsl(215_45%_28%/0.65)] sm:p-7 ${[
                  'bg-[hsl(212_56%_96%)]',
                  'bg-[hsl(204_67%_95%)]',
                  'bg-[hsl(171_43%_96%)]',
                  'bg-[hsl(219_57%_96%)]',
                ][index]}`}
                data-testid={`card-service-${index + 1}`}
                key={service.title}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-12 -top-12 size-40 rounded-full transition-transform duration-500 group-hover:scale-110 ${service.decoration}`}
                />

                <div
                  aria-label={service.iconLabel}
                  className={`relative z-10 flex size-10 items-center justify-center rounded-[0.7rem] shadow-[0_9px_18px_-14px_hsl(215_50%_24%/0.8)] ${service.accent}`}
                  role="img"
                >
                  <Icon aria-hidden="true" className="size-[1.15rem] stroke-[1.8]" />
                </div>

                <p
                  className="relative z-10 mt-10 text-[0.64rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_43%_56%)]"
                  data-testid={`text-service-label-${index + 1}`}
                >
                  {service.label}
                </p>
                <h3
                  className="relative z-10 mt-4 max-w-[13ch] text-[1.32rem] font-extrabold leading-[1.18] tracking-[-0.045em] text-[hsl(215_42%_18%)]"
                  data-testid={`heading-service-${index + 1}`}
                >
                  {service.title}
                </h3>
                <p
                  className="relative z-10 mt-4 max-w-[23rem] text-[0.88rem] leading-[1.72] text-[hsl(215_24%_42%)]"
                  data-testid={`text-service-description-${index + 1}`}
                >
                  {service.description}
                </p>
                <a
                  aria-label={`Request ${service.title}`}
                  className="group/link relative z-10 mt-auto inline-flex w-fit items-center gap-2 pt-10 text-[0.72rem] font-extrabold text-[hsl(215_74%_38%)] transition-colors duration-200 hover:text-[hsl(215_82%_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4"
                  data-testid={`link-request-service-${index + 1}`}
                  href="#contact-us"
                >
                  Request this service
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-1"
                  />
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-24 bg-[hsl(215_48%_14%)] px-5 py-20 text-[hsl(210_40%_98%)] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="how-it-works"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.62fr)] md:items-end md:gap-16 lg:gap-24">
          <div>
            <p
              className="mb-5 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(184_85%_64%)] sm:text-[0.72rem]"
              data-testid="text-how-it-works-eyebrow"
            >
              THE SIMPLE ROUTE BACK
            </p>
            <h2
              className="max-w-[11ch] text-[clamp(2.65rem,5.2vw,4.65rem)] font-extrabold leading-[0.94] tracking-[-0.075em] text-[hsl(210_40%_98%)]"
              data-testid="heading-how-it-works"
              id="how-it-works-heading"
            >
              <span className="block">Three good steps.</span>
              <span className="block text-[hsl(184_85%_68%)]">No runaround.</span>
            </h2>
          </div>
          <p
            className="max-w-[22rem] pb-1 text-[0.92rem] leading-[1.7] text-[hsl(215_24%_76%)] md:justify-self-end"
            data-testid="text-how-it-works-description"
          >
            You should never need to become an appliance expert to get a straight answer.
          </p>
        </header>

        <div className="mt-11 border-t border-[hsl(215_25%_30%/0.82)] pt-7 sm:mt-12 sm:pt-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-16">
            {howItWorksSteps.map((step) => (
              <article key={step.number} data-testid={`how-it-works-step-${step.number}`}>
                <p
                  className="text-[2.15rem] font-extrabold leading-none tracking-[-0.06em] text-[hsl(184_85%_56%)] sm:text-[2.3rem]"
                  data-testid={`text-how-it-works-number-${step.number}`}
                >
                  {step.number}
                </p>
                <h3
                  className="mt-5 max-w-[15rem] text-[0.98rem] font-extrabold leading-[1.35] text-[hsl(210_40%_98%)] sm:text-[1rem]"
                  data-testid={`heading-how-it-works-step-${step.number}`}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-3 max-w-[19rem] text-[0.84rem] leading-[1.7] text-[hsl(215_24%_73%)]"
                  data-testid={`text-how-it-works-step-${step.number}`}
                >
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyRzSection() {
  return (
    <section
      aria-labelledby="why-rz-heading"
      className="scroll-mt-24 bg-[hsl(204_40%_98%)] px-5 py-20 text-[hsl(215_32%_14%)] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="why-rz-appliances-care"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="max-w-[53rem]">
          <p
            className="mb-6 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)] sm:text-[0.72rem]"
            data-testid="text-why-rz-eyebrow"
          >
            WHY PEOPLE CALL RZ HOME APPLIANCES CARE
          </p>
          <h2
            className="max-w-[11ch] text-[clamp(3rem,6vw,5.65rem)] font-extrabold leading-[0.96] tracking-[-0.08em] text-[hsl(215_32%_14%)]"
            data-testid="heading-why-rz"
            id="why-rz-heading"
          >
            <span className="block">Repair should feel</span>
            <span className="block">reassuring.</span>
          </h2>
          <p
            className="mt-9 max-w-[48rem] text-[1.08rem] leading-[1.72] tracking-[-0.015em] text-[hsl(215_24%_35%)] sm:mt-11 sm:text-[1.18rem]"
            data-testid="text-why-rz-description"
          >
            We are a small, focused team that believes good service is mostly about paying attention. We show up prepared, explain what we find, and respect your home.
          </p>
          <p
            className="mt-5 max-w-[47rem] text-[0.98rem] leading-[1.75] text-[hsl(215_20%_45%)] sm:text-[1.04rem]"
            data-testid="text-why-rz-supporting"
          >
            From diagnosis to the final repair, we focus on clear communication, dependable workmanship, and practical solutions. Whether it&apos;s a washing machine, refrigerator, microwave, or LED TV, we aim to make every service visit simple and stress-free.
          </p>
        </div>

        <ul
          className="mt-10 grid max-w-[54rem] grid-cols-1 gap-x-12 gap-y-5 sm:mt-12 sm:grid-cols-2 sm:gap-y-6 lg:gap-x-20"
          data-testid="list-why-rz-points"
        >
          {whyRzPoints.map((point, index) => (
            <li
              className="flex items-center gap-4 text-[1rem] font-bold text-[hsl(215_32%_28%)] sm:text-[1.08rem]"
              data-testid={`item-why-rz-${index + 1}`}
              key={point}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(170_54%_90%)] text-[hsl(215_74%_42%)]">
                <Check aria-hidden="true" className="size-[1.15rem] stroke-[2.4]" />
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section
      aria-labelledby="about-heading"
      className="relative isolate scroll-mt-24 overflow-hidden bg-[hsl(204_67%_95%)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="about"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 top-16 -z-10 size-80 rounded-full border-[1.5rem] border-[hsl(199_82%_62%/0.13)] sm:size-[26rem]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-[8%] -z-10 size-52 rounded-full bg-[hsl(215_82%_43%/0.07)] blur-3xl"
      />

      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-12 md:gap-16 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1fr)] lg:gap-20 xl:gap-28">
        <figure className="relative mx-auto w-full max-w-[34rem] lg:mx-0">
          <div
            aria-hidden="true"
            className="absolute -inset-4 -z-10 rounded-[2.75rem] bg-[hsl(199_82%_62%/0.18)] blur-2xl sm:-inset-6"
          />
          <div className="relative overflow-hidden rounded-[2rem] border border-[hsl(215_35%_82%/0.75)] bg-[hsl(204_100%_99%)] p-2 shadow-[0_30px_58px_-34px_hsl(215_53%_23%/0.7)] sm:rounded-[2.5rem] sm:p-3">
            <img
              alt="Siddiq Basha, owner of RZ Home Appliances Care"
              className="block h-auto max-h-[45rem] w-full rounded-[1.45rem] object-contain object-top sm:rounded-[2rem]"
              data-testid="img-siddiq-basha"
              height="2028"
              src={siddiqBashaImage}
              width="1080"
            />
            <figcaption className="absolute bottom-5 left-5 rounded-xl border border-[hsl(210_40%_98%/0.7)] bg-[hsl(215_32%_14%/0.88)] px-4 py-3 text-[0.74rem] font-bold text-[hsl(210_40%_98%)] shadow-[0_12px_28px_-18px_hsl(215_53%_23%)] backdrop-blur-md sm:bottom-7 sm:left-7">
              <span className="block text-[0.61rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(199_82%_72%)]">
                Owner
              </span>
              <span className="mt-1 block">Siddiq Basha</span>
            </figcaption>
          </div>
        </figure>

        <div className="max-w-[39rem]">
          <p
            className="mb-5 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_40%)] sm:text-[0.72rem]"
            data-testid="text-about-eyebrow"
          >
            ABOUT US
          </p>
          <h2
            className="max-w-[13ch] text-[clamp(2.65rem,5.2vw,4.65rem)] font-extrabold leading-[0.98] tracking-[-0.075em] text-[hsl(215_32%_14%)]"
            data-testid="heading-about"
            id="about-heading"
          >
            About RZ Home Appliances Care
          </h2>
          <p
            className="mt-7 max-w-[33rem] text-[1.05rem] font-bold leading-[1.52] tracking-[-0.025em] text-[hsl(215_74%_28%)] sm:mt-8 sm:text-[1.16rem]"
            data-testid="text-about-subheading"
          >
            Reliable service. Honest solutions. Care for every home.
          </p>
          <div className="mt-6 max-w-[37rem] space-y-5 text-[0.96rem] leading-[1.78] text-[hsl(215_20%_40%)] sm:mt-7 sm:text-[1rem]">
            <p data-testid="text-about-intro">
              RZ Home Appliances Care is dedicated to providing dependable home appliance repair and maintenance services. Led by Siddiq Basha, our goal is to make appliance care simple, transparent, and stress-free for every customer. From everyday repairs to essential maintenance, we focus on practical solutions, careful workmanship, and service you can trust.
            </p>
            <p data-testid="text-about-supporting">
              We believe every repair should be handled with attention to detail, clear communication, and respect for your home. Our commitment is to help keep your essential appliances working efficiently so you can get back to what matters most.
            </p>
          </div>

          <div className="mt-8 grid max-w-[37rem] gap-3 sm:mt-9 sm:grid-cols-3 sm:gap-2">
            <a
              aria-label="Email RZ Home Appliances Care"
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-[hsl(215_35%_82%/0.8)] bg-[hsl(210_40%_98%/0.72)] px-3.5 text-[0.76rem] font-bold text-[hsl(215_74%_28%)] transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(199_82%_52%/0.75)] hover:bg-[hsl(210_40%_98%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_67%_95%)]"
              data-testid="link-about-email"
              href="mailto:homeappliancesrestore@gmail.com"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)] transition-colors group-hover:bg-[hsl(199_82%_84%)]">
                <Mail aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 truncate">homeappliancesrestore@gmail.com</span>
            </a>
            <a
              aria-label="Call RZ Home Appliances Care"
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-[hsl(215_35%_82%/0.8)] bg-[hsl(210_40%_98%/0.72)] px-3.5 text-[0.78rem] font-bold text-[hsl(215_74%_28%)] transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(199_82%_52%/0.75)] hover:bg-[hsl(210_40%_98%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_67%_95%)]"
              data-testid="link-about-phone"
              href="tel:+918073848334"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)] transition-colors group-hover:bg-[hsl(199_82%_84%)]">
                <Phone aria-hidden="true" className="size-4" />
              </span>
              <span className="whitespace-nowrap">+91 80738 48334</span>
            </a>
            <div
              className="flex min-h-12 items-center gap-3 rounded-xl border border-[hsl(215_35%_82%/0.8)] bg-[hsl(210_40%_98%/0.72)] px-3.5 text-[0.78rem] font-bold text-[hsl(215_74%_28%)]"
              data-testid="text-about-location"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)]">
                <MapPin aria-hidden="true" className="size-4" />
              </span>
              <span>Bengaluru, Karnataka, India</span>
            </div>
          </div>

          <a
            aria-label="Request an appliance repair"
            className="group mt-8 inline-flex min-h-14 items-center gap-4 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.87rem] font-extrabold text-[hsl(210_40%_98%)] shadow-[0_18px_28px_-18px_hsl(215_82%_30%/0.9)] transition duration-200 hover:-translate-y-1 hover:bg-[hsl(215_82%_32%)] hover:shadow-[0_22px_30px_-17px_hsl(215_82%_30%/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_67%_95%)] active:translate-y-0"
            data-testid="link-about-contact"
            href="#contact-us"
          >
            Request a Repair
            <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

function CustomerReviewsSection() {
  const [reviews, setReviews] = useState<Array<{
    reviewId: string;
    rating: number;
    reviewMessage: string;
    customerLabel: string;
    applianceType: string | null;
    isVerified: boolean;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reviews?limit=6', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Reviews are unavailable right now.');
        if (!cancelled) setReviews(body);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Reviews are unavailable right now.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section
      aria-labelledby="customer-reviews-heading"
      className="bg-[hsl(215_48%_14%)] px-5 py-20 text-[hsl(210_40%_98%)] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="customer-reviews"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(184_85%_64%)]">REAL WORDS FROM REAL HOMES</p>
            <h2 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,5.3vw,4.8rem)] font-extrabold leading-[0.94] tracking-[-0.075em]" id="customer-reviews-heading">What Our Customers Say</h2>
          </div>
          <p className="max-w-[21rem] text-[0.92rem] leading-[1.7] text-[hsl(215_24%_76%)]">The best measure of a careful repair is how it feels after we leave.</p>
        </div>
        <div aria-live="polite" className="mt-12">
          {isLoading ? <p className="rounded-2xl border border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] p-8 text-center font-semibold text-[hsl(215_24%_76%)]">Loading customer reviews…</p> : null}
          {error ? <p className="rounded-2xl border border-red-300/40 bg-red-950/30 p-6 text-sm font-semibold text-red-100" role="alert">{error}</p> : null}
          {!isLoading && !error && reviews.length === 0 ? <p className="rounded-2xl border border-dashed border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] p-8 text-center font-semibold text-[hsl(215_24%_76%)]">Approved customer reviews will appear here after moderation.</p> : null}
          {!isLoading && !error ? (
            <ReviewCarousel
              ariaLabel="Customer reviews"
              items={reviews}
              renderItem={(review) => (
                <article className="flex min-h-[16rem] min-w-0 flex-col rounded-[1.7rem] border border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] p-6 transition duration-300 hover:-translate-y-1 hover:border-[hsl(184_85%_64%/0.58)] sm:p-7" data-testid={`card-public-review-${review.reviewId}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span aria-label={`${review.rating} out of 5 stars`} className="inline-flex gap-0.5 text-[hsl(39_86%_60%)]" data-testid={`stars-public-review-${review.reviewId}`}>
                      {[1, 2, 3, 4, 5].map((value) => <Star aria-hidden="true" className={`size-4 ${value <= review.rating ? 'fill-current' : 'text-[hsl(215_25%_36%)]'}`} key={value} />)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(174_54%_28%)] px-2.5 py-1.5 text-[0.62rem] font-extrabold text-[hsl(174_54%_86%)]">
                      <ShieldCheck aria-hidden="true" className="size-3.5" /> Verified Customer
                    </span>
                  </div>
                  <blockquote className="mt-6 break-words text-[1rem] font-semibold leading-[1.65] text-[hsl(210_40%_98%)]">{`“${review.reviewMessage}”`}</blockquote>
                  <div className="mt-auto border-t border-[hsl(215_25%_30%)] pt-5">
                    <p className="text-[0.78rem] font-extrabold text-[hsl(184_85%_72%)]" data-testid={`text-public-review-customer-${review.reviewId}`}>{review.customerLabel}</p>
                    <p className="mt-1 text-[0.72rem] text-[hsl(215_24%_72%)]">{review.applianceType ?? 'Appliance service'}</p>
                  </div>
                </article>
              )}
              testId="carousel-public-reviews-home"
            />
          ) : null}
          {reviews.length >= 6 ? (
            <a
              className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-[hsl(184_85%_64%)] px-4 text-[0.78rem] font-extrabold text-[hsl(184_85%_78%)] transition hover:bg-[hsl(184_85%_64%)] hover:text-[hsl(215_74%_20%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)]"
              href={appPath('/reviews')}
            >
              View All Reviews
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [formValues, setFormValues] = useState<RepairFormValues>({
    name: '',
    phone: '',
    email: '',
    service: '',
    issue: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState<RepairFormErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const pendingSubmission = useRef<{
    serializedBody: string;
    idempotencyKey: string;
  } | null>(null);

  const updateField = (field: keyof RepairFormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage('');
    setSubmitError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionInFlight.current) return;

    const errors: RepairFormErrors = {};
    if (formValues.name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!/^[0-9]{10}$/.test(formValues.phone)) {
      errors.phone = 'Please enter a valid 10-digit phone number.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!repairServiceOptions.includes(formValues.service as (typeof repairServiceOptions)[number])) {
      errors.service = 'Please select an appliance service.';
    }
    if (formValues.issue.trim().length < 10) {
      errors.issue = 'Please describe the problem in at least 10 characters.';
    }
    if (formValues.address.trim().length < 10) {
      errors.address = 'Please enter your complete service address.';
    }

    setFormErrors(errors);
    setSuccessMessage('');
    setSubmitError('');
    if (Object.keys(errors).length > 0) return;

    submissionInFlight.current = true;
    setIsSubmitting(true);
    const requestBody = {
      customerName: formValues.name.trim(),
      phone: formValues.phone,
      email: formValues.email.trim(),
      applianceType: formValues.service,
      problemDescription: formValues.issue.trim(),
      address: formValues.address.trim(),
    };
    const serializedBody = JSON.stringify(requestBody);
    const idempotencyKey =
      pendingSubmission.current?.serializedBody === serializedBody
        ? pendingSubmission.current.idempotencyKey
        : crypto.randomUUID();
    pendingSubmission.current = { serializedBody, idempotencyKey };

    try {
      const response = await fetch('/api/repair-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: serializedBody,
      });
      const payload = (await response.json().catch(() => null)) as
        | { requestId?: string; message?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'We could not save your repair request. Please try again.');
      }

      setSuccessMessage(
        `${payload?.message ?? 'Your repair request was submitted successfully.'} Request ID: ${payload?.requestId ?? 'unavailable'}.`,
      );
      setFormValues({
        name: '',
        phone: '',
        email: '',
        service: '',
        issue: '',
        address: '',
      });
      pendingSubmission.current = null;
    } catch (error) {
      setSubmitError(getRepairRequestErrorMessage(error));
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="contact-heading"
      className="scroll-mt-24 bg-[hsl(210_40%_98%)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="contact-us"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-start lg:gap-20 xl:gap-28">
        <div className="pt-1 lg:pt-8">
          <p
            className="mb-6 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)] sm:text-[0.72rem]"
            data-testid="text-contact-eyebrow"
          >
            START HERE
          </p>
          <h2
            className="max-w-[11ch] text-[clamp(3rem,6vw,5.65rem)] font-extrabold leading-[0.96] tracking-[-0.08em] text-[hsl(215_32%_14%)]"
            data-testid="heading-contact"
            id="contact-heading"
          >
            <span className="block">Let&apos;s get your home</span>
            <span className="block">back on track.</span>
          </h2>
          <p
            className="mt-9 max-w-[34rem] text-[1.08rem] leading-[1.72] text-[hsl(215_24%_35%)] sm:mt-11 sm:text-[1.16rem]"
            data-testid="text-contact-description"
          >
            Tell us what is going on and an RZ Home Appliances Care specialist will be in touch shortly. We usually respond within one business hour.
          </p>

          <div className="mt-10 max-w-[37rem] rounded-[1.6rem] border border-[hsl(215_35%_82%/0.8)] bg-[hsl(204_67%_95%/0.62)] p-5 sm:mt-12 sm:p-7">
            <div className="grid gap-4 text-[0.9rem] text-[hsl(215_32%_28%)]">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)]">
                  <House aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.17em] text-[hsl(215_20%_50%)]">
                    CONTACT PERSON
                  </p>
                  <p className="mt-1 font-bold">Siddiq Basha</p>
                </div>
              </div>
              <a
                aria-label="Email RZ Home Appliances Care"
                className="flex items-start gap-3 rounded-xl transition-colors hover:text-[hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(204_67%_95%)]"
                data-testid="link-contact-email"
                href="mailto:homeappliancesrestore@gmail.com"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)]">
                  <Mail aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.17em] text-[hsl(215_20%_50%)]">
                    EMAIL
                  </p>
                  <p className="mt-1 break-all font-bold">homeappliancesrestore@gmail.com</p>
                </div>
              </a>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)]">
                  <MapPin aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.17em] text-[hsl(215_20%_50%)]">
                    LOCATION
                  </p>
                  <p className="mt-1 font-bold">Bengaluru, Karnataka, India</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4 border-t border-[hsl(215_35%_82%/0.8)] pt-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(170_54%_90%)] text-[hsl(215_74%_42%)]">
                <Phone aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.17em] text-[hsl(215_20%_50%)]">
                  PREFER TO TALK?
                </p>
                <a
                  className="mt-1 block text-[1.05rem] font-extrabold text-[hsl(215_74%_38%)] transition-colors hover:text-[hsl(215_82%_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(204_67%_95%)]"
                  data-testid="link-contact-phone"
                  href="tel:+918073848334"
                >
                  +91 80738 48334
                </a>
              </div>
            </div>
          </div>
        </div>

        <form
          className="rounded-[1.8rem] border border-[hsl(215_35%_82%/0.85)] bg-[hsl(204_67%_95%/0.54)] p-5 shadow-[0_28px_60px_-42px_hsl(215_53%_23%/0.65)] sm:rounded-[2.1rem] sm:p-8 lg:p-9"
          data-testid="form-repair-request"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[hsl(215_35%_82%/0.85)] pb-6">
            <div>
              <h3 className="text-[1.7rem] font-extrabold tracking-[-0.055em] text-[hsl(215_32%_14%)] sm:text-[2rem]">
                Request a repair
              </h3>
              <p className="mt-2 text-[0.92rem] text-[hsl(215_20%_45%)]">
                A few details are all we need.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[hsl(170_54%_90%)] px-3 py-2 text-[0.61rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_74%_38%)]">
              FREE ESTIMATE
            </span>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-name">
                Your name
              </label>
              <input
                aria-describedby={formErrors.name ? 'repair-name-error' : undefined}
                aria-invalid={Boolean(formErrors.name)}
                autoComplete="name"
                className="mt-2 min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
                id="repair-name"
                maxLength={100}
                name="name"
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Alex Morgan"
                required
                value={formValues.name}
              />
              {formErrors.name ? (
                <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-name-error">
                  {formErrors.name}
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-phone">
                Phone number
              </label>
              <input
                aria-describedby={formErrors.phone ? 'repair-phone-error' : undefined}
                aria-invalid={Boolean(formErrors.phone)}
                autoComplete="tel"
                className="mt-2 min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
                id="repair-phone"
                inputMode="numeric"
                maxLength={10}
                name="phone"
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="10-digit phone number"
                pattern="[0-9]{10}"
                required
                type="tel"
                value={formValues.phone}
              />
              {formErrors.phone ? (
                <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-phone-error">
                  {formErrors.phone}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-email">
              Email address
            </label>
            <input
              aria-describedby={formErrors.email ? 'repair-email-error' : undefined}
              aria-invalid={Boolean(formErrors.email)}
              autoComplete="email"
              className="mt-2 min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
              id="repair-email"
              maxLength={254}
              name="email"
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="alex@example.com"
              required
              type="email"
              value={formValues.email}
            />
            {formErrors.email ? (
              <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-email-error">
                {formErrors.email}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-service">
              Select a service
            </label>
            <select
              aria-describedby={formErrors.service ? 'repair-service-error' : undefined}
              aria-invalid={Boolean(formErrors.service)}
              className="mt-2 min-h-14 w-full appearance-none rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
              id="repair-service"
              name="service"
              onChange={(event) => updateField('service', event.target.value)}
              required
              value={formValues.service}
            >
              <option disabled value="">
                Choose the appliance service
              </option>
              {repairServiceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
            {formErrors.service ? (
              <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-service-error">
                {formErrors.service}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-issue">
              What is happening?
            </label>
            <textarea
              aria-describedby={formErrors.issue ? 'repair-issue-error' : undefined}
              aria-invalid={Boolean(formErrors.issue)}
              className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 py-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
              id="repair-issue"
              maxLength={2000}
              minLength={10}
              name="issue"
              onChange={(event) => updateField('issue', event.target.value)}
              placeholder="My washing machine is..."
              required
              value={formValues.issue}
            />
            {formErrors.issue ? (
              <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-issue-error">
                {formErrors.issue}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <label className="text-[0.88rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="repair-address">
              Complete address
            </label>
            <textarea
              aria-describedby={formErrors.address ? 'repair-address-error' : undefined}
              aria-invalid={Boolean(formErrors.address)}
              autoComplete="street-address"
              className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] px-4 py-4 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]"
              id="repair-address"
              maxLength={500}
              minLength={10}
              name="address"
              onChange={(event) => updateField('address', event.target.value)}
              placeholder="House number, street, area, Bengaluru"
              required
              value={formValues.address}
            />
            {formErrors.address ? (
              <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id="repair-address-error">
                {formErrors.address}
              </p>
            ) : null}
          </div>

          <button
            className="group mt-6 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_43%)] px-5 text-[0.96rem] font-extrabold text-[hsl(210_40%_98%)] shadow-[0_18px_30px_-18px_hsl(215_82%_30%/0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(215_82%_36%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(204_67%_95%)] active:translate-y-0"
            data-testid="button-submit-repair-request"
             disabled={isSubmitting}
            type="submit"
          >
             {isSubmitting ? 'Saving your request...' : 'Send my repair request'}
            <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <p className="mt-4 text-center text-[0.78rem] leading-6 text-[hsl(215_20%_48%)]">
            By submitting, you agree to be contacted about your repair request.
          </p>
          {successMessage ? (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl bg-[hsl(170_54%_90%)] px-4 py-3 text-center text-[0.82rem] font-bold text-[hsl(215_74%_32%)]"
              data-testid="text-repair-request-success"
            >
              {successMessage}
            </p>
          ) : null}
          {submitError ? (
            <p
              aria-live="assertive"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[0.82rem] font-bold text-red-700"
              data-testid="text-repair-request-error"
            >
              {submitError}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function LocationSection() {
  return (
    <section
      aria-labelledby="location-heading"
      className="scroll-mt-24 bg-[hsl(204_40%_98%)] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      id="location"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] lg:gap-20 xl:gap-28">
        <div>
          <p
            className="mb-6 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)] sm:text-[0.72rem]"
            data-testid="text-location-eyebrow"
          >
            FIND US
          </p>
          <h2
            className="max-w-[11ch] text-[clamp(3rem,6vw,5.65rem)] font-extrabold leading-[0.96] tracking-[-0.08em] text-[hsl(215_32%_14%)]"
            data-testid="heading-location"
            id="location-heading"
          >
            <span className="block">Serving Bengaluru,</span>
            <span className="block">one repair at a time.</span>
          </h2>
          <p
            className="mt-9 max-w-[35rem] text-[1.05rem] leading-[1.72] text-[hsl(215_24%_35%)] sm:mt-11 sm:text-[1.12rem]"
            data-testid="text-location-description"
          >
            RZ Home Appliances Care proudly serves customers across Bengaluru, Karnataka. Get in touch with our team to discuss your appliance repair needs and service availability in your area.
          </p>

          <div className="mt-8 flex items-start gap-4 rounded-2xl border border-[hsl(215_35%_82%/0.8)] bg-[hsl(204_67%_95%/0.62)] p-5 sm:mt-10 sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(199_82%_90%)] text-[hsl(199_82%_38%)]">
              <MapPin aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.17em] text-[hsl(215_20%_50%)]">
                RZ HOME APPLIANCES CARE
              </p>
              <p className="mt-1 font-bold text-[hsl(215_32%_28%)]">
                Bengaluru, Karnataka, India
              </p>
            </div>
          </div>

          <a
            className="group mt-7 inline-flex min-h-14 items-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.87rem] font-extrabold text-[hsl(210_40%_98%)] shadow-[0_18px_28px_-18px_hsl(215_82%_30%/0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(204_40%_98%)] active:translate-y-0"
            data-testid="link-open-google-maps"
            href="https://www.google.com/maps/search/?api=1&query=Bengaluru%2C%20Karnataka%2C%20India"
            rel="noreferrer"
            target="_blank"
          >
            Open in Google Maps
            <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-[hsl(215_35%_82%/0.85)] bg-[hsl(204_100%_99%)] p-2 shadow-[0_28px_60px_-38px_hsl(215_53%_23%/0.65)] sm:rounded-[2.5rem] sm:p-3">
          <iframe
            className="block aspect-[4/3] min-h-[20rem] w-full rounded-[1.5rem] border-0 sm:aspect-[16/11] sm:rounded-[2rem]"
            data-testid="iframe-bengaluru-map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=Bengaluru%2C%20Karnataka%2C%20India&output=embed"
            title="Map showing Bengaluru, Karnataka, India"
          />
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer
      className="bg-[hsl(215_48%_14%)] px-5 py-16 text-[hsl(210_40%_98%)] sm:px-8 sm:py-20 lg:px-12 lg:py-24"
      data-testid="site-footer"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.28fr_0.78fr_1fr_1fr] lg:gap-12 xl:gap-20">
          <div className="max-w-[22rem]">
            <a
              aria-label="RZ Home Appliances Care home"
              className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_68%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(215_48%_14%)]"
              data-testid="footer-brand-link"
              href="#top"
            >
              <BrandMark />
              <span>
                <span className="block text-[0.98rem] font-extrabold tracking-[-0.02em]">
                  RZ Home Appliances
                </span>
                <span className="mt-0.5 block text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_24%_72%)]">
                  Care
                </span>
              </span>
            </a>
            <span className="mt-6 block h-1 w-12 rounded-full bg-[hsl(184_85%_64%)]" />
            <p className="mt-6 text-[0.92rem] leading-[1.75] text-[hsl(215_24%_76%)]">
              Reliable home appliance repair and maintenance services in Bengaluru. We help keep your essential appliances working smoothly with practical solutions and dependable service.
            </p>
          </div>

          <div>
            <h2 className="text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(184_85%_64%)]">
              Quick Links
            </h2>
            <nav aria-label="Footer quick links" className="mt-6">
              <ul className="grid gap-3">
                {footerQuickLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      className="inline-flex min-h-8 items-center text-[0.9rem] font-semibold text-[hsl(215_24%_82%)] transition-colors hover:text-[hsl(184_85%_68%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_68%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_14%)]"
                      data-testid={`footer-quick-link-${link.label.toLowerCase().replaceAll(' ', '-')}`}
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h2 className="text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(184_85%_64%)]">
              Our Services
            </h2>
            <nav aria-label="Footer service links" className="mt-6">
              <ul className="grid gap-3">
                {footerServiceLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      className="inline-flex min-h-8 items-center text-[0.9rem] font-semibold text-[hsl(215_24%_82%)] transition-colors hover:text-[hsl(184_85%_68%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_68%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_14%)]"
                      data-testid={`footer-service-link-${link.label.toLowerCase().replaceAll(' ', '-')}`}
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h2 className="text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(184_85%_64%)]">
              Contact Us
            </h2>
            <div className="mt-6 grid gap-4 text-[0.9rem] text-[hsl(215_24%_82%)]">
              <p className="font-bold text-[hsl(210_40%_98%)]">Siddiq Basha</p>
              <a
                className="flex items-start gap-3 transition-colors hover:text-[hsl(184_85%_68%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_68%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_14%)]"
                data-testid="footer-phone-link"
                href="tel:+918073848334"
              >
                <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(184_85%_64%)]" />
                <span>+91 80738 48334</span>
              </a>
              <a
                className="flex items-start gap-3 break-all transition-colors hover:text-[hsl(184_85%_68%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_68%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_48%_14%)]"
                data-testid="footer-email-link"
                href="mailto:homeappliancesrestore@gmail.com"
              >
                <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(184_85%_64%)]" />
                <span>homeappliancesrestore@gmail.com</span>
              </a>
              <div className="flex items-start gap-3">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[hsl(184_85%_64%)]" />
                <span>Bengaluru, Karnataka, India</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[hsl(215_25%_30%/0.9)] pt-6 text-[0.78rem] text-[hsl(215_24%_70%)] sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 RZ Home Appliances Care. All rights reserved.</p>
          <p>Serving Bengaluru with care.</p>
        </div>
      </div>
    </footer>
  );
}

function WhatsAppLogo() {
  return (
    <span aria-hidden="true" className="relative inline-flex size-7 items-center justify-center">
      <svg
        className="absolute inset-0 size-7"
        fill="none"
        viewBox="0 0 32 32"
      >
        <path
          d="M16 3.75a12.25 12.25 0 0 0-10.56 18.47L4 27.5l5.36-1.4A12.25 12.25 0 1 0 16 3.75Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
        />
      </svg>
      <Phone className="relative size-3.5 rotate-[-16deg] stroke-[2.6]" />
    </span>
  );
}

function WhatsAppFloatButton() {
  return (
    <a
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-5 right-5 z-[60] inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_30px_-14px_rgba(37,211,102,0.95)] transition duration-200 hover:-translate-y-1 hover:bg-[#1ebe5d] hover:shadow-[0_20px_34px_-14px_rgba(37,211,102,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-0 sm:bottom-6 sm:right-6 sm:size-auto sm:min-h-14 sm:gap-2.5 sm:rounded-2xl sm:px-5"
      data-testid="floating-whatsapp-button"
      href="https://wa.me/918073848334"
      rel="noreferrer"
      target="_blank"
    >
      <WhatsAppLogo />
      <span className="hidden text-[0.82rem] font-extrabold sm:inline">Chat on WhatsApp</span>
      <span className="pointer-events-none absolute bottom-full right-0 mb-3 hidden whitespace-nowrap rounded-lg bg-[hsl(215_32%_14%)] px-3 py-2 text-[0.72rem] font-bold text-white shadow-lg group-hover:block group-focus-visible:block">
        Chat with us on WhatsApp
      </span>
    </a>
  );
}

function Home() {
  const [isServiceAreaDialogOpen, setIsServiceAreaDialogOpen] = useState(true);

  return (
    <div className="min-h-[100dvh] w-full scroll-smooth bg-[hsl(210_40%_98%)]" id="top">
      <Dialog open={isServiceAreaDialogOpen} onOpenChange={setIsServiceAreaDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[31rem] rounded-[1.5rem] border-[hsl(210_35%_88%)] bg-[hsl(210_40%_98%)] p-6 shadow-[0_30px_80px_-34px_hsl(215_53%_23%/0.75)] sm:p-8">
          <DialogHeader className="pr-7 text-left">
            <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-[hsl(199_82%_90%/0.7)] text-[hsl(199_82%_43%)]">
              <MapPin aria-hidden="true" className="size-5" />
            </div>
            <DialogTitle className="text-[1.45rem] font-extrabold tracking-[-0.04em] text-[hsl(215_32%_14%)]">
              Service available in Bengaluru
            </DialogTitle>
            <DialogDescription className="pt-2 text-[0.98rem] leading-7 text-[hsl(215_20%_42%)]">
              RZ Home Appliances Care currently serves Bengaluru, Karnataka only. You are welcome to browse our services and submit a request.
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <button
              className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white transition hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-px"
              data-testid="button-dismiss-service-area-dialog"
              type="button"
            >
              Continue to website
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <HomeNavbar />
      <main
        aria-labelledby="hero-heading"
        className="relative isolate overflow-hidden bg-[hsl(210_40%_98%)] bg-[linear-gradient(to_right,hsl(215_35%_82%_/_0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(215_35%_82%_/_0.3)_1px,transparent_1px)] [background-size:3.25rem_3.25rem]"
      >
        <div className="mx-auto grid min-h-[calc(100dvh-4.75rem)] w-full max-w-[1440px] grid-cols-1 items-center gap-12 px-5 py-12 sm:px-8 sm:py-16 md:gap-14 md:py-20 lg:grid-cols-[0.82fr_1fr] lg:gap-16 lg:px-12 lg:py-14 xl:gap-24">
          <section className="flex max-w-[39rem] flex-col justify-center lg:py-8">
            <div
              className="mb-8 inline-flex w-fit items-center gap-3 rounded-full border border-[hsl(215_36%_84%)] bg-[hsl(210_40%_98%_/_0.78)] px-4 py-2.5 shadow-[0_10px_24px_-20px_hsl(215_55%_34%/0.7)] backdrop-blur-sm sm:mb-10"
              data-testid="text-local-appliance-experts"
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[hsl(199_82%_48%)] shadow-[0_0_0_4px_hsl(199_82%_62%/0.13)]"
              />
              <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(215_70%_37%)] sm:text-[0.72rem]">
                LOCAL APPLIANCE EXPERTS
              </span>
            </div>

            <p
              className="mb-5 text-[0.91rem] font-extrabold tracking-[-0.025em] text-[hsl(215_82%_38%)] sm:mb-6 sm:text-[1.02rem]"
              data-testid="text-brand-label"
            >
              RZ Home Appliances Care
            </p>

            <h1
              className="max-w-[11ch] text-[clamp(3.65rem,8vw,7.9rem)] font-extrabold leading-[0.88] tracking-[-0.075em] text-[hsl(215_32%_14%)] lg:max-w-none lg:text-[clamp(4.5rem,6.6vw,6.7rem)]"
              data-testid="heading-hero"
              id="hero-heading"
            >
              <span className="block">Life runs</span>
              <span className="block">
                <span className="text-[hsl(215_82%_43%)]">better</span> when
              </span>
              <span className="block">home works.</span>
            </h1>

            <p
              className="mt-8 max-w-[34rem] text-[1.03rem] leading-[1.7] tracking-[-0.015em] text-[hsl(215_20%_40%)] sm:mt-10 sm:text-[1.1rem]"
              data-testid="text-hero-description"
            >
              Fast, honest appliance repair for the moments you cannot put on hold. We get your washing machine, refrigerator, AC, and everyday essentials back on track.
            </p>

            <div className="mt-9 flex flex-col items-start gap-5 sm:mt-11 sm:flex-row sm:items-center sm:gap-7">
              <a
                className="group inline-flex min-h-14 items-center gap-4 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.87rem] font-extrabold text-[hsl(210_40%_98%)] shadow-[0_18px_28px_-18px_hsl(215_82%_30%/0.9)] transition duration-200 hover:-translate-y-1 hover:bg-[hsl(215_82%_32%)] hover:shadow-[0_22px_30px_-17px_hsl(215_82%_30%/0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-0"
                data-testid="link-request-repair"
                href="#contact-us"
              >
                Request a repair
                <ArrowRight aria-hidden="true" className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              <a
                className="group inline-flex min-h-11 items-center gap-3 rounded-xl px-1 py-2 text-[0.9rem] font-bold text-[hsl(215_32%_28%)] transition-colors duration-200 hover:text-[hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)]"
                data-testid="link-call-rz-appliances"
                href="tel:+918073848334"
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-[hsl(199_82%_62%/0.55)] bg-[hsl(199_82%_90%/0.5)] text-[hsl(199_82%_43%)] transition-colors duration-200 group-hover:border-[hsl(199_82%_52%)] group-hover:bg-[hsl(199_82%_90%)]">
                  <Phone aria-hidden="true" className="size-[1.05rem]" />
                </span>
                <span>Call +91 80738 48334</span>
              </a>
            </div>
          </section>

          <figure className="relative w-full lg:pl-1">
            <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-[hsl(199_82%_62%/0.12)] blur-2xl sm:-inset-6" />
            <div className="overflow-hidden rounded-[1.8rem] border border-[hsl(210_35%_88%)] bg-[hsl(204_100%_99%)] shadow-[0_30px_55px_-32px_hsl(215_53%_23%/0.7)] sm:rounded-[2.25rem]">
              <img
                alt="RZ Home Appliances Care technician repairing a washing machine in a home appliance showroom"
                className="block aspect-square w-full object-cover"
                data-testid="img-appliance-technician"
                height="1024"
                src={applianceCareImage}
                width="1024"
              />
            </div>
          </figure>
        </div>
      </main>
      <ServicesSection />
      <HowItWorksSection />
      <WhyRzSection />
      <AboutSection />
      <CustomerReviewsSection />
      <ContactSection />
      <LocationSection />
      <SiteFooter />
      <WhatsAppFloatButton />
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/customer/review/:sourceType/:sourceId" component={ReviewPage} />
        <Route path="/customer/review" component={ReviewPage} />
        <Route path="/reviews" component={ReviewsPage} />
        <Route path="/admin/login" component={AdminPage} />
        <Route path="/admin/dashboard" component={AdminPage} />
        <Route path="/admin/reviews" component={AdminPage} />
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function WebsiteAvailabilityGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isAdminRoute = location === '/admin' || location.startsWith('/admin/');
  const [isChecking, setIsChecking] = useState(!isAdminRoute);
  const [websiteEnabled, setWebsiteEnabled] = useState(true);

  useEffect(() => {
    if (isAdminRoute) {
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    setIsChecking(true);
    fetch('/api/site-status', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Website availability could not be checked.');
        }
        if (!cancelled) setWebsiteEnabled(body.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setWebsiteEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdminRoute]);

  if (isAdminRoute) return <>{children}</>;

  if (isChecking) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_98%)] px-6 text-center">
        <p className="font-extrabold text-[hsl(215_74%_28%)]">Checking website availability…</p>
      </main>
    );
  }

  if (!websiteEnabled) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_98%)] px-6 py-12 text-center">
        <section className="max-w-[560px] rounded-[2rem] border border-red-200 bg-white p-8 shadow-[0_24px_60px_-42px_hsl(215_53%_23%/0.55)] sm:p-12">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.22em] text-red-700">Temporarily unavailable</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.06em] text-[hsl(215_32%_14%)] sm:text-5xl">Website is currently offline.</h1>
          <p className="mt-5 text-[0.98rem] leading-7 text-[hsl(215_20%_45%)]">
            We are carrying out maintenance. Please try again later.
          </p>
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800" role="alert">
            Error: WEBSITE_OFFLINE
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <WebsiteAvailabilityGate>
          <Router />
        </WebsiteAvailabilityGate>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
