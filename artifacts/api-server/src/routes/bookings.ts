import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  CreateCustomerBookingBody,
  CreateCustomerBookingResponse,
} from "@workspace/api-zod";
import { bookingsTable, db } from "@workspace/db";
import { getAuthenticatedCustomer } from "../lib/auth-session";
import { sendRepairRequestEmails } from "../lib/repair-request-email";

const router: IRouter = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const bookingAttempts = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const recentAttempts = (bookingAttempts.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentAttempts.length >= RATE_LIMIT_MAX_REQUESTS) {
    bookingAttempts.set(clientKey, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  bookingAttempts.set(clientKey, recentAttempts);
  return false;
}

function createBookingId(): string {
  return `RZB-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

router.get("/bookings", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  if (!customer) {
    return response.status(401).json({
      error: "Authentication is required to view bookings.",
    });
  }

  const bookings = await db
    .select({
      bookingId: bookingsTable.bookingId,
      applianceType: bookingsTable.applianceType,
      problemDescription: bookingsTable.problemDescription,
      preferredDate: bookingsTable.preferredDate,
      preferredTime: bookingsTable.preferredTime,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
      address: bookingsTable.address,
      additionalNotes: bookingsTable.additionalNotes,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.customerId, customer.id))
    .orderBy(desc(bookingsTable.createdAt));

  return response.json(
    bookings.map((booking) => ({
      ...booking,
      preferredDate: booking.preferredDate,
      createdAt: booking.createdAt.toISOString(),
    })),
  );
});

router.post("/bookings", async (request, response): Promise<void> => {
  const customer = await getAuthenticatedCustomer(request, response);
  if (!customer) {
    response.status(401).json({
      error: "Authentication is required to create a booking.",
    });
    return;
  }

  const clientKey = `${request.ip ?? request.socket.remoteAddress ?? "unknown"}:${customer.id}`;
  if (isRateLimited(clientKey)) {
    response.status(429).json({
      error: "Too many booking requests. Please wait a few minutes and try again.",
    });
    return;
  }

  const parsed = CreateCustomerBookingBody.safeParse(request.body);
  if (!parsed.success) {
    request.log.warn(
      { validationIssueCount: parsed.error.issues.length },
      "Rejected invalid customer booking",
    );
    response.status(400).json({
      error: parsed.error.issues.some((issue) => issue.path[0] === "phone")
        ? "Please enter a valid 10-digit phone number."
        : "Please check the booking details and try again.",
    });
    return;
  }

  const input = parsed.data;
  const bookingId = createBookingId();
  const submittedAt = new Date();
  const preferredDate = toDateString(input.preferredDate);
  const preferredTime = input.preferredTime.trim();
  const problemDescription = input.problemDescription.trim();
  const address = input.address.trim();
  const additionalNotes = input.additionalNotes?.trim() || null;

  // Keep an accidental resubmission from creating another booking and sending
  // another pair of emails while the original request is still recent.
  try {
    const noteMatch =
      additionalNotes === null
        ? isNull(bookingsTable.additionalNotes)
        : eq(bookingsTable.additionalNotes, additionalNotes);
    const [recentDuplicate] = await db
      .select({
        bookingId: bookingsTable.bookingId,
        emailStatus: bookingsTable.emailStatus,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.customerId, customer.id),
          eq(bookingsTable.phone, input.phone),
          eq(bookingsTable.applianceType, input.applianceType),
          eq(bookingsTable.problemDescription, problemDescription),
          eq(bookingsTable.preferredDate, preferredDate),
          eq(bookingsTable.preferredTime, preferredTime),
          eq(bookingsTable.address, address),
          noteMatch,
          gt(
            bookingsTable.createdAt,
            new Date(submittedAt.getTime() - 10 * 60 * 1000),
          ),
        ),
      )
      .orderBy(desc(bookingsTable.createdAt))
      .limit(1);

    if (recentDuplicate && recentDuplicate.emailStatus !== "failed") {
      response.status(200).json(
        CreateCustomerBookingResponse.parse({
          success: true,
          bookingId: recentDuplicate.bookingId,
          message:
            "This booking request was already received. We will contact you soon.",
        }),
      );
      return;
    }
  } catch (error) {
    request.log.warn(
      { err: error, customerId: customer.id },
      "Could not check for a duplicate booking; continuing with submission",
    );
  }

  try {
    await db.insert(bookingsTable).values({
      bookingId,
      customerId: customer.id,
      customerName: customer.fullName,
      email: customer.email.trim().toLowerCase(),
      phone: input.phone,
      applianceType: input.applianceType,
      problemDescription,
      preferredDate,
      preferredTime,
      address,
      additionalNotes,
      status: "pending",
      emailStatus: "pending",
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });
  } catch (error) {
    request.log.error({ err: error, bookingId }, "Failed to save customer booking");
    response.status(500).json({
      error: "We could not save your booking. Please try again.",
    });
    return;
  }

  try {
    await sendRepairRequestEmails({
      requestId: bookingId,
      customerName: customer.fullName,
      phone: input.phone,
      email: customer.email.trim().toLowerCase(),
      applianceType: input.applianceType,
      problemDescription,
      address,
      preferredDate,
      preferredTime,
      additionalNotes,
      submittedAt,
      customerType: "Registered Customer",
      notificationType: "booking",
    });

    await db
      .update(bookingsTable)
      .set({ emailStatus: "sent", updatedAt: new Date() })
      .where(eq(bookingsTable.bookingId, bookingId));
  } catch (error) {
    request.log.error({ err: error, bookingId }, "Failed to send booking emails");
    await db
      .update(bookingsTable)
      .set({ emailStatus: "failed", updatedAt: new Date() })
      .where(eq(bookingsTable.bookingId, bookingId))
      .catch((updateError) => {
        request.log.error(
          { err: updateError, bookingId },
          "Failed to record booking email failure",
        );
      });
    response.status(502).json({
      error:
        "Your booking was saved, but we could not send the confirmation email. Please call us at +91 80738 48334.",
    });
    return;
  }

  response.status(201).json(
    CreateCustomerBookingResponse.parse({
      success: true,
      bookingId,
      message:
        "Your booking request was submitted successfully and a confirmation email was sent.",
    }),
  );
});

export default router;