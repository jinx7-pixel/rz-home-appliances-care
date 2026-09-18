import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  House,
  MapPin,
  Menu,
  Microwave,
  Phone,
  Refrigerator,
  ShieldCheck,
  Tv,
  WashingMachine,
  Wrench,
  X,
} from "lucide-react";

import "./RzHomeAppliancesSplitHero.css";

type Service = {
  name: string;
  detail: string;
  icon: typeof WashingMachine;
};

const services: Service[] = [
  { name: "Washing machines", detail: "Front-load, top-load and semi-automatic", icon: WashingMachine },
  { name: "Refrigerators", detail: "Cooling, gas and compressor issues", icon: Refrigerator },
  { name: "Microwave ovens", detail: "Heating, power and control panels", icon: Microwave },
  { name: "LED televisions", detail: "Display, sound and connectivity", icon: Tv },
];

const navItems = [
  { label: "Services", href: "#services" },
  { label: "Our approach", href: "#approach" },
  { label: "About Siddiq", href: "#about" },
];

function BrandLockup() {
  return (
    <a className="rz-brand" href="#top" aria-label="RZ Home Appliances Care home">
      <span className="rz-mark" aria-hidden="true">
        <House size={18} strokeWidth={1.8} />
        <span className="rz-mark-badge">
          <ShieldCheck size={10} strokeWidth={2.6} />
        </span>
      </span>
      <span className="rz-brand-copy">
        <strong>RZ Home Appliances</strong>
        <small>Care</small>
      </span>
    </a>
  );
}

