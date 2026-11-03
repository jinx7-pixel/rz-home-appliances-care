import { useEffect, useRef } from 'react';
import { House, MessagesSquare, PackageCheck, ReceiptText } from 'lucide-react';
import './why-rz-section.css';

const benefits = [
  {
    title: 'Clear quotes',
    description: 'Know what the repair involves and what it costs before work begins.',
    icon: ReceiptText,
  },
  {
    title: 'Care for your home',
    description: 'Respectful service and careful workmanship, from diagnosis to the final check.',
    icon: House,
  },
  {
    title: 'Quality replacement parts',
    description: 'The right replacement parts for your appliance, with clear guidance on the repair.',
    icon: PackageCheck,
  },
  {
    title: 'A team that answers',
    description: 'Real people to answer your questions and keep you informed along the way.',
    icon: MessagesSquare,
  },
] as const;

export function WhyRzSection() {
  const benefitsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = benefitsRef.current;
    if (!list || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-visible', 'true');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    list.dataset.animate = 'true';
    Array.from(list.children).forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="why-rz-appliances-care"
      className="rz-landing-theme rz-why"
      aria-labelledby="why-rz-heading"
    >
      <div className="rz-why-inner">
        <header className="rz-why-header">
          <p className="rz-why-eyebrow" data-testid="text-why-rz-eyebrow">
            <span aria-hidden="true" /> Why choose RZ
          </p>
          <h2 id="why-rz-heading" data-testid="heading-why-rz">
            Expert repairs.<br />
            <span className="rz-why-gradient">Peace of mind.</span>
          </h2>
          <p className="rz-why-intro" data-testid="text-why-rz-description">
            From the first call to the final check, we keep you informed and treat your home with care.
          </p>
        </header>

        <ul className="rz-why-benefits" ref={benefitsRef} data-testid="list-why-rz-points" aria-label="Reasons to choose RZ">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <li className="rz-why-benefit" key={benefit.title} data-testid={`item-why-rz-${index + 1}`}>
                <span className="rz-why-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.6} />
                </span>
                <div className="rz-why-benefit-copy">
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
