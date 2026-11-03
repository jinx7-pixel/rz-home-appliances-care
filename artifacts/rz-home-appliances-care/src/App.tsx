import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { LandingHero, LandingNavbar } from '@/components/landing-hero';
import { ServicesSection } from '@/components/services-section';
import { HowItWorksSection } from '@/components/how-it-works-section';
import { WhyRzSection } from '@/components/why-rz-section';
import { AboutSection } from '@/components/about-section';
import { CustomerReviewsSection } from '@/components/customer-reviews-section';
import { ContactSection } from '@/components/contact-section';
import { FaqSection } from '@/components/faq-section';
import { HomeVisitSection } from '@/components/home-visit-section';
import { SiteFooter } from '@/components/site-footer';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AdminPage,
  ReviewPage,
  ReviewsPage,
} from '@/pages/static-pages';
import { Phone } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const navigationLinks = [
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Why RZ Fixer', href: '#why-rz-appliances-care' },
  { label: 'Contact Us', href: '#contact-us' },
] as const;

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
      className="rz-whatsapp-float group fixed bottom-5 right-5 z-[60] inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_30px_-14px_rgba(37,211,102,0.95)] transition duration-200 hover:-translate-y-1 hover:bg-[#1ebe5d] hover:shadow-[0_20px_34px_-14px_rgba(37,211,102,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-0 sm:bottom-6 sm:right-6 sm:size-auto sm:min-h-14 sm:gap-2.5 sm:rounded-2xl sm:px-5"
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
  return (
    <div className="min-h-[100dvh] w-full scroll-smooth bg-[hsl(210_40%_98%)]" id="top">
      <LandingNavbar links={navigationLinks} />
      <LandingHero />
      <ServicesSection />
      <HowItWorksSection />
      <WhyRzSection />
      <AboutSection />
      <CustomerReviewsSection />
      <ContactSection />
      <FaqSection />
      <HomeVisitSection />
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
