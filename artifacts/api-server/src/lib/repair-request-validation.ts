import { CreateRepairRequestBody } from "@workspace/api-zod";

// Match the existing booking form; visit preferences remain optional/null as
// specified by the shared API contract.
const PREFERRED_TIME_SLOTS = ["Morning", "Afternoon", "Evening"];
const TEXT_FIELDS = [
  "customerName", "phone", "email", "applianceType",
  "problemDescription", "address", "preferredDate", "preferredTime",
];

type FieldErrors = Record<string, string[]>;
type ValidationResult =
  | { success: true; data: ReturnType<typeof CreateRepairRequestBody.parse> }
  | { success: false; fieldErrors: FieldErrors; formErrors: string[] };

export function validateRepairRequestBody(body: unknown): ValidationResult {
  let normalized = body;
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const values = { ...body } as Record<string, unknown>;
    for (const field of TEXT_FIELDS) {
      if (typeof values[field] === "string") values[field] = values[field].trim();
    }
    normalized = values;
  }

  const parsed = CreateRepairRequestBody.safeParse(normalized);
  if (!parsed.success) {
    const errors = parsed.error.flatten();
    return {
      success: false,
      fieldErrors: Object.fromEntries(
        Object.entries(errors.fieldErrors).filter(
          (entry): entry is [string, string[]] => entry[1] !== undefined,
        ),
      ),
      formErrors: errors.formErrors,
    };
  }

  const fieldErrors: FieldErrors = {};
  if (parsed.data.preferredDate) {
    const value = (normalized as Record<string, unknown>).preferredDate;
    // Date coercion alone accepts numbers and rolls dates such as Feb 30
    // forward. The public contract and booking form use calendar dates.
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      parsed.data.preferredDate.toISOString().slice(0, 10) !== value
    ) {
      fieldErrors.preferredDate = ["Enter a valid calendar date (YYYY-MM-DD)."];
    }
  }
  if (
    parsed.data.preferredTime != null &&
    !PREFERRED_TIME_SLOTS.includes(parsed.data.preferredTime)
  ) {
    fieldErrors.preferredTime = ["Choose Morning, Afternoon or Evening."];
  }

  return Object.keys(fieldErrors).length
    ? { success: false, fieldErrors, formErrors: [] }
    : { success: true, data: parsed.data };
}

export function preferredDateError(
  date: Date | null | undefined,
  now = new Date(),
): string | null {
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((entry) => entry.type === name)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return date.toISOString().slice(0, 10) < today
    ? "Choose today or a future date."
    : null;
}