export function RzHomeAppliancesSplitHero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("Washing machines");
  const [submitted, setSubmitted] = useState(false);

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="rz-page" id="top">
      <header className="rz-header">
        <BrandLockup />
        <nav className={menuOpen ? "rz-nav is-open" : "rz-nav"} aria-label="Primary navigation">
          {navItems.map((item) => (
            <a href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <a className="rz-nav-cta" href="#request" onClick={() => setMenuOpen(false)}>
            Request a repair <ArrowRight size={15} />
          </a>
        </nav>
        <div className="rz-header-meta">
          <span className="rz-live-dot" />
          <span>Serving Bengaluru</span>
        </div>
        <button
          className="rz-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>

      <main>
        <section className="rz-hero" aria-labelledby="rz-hero-heading">
          <aside className="rz-hero-rail">
            <span className="rz-rail-label">Local appliance specialists</span>
            <span className="rz-rail-line" />
            <span className="rz-rail-city">BLR / 560001</span>
          </aside>

          <div className="rz-hero-copy">
            <p className="rz-kicker">Repair, without the runaround.</p>
            <h1 id="rz-hero-heading">
              Keep home
              <span>in motion.</span>
            </h1>
            <p className="rz-hero-intro">
              Fast, honest appliance repair for the moments you cannot put on hold. A
              prepared technician, a clear quote, and a fix that respects your home.
            </p>
            <div className="rz-hero-actions">
              <a className="rz-primary-button" href="#request">
                Tell us what happened <ArrowRight size={18} />
              </a>
              <a className="rz-call-link" href="tel:+918073848334">
                <span className="rz-call-icon"><Phone size={16} /></span>
                <span>
                  <small>Talk to a real person</small>
                  +91 80738 48334
                </span>
              </a>
            </div>
            <div className="rz-proof-row" aria-label="Service promise">
              <span><Check size={14} /> Upfront quotes</span>
              <span><Check size={14} /> Respectful in-home service</span>
            </div>
          </div>

          <figure className="rz-hero-visual">
            <img
              src="/__mockup/images/rz-split-hero-technician.png"
              alt="Technician checking a washing machine in a bright utility room"
            />
            <div className="rz-image-wash" aria-hidden="true" />
            <div className="rz-image-caption">
              <span className="rz-caption-icon"><Wrench size={16} /></span>
              <span><strong>Ready for the next call</strong><small>Prepared parts. Practical answers.</small></span>
            </div>
            <div className="rz-availability-card">
              <span className="rz-availability-mark"><Clock3 size={15} /></span>
              <span><small>Typical reply time</small><strong>Within 1 hour</strong></span>
            </div>
            <figcaption>01 / ON-SITE CARE</figcaption>
          </figure>
        </section>

        <section className="rz-services" id="services" aria-labelledby="rz-services-heading">
          <div className="rz-section-heading">
            <p className="rz-kicker">What we fix</p>
            <h2 id="rz-services-heading">The essentials,<br /><em>handled.</em></h2>
            <p>Choose an appliance to see the kind of care our team brings to every visit.</p>
          </div>
          <div className="rz-service-list">
            {services.map((service, index) => {
              const Icon = service.icon;
              const isSelected = selectedService === service.name;
              return (
                <button
                  className={isSelected ? "rz-service-row is-selected" : "rz-service-row"}
                  key={service.name}
                  type="button"
                  onClick={() => setSelectedService(service.name)}
                  aria-pressed={isSelected}
                >
                  <span className="rz-service-number">0{index + 1}</span>
                  <span className="rz-service-icon"><Icon size={20} strokeWidth={1.7} /></span>
                  <span className="rz-service-name"><strong>{service.name}</strong><small>{service.detail}</small></span>
                  <ArrowRight className="rz-service-arrow" size={19} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="rz-approach" id="approach" aria-labelledby="rz-approach-heading">
          <div className="rz-approach-stamp">RZ<br />CARE</div>
          <div className="rz-approach-title">
            <p className="rz-kicker">The simple route back</p>
            <h2 id="rz-approach-heading">No jargon.<br /><span>No surprises.</span></h2>
          </div>
          <div className="rz-approach-steps">
            <article><span>01</span><div><h3>Tell us what is happening</h3><p>A few details in the form or a quick call gives us a useful starting point.</p></div></article>
            <article><span>02</span><div><h3>Choose a time that works</h3><p>We find a practical window and arrive ready to diagnose the problem.</p></div></article>
            <article><span>03</span><div><h3>Get back to normal</h3><p>You get a clear quote before work starts, then a careful fix.</p></div></article>
          </div>
        </section>

        <section className="rz-request" id="request" aria-labelledby="rz-request-heading">
          <div className="rz-request-intro">
            <p className="rz-kicker">Start a repair request</p>
            <h2 id="rz-request-heading">Tell us where<br /><span>it hurts.</span></h2>
            <p>We currently serve Bengaluru, Karnataka. Share the basics and Siddiq&apos;s team will be in touch.</p>
            <div className="rz-location-note"><MapPin size={16} /><span><strong>Bengaluru, Karnataka</strong><small>In-home appointments, Monday–Saturday</small></span></div>
          </div>
          <form className="rz-request-form" onSubmit={submitRequest}>
            <label>Your name<input name="name" placeholder="How should we address you?" required /></label>
            <label>Phone number<input name="phone" type="tel" placeholder="10-digit phone number" required /></label>
            <label>What needs attention?
              <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)} name="service">
                {services.map((service) => <option key={service.name}>{service.name}</option>)}
              </select>
            </label>
            <label className="rz-field-wide">A quick description<textarea name="issue" placeholder="What are you noticing?" rows={3} /></label>
            {submitted ? <p className="rz-form-success" role="status"><Check size={16} /> Thanks — your preview request is ready for the team.</p> : null}
            <button className="rz-primary-button" type="submit">{submitted ? "Request saved" : "Preview repair request"} <ArrowRight size={18} /></button>
          </form>
        </section>
      </main>

      <footer className="rz-footer" id="about">
        <BrandLockup />
        <p>Reliable service. Honest solutions. Care for every home.</p>
        <a href="mailto:homeappliancesrestore@gmail.com">homeappliancesrestore@gmail.com</a>
      </footer>
    </div>
  );
}

export default RzHomeAppliancesSplitHero;