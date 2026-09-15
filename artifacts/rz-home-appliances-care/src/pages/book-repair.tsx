import { useEffect, useState, type FormEvent } from 'react';
import {
  getGetCustomerBookingsQueryKey,
  useAuthMe,
  useCreateCustomerBooking,
  type CustomerBookingInput,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  House,
  LoaderCircle,
  MapPin,
  Phone,
} from 'lucide-react';

const serviceOptions = [
  'Washing Machine Repair',
  'Refrigerator Repair',
  'Micro Oven Repair',
  'LED TV Repair',
] as const;

type BookingFormValues = {
  phone: string;
  service: string;
  issue: string;
  preferredDate: string;
  preferredTime: string;
  address: string;
  additionalNotes: string;
};

type BookingFormErrors = Partial<Record<keyof BookingFormValues | 'account', string>>;

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function getApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error;
    }
  }

  return 'We could not submit your booking. Please try again.';
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p className="mt-2 text-[0.78rem] font-semibold text-red-600" id={id}>
      {message}
    </p>
  ) : null;
}

export function BookRepairPage() {
  const authMeQuery = useAuthMe({
    query: {
      queryKey: ['auth-me'],
      retry: false,
    },
  });
  const createBooking = useCreateCustomerBooking();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<BookingFormValues>({
    phone: '',
    service: '',
    issue: '',
    preferredDate: '',
    preferredTime: '',
    address: '',
    additionalNotes: '',
  });
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [successBookingId, setSuccessBookingId] = useState('');

  useEffect(() => {
    if (authMeQuery.isSuccess && !authMeQuery.data.authenticated) {
      window.location.replace(appPath('/sign-in'));
    }
  }, [authMeQuery.data, authMeQuery.isSuccess]);

  const updateField = (field: keyof BookingFormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, account: undefined }));
    setSubmitError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createBooking.isPending) return;

    const nextErrors: BookingFormErrors = {};
    if (!authMeQuery.data?.user) {
      nextErrors.account = 'Your account could not be verified. Please sign in again.';
    }
    if (!/^[0-9]{10}$/.test(formValues.phone)) {
      nextErrors.phone = 'Please enter a valid 10-digit phone number.';
    }
    if (!serviceOptions.includes(formValues.service as (typeof serviceOptions)[number])) {
      nextErrors.service = 'Please select an appliance service.';
    }
    if (formValues.issue.trim().length < 10) {
      nextErrors.issue = 'Please describe the problem in at least 10 characters.';
    }
    if (!formValues.preferredDate) {
      nextErrors.preferredDate = 'Please choose a preferred appointment date.';
    }
    if (!formValues.preferredTime.trim()) {
      nextErrors.preferredTime = 'Please choose a preferred appointment time.';
    }
    if (formValues.address.trim().length < 10) {
      nextErrors.address = 'Please enter your complete service address.';
    }
    if (formValues.additionalNotes.length > 2000) {
      nextErrors.additionalNotes = 'Additional notes must be 2,000 characters or fewer.';
    }

    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const result = await createBooking.mutateAsync({
        data: {
          phone: formValues.phone,
          applianceType: formValues.service as CustomerBookingInput['applianceType'],
          problemDescription: formValues.issue.trim(),
          preferredDate: formValues.preferredDate,
          preferredTime: formValues.preferredTime.trim(),
          address: formValues.address.trim(),
          additionalNotes: formValues.additionalNotes.trim() || null,
        },
      });

      setSuccessBookingId(result.bookingId);
      setFormValues({
        phone: '',
        service: '',
        issue: '',
        preferredDate: '',
        preferredTime: '',
        address: '',
        additionalNotes: '',
      });
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: getGetCustomerBookingsQueryKey() });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error));
    }
  };

  if (!authMeQuery.isSuccess) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_98%)] px-5 text-[hsl(215_20%_45%)]">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-[hsl(199_82%_43%)]" />
          Verifying your account...
        </div>
      </main>
    );
  }

  if (!authMeQuery.data.authenticated || !authMeQuery.data.user) {
    return null;
  }

  const { user } = authMeQuery.data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="flex flex-col gap-5 border-b border-[hsl(215_35%_86%)] py-2 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <a
            aria-label="RZ Home Appliances Care home"
            className="inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4"
            href={appPath('/')}
          >
            <span className="flex size-10 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]">
              <House aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-[0.92rem] font-extrabold tracking-[-0.02em] text-[hsl(215_32%_19%)]">RZ Home Appliances</span>
              <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care customer portal</span>
            </span>
          </a>
          <a
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:-translate-y-0.5 hover:border-[hsl(199_82%_52%)] hover:bg-[hsl(199_82%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
            href={appPath('/customer-dashboard')}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to dashboard
          </a>
        </header>

        <section className="pt-10 sm:pt-14">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">
            SERVICE BOOKING
          </p>
          <h1 className="mt-4 max-w-[12ch] text-[clamp(2.8rem,6vw,5.25rem)] font-extrabold leading-[0.94] tracking-[-0.075em] text-[hsl(215_32%_14%)]">
            Book a repair visit.
          </h1>
          <p className="mt-6 max-w-[42rem] text-[1rem] leading-[1.7] text-[hsl(215_20%_45%)] sm:text-[1.08rem]">
            Tell us what needs attention, choose a convenient time, and our team will contact you to confirm the appointment.
          </p>
        </section>

        {successBookingId ? (
          <section aria-live="polite" className="mt-10 rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-emerald-700" />
              <div>
                <h2 className="text-[1.35rem] font-extrabold text-emerald-950">Booking request received</h2>
                <p className="mt-2 max-w-[42rem] text-[0.94rem] leading-[1.65] text-emerald-900">
                  Your booking request has been saved. The RZ Home Appliances Care team will contact you shortly.
                </p>
                <p className="mt-4 text-[0.86rem] font-extrabold text-emerald-950">
                  Booking ID: {successBookingId}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.82rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" href={appPath('/customer-dashboard')}>
                    View my dashboard
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </a>
                  <button className="inline-flex min-h-12 items-center rounded-xl border border-emerald-300 px-5 text-[0.82rem] font-extrabold text-emerald-900 hover:bg-emerald-100" onClick={() => setSuccessBookingId('')} type="button">
                    Make another booking
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <form
            className="mt-10 rounded-[1.8rem] border border-[hsl(215_35%_82%/0.85)] bg-white p-5 shadow-[0_28px_60px_-42px_hsl(215_53%_23%/0.65)] sm:p-8 lg:p-10"
            data-testid="form-customer-booking"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-3 border-b border-[hsl(215_35%_90%)] pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[1.7rem] font-extrabold tracking-[-0.055em] text-[hsl(215_32%_14%)] sm:text-[2rem]">
                  Booking details
                </h2>
                <p className="mt-2 text-[0.92rem] text-[hsl(215_20%_45%)]">
                  Your account details are filled in automatically.
                </p>
              </div>
              <span className="w-fit rounded-full bg-[hsl(170_54%_90%)] px-3 py-2 text-[0.61rem] font-extrabold uppercase tracking-[0.16em] text-[hsl(215_74%_38%)]">
                AUTHENTICATED BOOKING
              </span>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-name">
                  Customer name
                </label>
                <input className="mt-2 min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_96%)] px-4 text-[0.95rem] font-semibold text-[hsl(215_32%_19%)] outline-none" id="booking-name" readOnly value={user.fullName} />
              </div>
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-email">
                  Email
                </label>
                <input className="mt-2 min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_96%)] px-4 text-[0.95rem] font-semibold text-[hsl(215_32%_19%)] outline-none" id="booking-email" readOnly type="email" value={user.email} />
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-phone">
                  Phone number
                </label>
                <div className="relative mt-2">
                  <Phone aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                  <input aria-describedby={errors.phone ? 'booking-phone-error' : undefined} aria-invalid={Boolean(errors.phone)} autoComplete="tel" className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.phone ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-phone" inputMode="numeric" maxLength={10} onChange={(event) => updateField('phone', event.target.value)} required type="tel" value={formValues.phone} />
                </div>
                <FieldError id="booking-phone-error" message={errors.phone} />
              </div>
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-service">
                  Appliance / service type
                </label>
                <select aria-describedby={errors.service ? 'booking-service-error' : undefined} aria-invalid={Boolean(errors.service)} className={`mt-2 min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] px-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.service ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-service" onChange={(event) => updateField('service', event.target.value)} required value={formValues.service}>
                  <option disabled value="">Choose a service</option>
                  {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
                </select>
                <FieldError id="booking-service-error" message={errors.service} />
              </div>
            </div>

            <div className="mt-5">
              <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-issue">
                Repair issue or problem description
              </label>
              <textarea aria-describedby={errors.issue ? 'booking-issue-error' : undefined} aria-invalid={Boolean(errors.issue)} className={`mt-2 min-h-36 w-full resize-y rounded-2xl border bg-[hsl(210_40%_99%)] px-4 py-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.issue ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-issue" maxLength={2000} onChange={(event) => updateField('issue', event.target.value)} placeholder="Tell us what is happening with the appliance" required value={formValues.issue} />
              <FieldError id="booking-issue-error" message={errors.issue} />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-date">
                  Preferred appointment date
                </label>
                <div className="relative mt-2">
                  <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                  <input aria-describedby={errors.preferredDate ? 'booking-date-error' : undefined} aria-invalid={Boolean(errors.preferredDate)} className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.preferredDate ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-date" min={today} onChange={(event) => updateField('preferredDate', event.target.value)} required type="date" value={formValues.preferredDate} />
                </div>
                <FieldError id="booking-date-error" message={errors.preferredDate} />
              </div>
              <div>
                <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-time">
                  Preferred appointment time
                </label>
                <div className="relative mt-2">
                  <Clock3 aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                  <input aria-describedby={errors.preferredTime ? 'booking-time-error' : undefined} aria-invalid={Boolean(errors.preferredTime)} className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.preferredTime ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-time" onChange={(event) => updateField('preferredTime', event.target.value)} required type="time" value={formValues.preferredTime} />
                </div>
                <FieldError id="booking-time-error" message={errors.preferredTime} />
              </div>
            </div>

            <div className="mt-5">
              <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-address">
                Full address
              </label>
              <div className="relative mt-2">
                <MapPin aria-hidden="true" className="pointer-events-none absolute left-4 top-5 size-4 text-[hsl(215_20%_55%)]" />
                <textarea aria-describedby={errors.address ? 'booking-address-error' : undefined} aria-invalid={Boolean(errors.address)} autoComplete="street-address" className={`min-h-28 w-full resize-y rounded-2xl border bg-[hsl(210_40%_99%)] py-4 pl-11 pr-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.address ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-address" maxLength={500} onChange={(event) => updateField('address', event.target.value)} placeholder="House number, street, area, Bengaluru" required value={formValues.address} />
              </div>
              <FieldError id="booking-address-error" message={errors.address} />
            </div>

            <div className="mt-5">
              <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="booking-notes">
                Additional notes <span className="font-semibold text-[hsl(215_20%_55%)]">(optional)</span>
              </label>
              <textarea aria-describedby={errors.additionalNotes ? 'booking-notes-error' : undefined} aria-invalid={Boolean(errors.additionalNotes)} className={`mt-2 min-h-28 w-full resize-y rounded-2xl border bg-[hsl(210_40%_99%)] px-4 py-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.additionalNotes ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="booking-notes" maxLength={2000} onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Access instructions or anything else we should know" value={formValues.additionalNotes} />
              <FieldError id="booking-notes-error" message={errors.additionalNotes} />
            </div>

            {errors.account ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[0.82rem] font-semibold text-red-700" role="alert">{errors.account}</p> : null}
            {submitError ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[0.82rem] font-semibold text-red-700" role="alert">{submitError}</p> : null}

            <button className="group mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.9rem] font-extrabold text-white shadow-[0_18px_30px_-18px_hsl(215_82%_30%/0.9)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-70" data-testid="button-submit-customer-booking" disabled={createBooking.isPending} type="submit">
              {createBooking.isPending ? 'Submitting booking...' : 'Submit Booking Request'}
              {!createBooking.isPending ? <ArrowRight aria-hidden="true" className="size-5 transition-transform group-hover:translate-x-1" /> : null}
            </button>
            <p className="mt-4 text-center text-[0.78rem] leading-6 text-[hsl(215_20%_48%)]">
              Your request will be reviewed by our team before the appointment is confirmed.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}