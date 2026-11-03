import { ArrowUpRight } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import './faq-section.css';

const questions = [
  {
    id: 'appliances',
    question: 'Which appliances do you repair?',
    answer: 'We repair washing machines, refrigerators, microwave ovens, LED TVs and air conditioners. Share the brand, model and issue when you book so our team can discuss the repair with you.',
  },
  {
    id: 'service-area',
    question: 'Do you service my area in Bengaluru?',
    answer: 'We currently serve Bengaluru, Karnataka. Include your locality, PIN code and complete service address in the booking form. Our team will confirm availability for your area before arranging a visit.',
  },
  {
    id: 'charges',
    question: 'How much will the visit and repair cost?',
    answer: 'The cost depends on the appliance, fault and any parts needed. Ask our team about visit or inspection charges when arranging your appointment. After diagnosis, we explain the repair quote for your approval before work begins.',
  },
  {
    id: 'appointment',
    question: 'Is my preferred date and time confirmed?',
    answer: 'Your booking form sends a visit request. Your selected date and morning, afternoon or evening slot are preferences. Our team will contact you to confirm availability and agree on the appointment.',
  },
  {
    id: 'parts',
    question: 'What if my appliance needs a spare part?',
    answer: 'After checking the appliance, we discuss any parts needed, their availability and the cost before you approve the repair. If a part needs to be sourced, our team will explain the next steps and expected timing.',
  },
  {
    id: 'warranty',
    question: 'What warranty applies to my repair?',
    answer: 'Please ask our team to confirm any applicable repair or replacement-part warranty, its duration and conditions before approving the work. Coverage can depend on the repair and parts involved.',
  },
] as const;

export function FaqSection() {
  return (
    <section className="rz-landing-theme rz-faq" id="faq" aria-labelledby="faq-heading">
      <div className="rz-faq-inner">
        <div className="rz-faq-intro">
          <p className="rz-faq-eyebrow"><span aria-hidden="true" /> FAQs</p>
          <h2 id="faq-heading">A little clarity.<br /><span>Before we visit.</span></h2>
          <p className="rz-faq-description">A few helpful answers about booking, repairs and what happens next.</p>
          <a className="rz-faq-contact" href="#contact-us">Have another question? Get in touch <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
        <Accordion type="single" collapsible className="rz-faq-list" aria-label="Appliance repair questions">
          {questions.map(({ id, question, answer }) => (
            <AccordionItem className="rz-faq-item" value={id} key={id}>
              <AccordionTrigger className="rz-faq-question">{question}</AccordionTrigger>
              <AccordionContent className="rz-faq-answer"><p>{answer}</p></AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
