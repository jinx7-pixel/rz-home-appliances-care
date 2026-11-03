import { useEffect, useRef, useState } from 'react';
import { AirVent, ArrowRight, ChevronDown, Microwave, Refrigerator, Tv, WashingMachine } from 'lucide-react';
import './services-section.css';

const services = [
  {
    id: 'washing-machine',
    title: 'Washing machine repair',
    description: 'Top-load, front-load, semi-automatic and fully automatic machines diagnosed and repaired.',
    icon: WashingMachine,
  },
  {
    id: 'refrigerator',
    title: 'Refrigerator repair',
    description: 'Cooling problems, faulty parts and unusual noises checked with clear guidance on the repair.',
    icon: Refrigerator,
  },
  {
    id: 'ac',
    title: 'AC repair',
    description: 'Cooling, airflow, water leakage and power issues diagnosed for split and window air conditioners.',
    icon: AirVent,
  },
  {
    id: 'microwave',
    title: 'Microwave repair',
    description: 'Heating, control panel, turntable, sparking and power issues handled with safety-first care.',
    icon: Microwave,
  },
  {
    id: 'led-tv',
    title: 'LED TV repair',
    description: 'Display, sound, backlight, power and connectivity faults diagnosed for common LED TVs.',
    icon: Tv,
  },
] as const;

function ServiceTile({ service, index }: { service: (typeof services)[number]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = service.icon;
  const detailsId = `service-details-${service.id}`;

  return (
    <article className="rz-service-card" data-expanded={expanded} data-testid={`card-service-${index + 1}`}>
      <div className="rz-service-card-top">
        <span className="rz-service-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
        <span className="rz-service-number" aria-hidden="true">0{index + 1}</span>
      </div>
      <h3 className="rz-service-title" data-testid={`heading-service-${index + 1}`}>
        {service.title}
      </h3>
      <button
        className="rz-service-details-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? 'Hide' : 'Show'} details for ${service.title}`}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? 'Hide details' : 'Details'}<ChevronDown size={14} aria-hidden="true" />
      </button>
      <div className="rz-service-details" id={detailsId}>
        <p className="rz-service-description" data-testid={`text-service-description-${index + 1}`}>{service.description}</p>
        <a className="rz-service-request" href="#contact-us" aria-label={`Request ${service.title}`} data-testid={`link-request-service-${index + 1}`}>
          Request a repair<ArrowRight size={15} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export function ServicesSection() {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pendingFrame = 0;
    const updateFrame = () => {
      pendingFrame = 0;
      const frame = frameRef.current;
      if (!frame) return;
      const top = frame.getBoundingClientRect().top;
      frame.style.opacity = String(Math.max(0, Math.min(1, (top + 240) / 240)));
    };
    const scheduleUpdate = () => {
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(updateFrame);
    };
    updateFrame();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.cancelAnimationFrame(pendingFrame);
    };
  }, []);

  return (
    <section className="rz-landing-theme rz-services" id="services" aria-labelledby="services-heading">
      <div className="rz-services-inner">
        <div className="rz-services-frame" ref={frameRef} aria-hidden="true" />
        <header className="rz-services-header">
          <div>
            <p className="rz-services-eyebrow" data-testid="text-services-eyebrow"><span aria-hidden="true" />What we fix</p>
            <h2 id="services-heading" data-testid="heading-services">The <span className="rz-services-heading-gradient">essentials,</span><br />handled.</h2>
          </div>
          <p className="rz-services-intro" data-testid="text-services-description">From the first strange sound to the final spin cycle, our technicians bring practical answers and the right parts to every visit.</p>
        </header>
        <div className="rz-services-grid">
          {services.map((service, index) => <ServiceTile key={service.id} service={service} index={index} />)}
        </div>
      </div>
    </section>
  );
}
