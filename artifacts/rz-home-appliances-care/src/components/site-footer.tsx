import { ArrowUpRight, House, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import './site-footer.css';

const quickLinks = [
  { label: 'Home', href: '#top' },
  { label: 'Services', href: '#services' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About us', href: '#about' },
  { label: 'Why choose us', href: '#why-rz-appliances-care' },
  { label: 'Contact us', href: '#contact-us' },
  { label: 'FAQs', href: '#faq' },
] as const;

const serviceLinks = [
  'Washing machine repair',
  'Refrigerator repair',
  'Microwave repair',
  'LED TV repair',
  'AC repair',
] as const;

const portfolioUrl = 'https://jinx-portfolio.pages.dev/';

export function SiteFooter() {
  return (
    <footer className="rz-landing-theme rz-footer" data-testid="site-footer">
      <div className="rz-footer-inner">
        <div className="rz-footer-grid">
          <div className="rz-footer-about">
            <a className="rz-footer-brand" href="#top" aria-label="RZ Fixer Care home" data-testid="footer-brand-link">
              <span className="rz-footer-mark" aria-hidden="true"><House /><ShieldCheck /></span>
              <span>RZ Fixer<span>Care</span></span>
            </a>
            <p>RZ FIXER is an independent appliance repair service run by Siddiq Basha in Bengaluru. We visit your home for repairs.</p>
          </div>

          <nav aria-labelledby="footer-quick-heading">
            <h2 id="footer-quick-heading">Explore</h2>
            <ul>{quickLinks.map(({ label, href }) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
          </nav>

          <nav aria-labelledby="footer-services-heading">
            <h2 id="footer-services-heading">Our services</h2>
            <ul>{serviceLinks.map(label => <li key={label}><a href="#services">{label}</a></li>)}</ul>
          </nav>

          <div className="rz-footer-contact">
            <h2>Get in touch</h2>
            <p className="rz-footer-owner">Siddiq Basha</p>
            <a href="tel:+918073848334" data-testid="footer-phone-link"><Phone size={15} aria-hidden="true" /><span>+91 80738 48334</span></a>
            <a href="mailto:homeappliancesrestore@gmail.com" data-testid="footer-email-link"><Mail size={15} aria-hidden="true" /><span>homeappliancesrestore@gmail.com</span></a>
            <p className="rz-footer-location"><MapPin size={15} aria-hidden="true" /><span>Home visits in Bengaluru,<br />Karnataka</span></p>
          </div>
        </div>

        <div className="rz-footer-bottom">
          <p className="rz-footer-copyright">© {new Date().getFullYear()} RZ FIXER. All rights reserved.</p>
          <div className="rz-footer-credit">
            <p>Designed &amp; developed by <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" data-testid="footer-developer-link">Jinx <ArrowUpRight size={14} aria-hidden="true" /></a></p>
            <p>Need a website for your business? <a href={portfolioUrl} target="_blank" rel="noopener noreferrer">Let’s talk <ArrowUpRight size={14} aria-hidden="true" /></a></p>
          </div>
        </div>

        <svg className="rz-footer-wordmark" viewBox="0 0 1000 210" aria-hidden="true" focusable="false">
          <defs><linearGradient id="rz-footer-text-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#252528" /><stop offset="60%" stopColor="#151518" /><stop offset="100%" stopColor="#09090b" /></linearGradient></defs>
          <text x="0" y="172" textLength="1000" lengthAdjust="spacingAndGlyphs" fill="url(#rz-footer-text-fade)">RZ FIXER</text>
        </svg>
      </div>
    </footer>
  );
}
