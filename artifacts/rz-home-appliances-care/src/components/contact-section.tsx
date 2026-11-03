import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, House, Mail, MapPin, Phone } from 'lucide-react';
import { bookingPayload, bookingServices, bookingStepFields, bookingTimeSlots, emptyBooking, formatBookingDate, normalizeBookingPhone, todayInBengaluru, validateBooking, type BookingErrors, type BookingValues } from './booking-form-model';
import './contact-section.css';

const stepNames = ['Your appliance', 'Your visit', 'Your details'];
type Receipt = { requestId: string; message: string; preview: boolean; values: BookingValues };

function ContactDetails() {
  return <dl className="rz-booking-contact-list">
    <div><House size={19} aria-hidden="true" /><div><dt>Contact person</dt><dd>Siddiq Basha</dd></div></div>
    <div><Mail size={19} aria-hidden="true" /><div><dt>Email</dt><dd><a href="mailto:homeappliancesrestore@gmail.com" data-testid="link-contact-email">homeappliancesrestore@gmail.com</a></dd></div></div>
    <div><MapPin size={19} aria-hidden="true" /><div><dt>Service location</dt><dd>Bengaluru, Karnataka, India</dd></div></div>
    <div><Phone size={19} aria-hidden="true" /><div><dt>Prefer to talk?</dt><dd><a href="tel:+918073848334" data-testid="link-contact-phone">+91 80738 48334</a></dd></div></div>
  </dl>;
}

function Field({ name, label, error, children, group = false }: { name: keyof BookingValues; label: string; error?: string; children: ReactNode; group?: boolean }) {
  return <div className="rz-booking-field">
    {group ? <span id={`repair-${name}-label`} className="rz-booking-label">{label}</span> : <label htmlFor={`repair-${name}`} className="rz-booking-label">{label}</label>}
    {children}
    {error ? <p className="rz-booking-error" id={`repair-${name}-error`}>{error}</p> : null}
  </div>;
}

