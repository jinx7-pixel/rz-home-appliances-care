import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowRight, House, Menu, ShieldCheck, X } from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

const navigationLinks = [
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Why RZ Appliances Care', href: '#why-rz-appliances-care' },
  { label: 'Sign In', href: '#sign-in' },
  { label: 'Contact Us', href: '#contact-us' },
] as const;

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
    <header className="relative z-20 w-full border-b border-[hsl(214_30%_88%/0.86)] bg-[hsl(210_40%_98%/0.94)] shadow-[0_10px_30px_-25px_hsl(215_40%_25%/0.55)] backdrop-blur-xl">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex min-h-[4.75rem] w-full max-w-[1440px] items-center justify-between gap-6 px-5 py-3 sm:px-8 lg:px-12"
      >
        <a
          aria-label="RZ Home Appliances Care home"
          className="group flex min-w-0 items-center gap-3 rounded-xl py-1.5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)]"
          data-testid="link-brand-home"
          href="/"
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
            const isSignIn = link.label === 'Sign In';

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

            if (isSignIn) {
              return (
                <a
                  className="ml-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-[hsl(214_30%_82%)] bg-[hsl(204_100%_99%/0.7)] px-4 text-[0.79rem] font-bold tracking-[0.01em] text-[hsl(215_74%_28%)] transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(215_65%_62%)] hover:bg-[hsl(199_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)] active:translate-y-0"
                  data-testid="link-sign-in"
                  href={link.href}
                  key={link.label}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              );
            }

            return (
              <a
                className="group relative inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-[0.78rem] font-semibold tracking-[0.005em] text-[hsl(215_20%_41%)] transition-colors duration-200 hover:text-[hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(210_40%_98%)]"
                data-testid={`link-${link.label.toLowerCase().replaceAll(' ', '-')}`}
                href={link.href}
                key={link.label}
                onClick={closeMenu}
              >
                {link.label}
                <span className="absolute inset-x-3 bottom-1.5 h-px origin-left scale-x-0 bg-[hsl(199_82%_62%)] transition-transform duration-200 group-hover:scale-x-100" />
              </a>
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
            const isSignIn = link.label === 'Sign In';

            return (
              <a
                className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-[0.9rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(204_100%_99%)] ${
                  isContact
                    ? 'mt-2 bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_10px_22px_-15px_hsl(215_82%_38%)] hover:bg-[hsl(215_82%_32%)]'
                    : isSignIn
                      ? 'mt-2 border border-[hsl(214_30%_82%)] text-[hsl(215_74%_28%)] hover:border-[hsl(215_65%_62%)] hover:bg-[hsl(199_82%_94%)]'
                      : 'text-[hsl(215_20%_35%)] hover:bg-[hsl(199_82%_94%)] hover:text-[hsl(215_82%_38%)]'
                }`}
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
          })}
        </div>
      </div>
    </header>
  );
}

function Home() {
  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[hsl(210_40%_98%)]">
      <HomeNavbar />
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
