import { ArrowRight, House, MapPin } from 'lucide-react';
import './home-visit-section.css';

export function HomeVisitSection() {
  return (
    <section className="rz-landing-theme rz-home-visit" id="location" aria-labelledby="home-visit-heading">
      <div className="rz-home-visit-inner">
        <div className="rz-home-visit-copy">
          <p className="rz-home-visit-eyebrow"><House size={16} aria-hidden="true" /> We come to you</p>
          <h2 id="home-visit-heading">Appliance repairs,<br /><span>at your home.</span></h2>
          <p className="rz-home-visit-description">Share your locality and PIN code. We’ll confirm service availability and arrange a home visit for your appliance repair.</p>
          <p className="rz-home-visit-area"><MapPin size={15} aria-hidden="true" /> Serving Bengaluru, Karnataka</p>
        </div>
        <div className="rz-home-visit-actions">
          <a className="rz-button rz-button-primary" href="#contact-us" data-testid="link-book-home-visit">Book a home visit <ArrowRight size={18} aria-hidden="true" /></a>
          <p>Choose your preferred date and time.<br />Our team will confirm your visit.</p>
        </div>
      </div>
    </section>
  );
}