export function ContactSection() {
  const [values, setValues] = useState<BookingValues>({ ...emptyBooking });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<keyof BookingValues | 'heading' | null>(null);
  const inFlight = useRef(false);
  const pendingSubmission = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!formRef.current || !('IntersectionObserver' in window)) {
      document.documentElement.removeAttribute('data-rz-booking-active');
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      document.documentElement.toggleAttribute('data-rz-booking-active', entry.isIntersecting);
    }, { threshold: 0.05, rootMargin: mobile ? '-64px 0px 0px 0px' : '-72px 0px 0px 0px' });
    observer.observe(formRef.current);
    return () => { observer.disconnect(); document.documentElement.removeAttribute('data-rz-booking-active'); };
  }, [mobile]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element = target === 'heading' ? headingRef.current : formRef.current?.querySelector<HTMLElement>(`[name="${target}"]`);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: target === 'heading' ? 'start' : 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [step, errors, receipt]);

  const update = (name: keyof BookingValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmitError('');
  };
  const a11y = (name: keyof BookingValues) => ({ id: `repair-${name}`, name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `repair-${name}-error` : undefined });
  const moveStep = (next: number) => { pendingFocus.current = 'heading'; setStep(next); };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || receipt) return;
    const allErrors = validateBooking(values);
    const fields = mobile && step < 2 ? bookingStepFields[step] : bookingStepFields.flat();
    const activeErrors = Object.fromEntries(fields.filter((field) => allErrors[field]).map((field) => [field, allErrors[field]])) as BookingErrors;
    const firstError = fields.find((field) => activeErrors[field]);
    setErrors(activeErrors);
    setSubmitError('');
    if (firstError) {
      pendingFocus.current = firstError;
      if (mobile) setStep(bookingStepFields.findIndex((group) => group.includes(firstError)));
      return;
    }
    if (mobile && step < 2) { moveStep(step + 1); return; }

    const body = JSON.stringify(bookingPayload(values));
    const key = pendingSubmission.current?.body === body ? pendingSubmission.current.key : crypto.randomUUID();
    pendingSubmission.current = { body, key };
    inFlight.current = true;
    setSubmitting(true);
    try {
      const response = await fetch('/api/repair-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body });
      const payload = await response.json().catch(() => null) as { success?: boolean; requestId?: string; message?: string; error?: string; preview?: boolean } | null;
      if (!response.ok || payload?.success !== true || !payload.requestId) throw new Error(payload?.error || 'We could not save your request. Please try again.');
      setReceipt({ requestId: payload.requestId, message: payload.message ?? 'Your repair request was submitted successfully.', preview: payload.preview === true, values: { ...values } });
      pendingSubmission.current = null;
      pendingFocus.current = 'heading';
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'We could not save your request. Please try again.');
    } finally { inFlight.current = false; setSubmitting(false); }
  };

  const reset = () => {
    setValues({ ...emptyBooking }); setErrors({}); setSubmitError(''); setReceipt(null); setStep(0);
    pendingSubmission.current = null; pendingFocus.current = 'heading';
  };

  return <section id="contact-us" className="rz-landing-theme rz-booking" aria-labelledby="contact-heading">
    <div className="rz-booking-inner">
      <header className="rz-booking-intro">
        <p className="rz-booking-eyebrow" data-testid="text-contact-eyebrow"><span aria-hidden="true" /> Let’s plan your repair</p>
        <h2 id="contact-heading" data-testid="heading-contact">Let’s get your home<br /><span>working again.</span></h2>
        <p className="rz-booking-description" data-testid="text-contact-description">Choose your service and preferred visit. We’ll get in touch to confirm the details.</p>
        <div className="rz-booking-contact-desktop"><ContactDetails /></div>
        <details className="rz-booking-contact-mobile"><summary>Contact &amp; service location <ChevronDown size={16} aria-hidden="true" /></summary><ContactDetails /></details>
      </header>

      <form className="rz-booking-form" ref={formRef} onSubmit={handleSubmit} noValidate aria-label="Request a repair visit" data-testid="form-repair-request">
        <div className="rz-booking-form-header"><h3 ref={headingRef} className="rz-booking-title" tabIndex={-1}>{receipt ? receipt.preview ? 'Preview complete' : 'Request received' : 'Request a visit'}</h3><p>{receipt ? 'Here are your visit details.' : 'We’ll confirm your preferred date and time.'}</p></div>
        {receipt ? <div className="rz-booking-receipt" data-testid="text-repair-request-success" role="status">
          <span className="rz-booking-success-icon"><Check size={26} aria-hidden="true" /></span>
          <h4>{receipt.preview ? 'This was a local preview.' : `Thanks, ${receipt.values.name.trim()}.`}</h4>
          <p>{receipt.preview ? 'Nothing was sent or saved. This preview demonstrates the booking flow.' : receipt.message}</p>
          {!receipt.preview ? <p>Our team will contact you to confirm the date and time.</p> : null}
          <dl><div><dt>Request ID</dt><dd>{receipt.requestId}</dd></div><div><dt>Service</dt><dd>{receipt.values.service}</dd></div><div><dt>Preferred visit</dt><dd>{formatBookingDate(receipt.values.preferredDate)} · {receipt.values.preferredTime}</dd></div><div><dt>Name</dt><dd>{receipt.values.name}</dd></div><div><dt>Email</dt><dd>{receipt.values.email}</dd></div><div><dt>Phone</dt><dd>+91 {receipt.values.phone}</dd></div><div><dt>Service location</dt><dd>{receipt.values.address}</dd></div></dl>
          <button type="button" className="rz-button rz-button-secondary" onClick={reset}>Request another visit <ArrowRight size={17} aria-hidden="true" /></button>
        </div> : <>
          <div className="rz-booking-progress" aria-label={`Step ${step + 1} of 3: ${stepNames[step]}`}><p><span>Step {step + 1} of 3</span>{stepNames[step]}</p><div aria-hidden="true">{stepNames.map((name, index) => <span key={name} data-complete={index <= step} />)}</div></div>

          <fieldset className="rz-booking-step" hidden={mobile && step !== 0} disabled={submitting}>
            <legend><span>01</span>Your appliance</legend>
            <Field name="service" label="Appliance service" error={errors.service}><div className="rz-booking-select"><select {...a11y('service')} required value={values.service} onChange={(event) => update('service', event.target.value)}><option value="" disabled>Choose your appliance</option>{bookingServices.map((service) => <option key={service} value={service}>{service}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></div></Field>
            <Field name="issue" label="What needs fixing?" error={errors.issue}><textarea {...a11y('issue')} required rows={3} minLength={10} maxLength={2000} placeholder="Tell us what your appliance is doing…" value={values.issue} onChange={(event) => update('issue', event.target.value)} /></Field>
          </fieldset>

          <fieldset className="rz-booking-step" hidden={mobile && step !== 1} disabled={submitting}>
            <legend><span>02</span>Your preferred visit</legend>
            <Field name="preferredDate" label="Preferred date" error={errors.preferredDate}><input {...a11y('preferredDate')} aria-describedby={[errors.preferredDate ? 'repair-preferredDate-error' : '', 'repair-date-help'].filter(Boolean).join(' ')} type="date" required min={todayInBengaluru()} value={values.preferredDate} onInput={(event) => update('preferredDate', event.currentTarget.value)} onChange={(event) => update('preferredDate', event.target.value)} /><p className="rz-booking-help" id="repair-date-help">Choose today or a future day.</p></Field>
            <Field name="preferredTime" label="Preferred time" error={errors.preferredTime} group><div className="rz-booking-slots" role="radiogroup" aria-labelledby="repair-preferredTime-label" aria-describedby={errors.preferredTime ? 'repair-preferredTime-error' : undefined} aria-invalid={Boolean(errors.preferredTime)}>{bookingTimeSlots.map((slot) => <label className="rz-booking-slot" key={slot}><input type="radio" name="preferredTime" value={slot} checked={values.preferredTime === slot} onChange={() => update('preferredTime', slot)} required /><span>{slot}</span></label>)}</div></Field>
            <p className="rz-booking-schedule-note"><Clock3 size={16} aria-hidden="true" /> This is your preference. Our team will confirm availability.</p>
          </fieldset>

          <fieldset className="rz-booking-step" hidden={mobile && step !== 2} disabled={submitting}>
            <legend><span>03</span>Your contact &amp; location</legend>
            <div className="rz-booking-field-row">
              <Field name="name" label="Full name" error={errors.name}><input {...a11y('name')} type="text" autoComplete="name" required maxLength={100} placeholder="Your full name" value={values.name} onChange={(event) => update('name', event.target.value)} /></Field>
              <Field name="phone" label="Phone number" error={errors.phone}><div className="rz-booking-phone"><span aria-hidden="true">+91</span><input {...a11y('phone')} type="tel" inputMode="tel" autoComplete="tel-national" required maxLength={16} placeholder="10-digit number" value={values.phone} onChange={(event) => update('phone', normalizeBookingPhone(event.target.value))} /></div></Field>
            </div>
            <Field name="email" label="Email address" error={errors.email}><input {...a11y('email')} type="email" inputMode="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={values.email} onChange={(event) => update('email', event.target.value)} /></Field>
            <Field name="address" label="Service address / location" error={errors.address}><textarea {...a11y('address')} autoComplete="street-address" required rows={3} minLength={10} maxLength={500} placeholder="House / flat, street, area and PIN code, Bengaluru" value={values.address} onChange={(event) => update('address', event.target.value)} /></Field>
            <p className="rz-booking-location-note"><MapPin size={15} aria-hidden="true" /> Currently serving Bengaluru, Karnataka.</p>
          </fieldset>

          {Object.values(errors).some(Boolean) ? <p className="rz-booking-validation-summary" role="alert">Please check the highlighted fields.</p> : null}
          {submitError ? <p className="rz-booking-submit-error" role="alert" data-testid="text-repair-request-error">{submitError} Your details are still here, so you can try again.</p> : null}
          <div className="rz-booking-actions">
            {mobile && step > 0 ? <button type="button" className="rz-button rz-button-secondary" onClick={() => moveStep(step - 1)} disabled={submitting}><ArrowLeft size={17} aria-hidden="true" /> Back</button> : null}
            <button type="submit" className="rz-button rz-button-primary" data-testid="button-submit-repair-request" disabled={submitting}>{submitting ? 'Sending request…' : mobile && step < 2 ? 'Continue' : 'Request a visit'}<ArrowRight size={18} aria-hidden="true" /></button>
          </div>
          <p className="rz-booking-consent">{mobile && step < 2 ? 'Your details stay here when you go back.' : 'By submitting, you agree to be contacted about your repair request.'}</p>
        </>}
      </form>
    </div>
  </section>;
}
