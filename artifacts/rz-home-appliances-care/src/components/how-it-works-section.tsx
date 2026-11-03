import { useEffect, useRef } from 'react';
import { BadgeCheck, CalendarClock, MessageSquareText } from 'lucide-react';
import './how-it-works-section.css';

const steps = [
  {
    number: '01',
    title: 'Tell us the problem',
    description: 'Share a few details in the form or give us a call. Our team takes it from there.',
    icon: MessageSquareText,
  },
  {
    number: '02',
    title: 'Choose your time',
    description: 'Pick a convenient appointment window. We arrive ready to diagnose the issue.',
    icon: CalendarClock,
  },
  {
    number: '03',
    title: 'Get it fixed',
    description: 'Approve a clear quote before work starts. We handle the repair with care.',
    icon: BadgeCheck,
  },
] as const;

export function HowItWorksSection() {
  const timelineRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || !('IntersectionObserver' in window)) return;

    // Keep the content visible by default, and reveal each step only once.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-visible', 'true');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    timeline.dataset.animate = 'true';
    Array.from(timeline.children).forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      className="rz-landing-theme rz-process"
      aria-labelledby="how-it-works-heading"
    >
      <div className="rz-process-inner">
        <header className="rz-process-header">
          <p className="rz-process-eyebrow" data-testid="text-how-it-works-eyebrow">
            <span aria-hidden="true" /> How it works
          </p>
          <h2 id="how-it-works-heading" data-testid="heading-how-it-works">
            Three <span className="rz-process-gradient">simple steps.</span>
            <br />Back to normal.
          </h2>
          <p className="rz-process-intro" data-testid="text-how-it-works-description">
            Getting help should be the easy part. Here’s how we get your home working again.
          </p>
        </header>

        <ol className="rz-process-timeline" ref={timelineRef} aria-label="Our repair process">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li className="rz-process-step" key={step.number} data-testid={`how-it-works-step-${step.number}`}>
                <span className="rz-process-number" aria-hidden="true" data-testid={`text-how-it-works-number-${step.number}`}>
                  {step.number}
                </span>
                <div className="rz-process-card">
                  <Icon className="rz-process-icon" size={24} strokeWidth={1.6} aria-hidden="true" />
                  <h3 data-testid={`heading-how-it-works-step-${step.number}`}>{step.title}</h3>
                  <p data-testid={`text-how-it-works-step-${step.number}`}>{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
