import { useEffect, useRef, useState } from 'react';
import { ArrowRight, House, MapPin, Menu, Phone, ShieldCheck, X } from 'lucide-react';
import './landing-hero.css';

type NavigationLink = { label: string; href: string };

export function LandingNavbar({ links }: { links: readonly NavigationLink[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    firstLink.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1200px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

  return (
    <header className={`rz-landing-theme rz-navbar${scrolled ? ' rz-navbar-scrolled' : ''}`}>
      <nav className="rz-nav-inner" aria-label="Primary navigation">
        <a className="rz-brand" href="#top" aria-label="RZ Fixer Care home" onClick={() => setMenuOpen(false)} data-testid="link-brand-home">
          <span className="rz-brand-mark" aria-hidden="true"><House /><ShieldCheck /></span>
          <span className="rz-brand-name">RZ Fixer<span>Care</span></span>
        </a>
        <div className="rz-nav-links">
          {links.map((link) => (
            <a key={link.href} href={link.href} data-testid={`link-${link.label.toLowerCase().replaceAll(' ', '-')}`}>{link.label}</a>
          ))}
        </div>
        <div className="rz-nav-actions">
          <a className="rz-button rz-button-primary rz-nav-cta" href="#contact-us">Book a repair <ArrowRight aria-hidden="true" size={16} /></a>
          <button className="rz-menu-toggle" type="button" ref={menuButton} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-navigation">
            {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </nav>
      <div className="rz-mobile-nav" id="mobile-navigation" hidden={!menuOpen}>
        {links.map((link, index) => (
          <a ref={index === 0 ? firstLink : undefined} key={link.href} href={link.href} onClick={() => setMenuOpen(false)} data-testid={`mobile-link-${index + 1}`}>{link.label}<ArrowRight aria-hidden="true" size={16} /></a>
        ))}
        <a className="rz-button rz-button-primary" href="#contact-us" onClick={() => setMenuOpen(false)}>Book a repair <ArrowRight aria-hidden="true" size={16} /></a>
      </div>
    </header>
  );
}

export function LandingHero() {
  const [dismissedNoticeHeight, setDismissedNoticeHeight] = useState<number | null>(null);
  const serviceAreaRef = useRef<HTMLDivElement>(null);

  return (
    <main className="rz-landing-theme rz-hero-main" aria-labelledby="hero-heading">
      <div className="rz-hero-light" aria-hidden="true">
        <span /><span />
        <span className="rz-hero-beams"><i /><i /><i /></span>
      </div>
      {dismissedNoticeHeight === null ? (
        <div className="rz-service-area" data-testid="text-service-area" ref={serviceAreaRef}>
          <MapPin size={14} aria-hidden="true" />
          <p>Currently serving <strong>Bengaluru, Karnataka only.</strong></p>
          <button
            className="rz-service-area-close"
            type="button"
            aria-label="Dismiss Bengaluru service notice"
            data-testid="button-dismiss-service-area"
            onClick={() => setDismissedNoticeHeight(serviceAreaRef.current?.getBoundingClientRect().height ?? 38)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="rz-service-area-space" style={{ height: dismissedNoticeHeight }} aria-hidden="true" />
      )}
      <section className="rz-hero">
        <div className="rz-hero-dots" aria-hidden="true" />
        <div className="rz-hero-content">
          <div className="rz-hero-badge rz-enter" data-testid="text-local-appliance-experts">
            <span aria-hidden="true"><ShieldCheck size={14} /></span>
            Local appliance experts
          </div>
          <h1 className="rz-hero-heading" id="hero-heading" data-testid="heading-hero">
            <span className="rz-heading-mask"><span className="rz-heading-line">Life runs <span className="rz-gradient-text">better.</span></span></span>
            <span className="rz-heading-mask"><span className="rz-heading-line">When home works.</span></span>
          </h1>
          <p className="rz-hero-description rz-enter" data-testid="text-hero-description">
            Fast, honest appliance repair. Washing machines, refrigerators, microwaves and TVs. <span>We get your home back on track.</span>
          </p>
          <div className="rz-hero-actions rz-enter">
            <a className="rz-button rz-button-primary" href="#contact-us" data-testid="link-request-repair">Request a repair <ArrowRight size={16} aria-hidden="true" /></a>
            <a className="rz-button rz-button-secondary" href="tel:+918073848334" data-testid="link-call-rz-appliances"><Phone size={16} aria-hidden="true" /> Call now</a>
          </div>
        </div>
      </section>
    </main>
  );
}
