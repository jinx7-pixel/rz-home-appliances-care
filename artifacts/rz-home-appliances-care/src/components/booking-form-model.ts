import type { RepairRequestInput } from '../../../../lib/api-client-react/src/generated/api.schemas';

export const bookingServices = ['Washing Machine Repair', 'Refrigerator Repair', 'Micro Oven Repair', 'LED TV Repair', 'AC Repair'] as const;
export const bookingTimeSlots = ['Morning', 'Afternoon', 'Evening'] as const;
export type BookingValues = { service: string; issue: string; preferredDate: string; preferredTime: string; name: string; phone: string; email: string; address: string };
export type BookingErrors = Partial<Record<keyof BookingValues, string>>;
export const bookingStepFields: (keyof BookingValues)[][] = [
  ['service', 'issue'], ['preferredDate', 'preferredTime'], ['name', 'phone', 'email', 'address'],
];
export const emptyBooking: BookingValues = { service: '', issue: '', preferredDate: '', preferredTime: '', name: '', phone: '', email: '', address: '' };

export function todayInBengaluru(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find((value) => value.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function normalizeBookingPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

export function validateBooking(values: BookingValues, today = todayInBengaluru()): BookingErrors {
  const errors: BookingErrors = {};
  if (!bookingServices.includes(values.service as (typeof bookingServices)[number])) errors.service = 'Choose the appliance that needs a repair.';
  if (values.issue.trim().length < 10 || values.issue.trim().length > 2000) errors.issue = 'Describe the issue in 10–2,000 characters.';
  const parsedDate = new Date(`${values.preferredDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.preferredDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== values.preferredDate || values.preferredDate < today) errors.preferredDate = 'Choose today or a future date.';
  if (!bookingTimeSlots.includes(values.preferredTime as (typeof bookingTimeSlots)[number])) errors.preferredTime = 'Choose a preferred time of day.';
  if (values.name.trim().length < 2 || values.name.trim().length > 100) errors.name = 'Enter your full name (2–100 characters).';
  if (!/^[0-9]{10}$/.test(values.phone)) errors.phone = 'Enter a 10-digit Indian phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (values.address.trim().length < 10 || values.address.trim().length > 500) errors.address = 'Enter your full service address (10–500 characters).';
  return errors;
}

export function bookingPayload(values: BookingValues): RepairRequestInput {
  return { customerName: values.name.trim(), phone: values.phone, email: values.email.trim().toLowerCase(), applianceType: values.service as RepairRequestInput['applianceType'], problemDescription: values.issue.trim(), address: values.address.trim(), preferredDate: values.preferredDate, preferredTime: values.preferredTime };
}

export function formatBookingDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
