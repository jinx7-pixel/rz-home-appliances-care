import { Router } from "express";
import {
  GetAdminBookingsQueryParams,
  GetAdminBookingsResponseItem,
  UpdateAdminBookingBody,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
} from "@workspace/db";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { requireAdmin } from "./admin-repair-requests";
import {
  buildReviewLink,
  sendBookingStatusEmail,
} from "../lib/repair-request-email";

const router = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalizeStatus(status: string): string {
  return status === "in-progress" ? "in_progress" : status;
}

function serializeBooking(booking: typeof bookingsTable.$inferSelect) {
  return GetAdminBookingsResponseItem.parse({
    bookingId: booking.bookingId,
    customerName: booking.customerName,
    email: booking.email,
    phone: booking.phone,
    customerId: booking.customerId,
    customerType: booking.customerId ? "registered" : "guest",
    applianceType: booking.applianceType,
    problemDescription: booking.problemDescription,
    preferredDate: booking.preferredDate,
    preferredTime: booking.preferredTime,
    address: booking.address,
    additionalNotes: booking.additionalNotes,
    status: normalizeStatus(booking.status),
    adminNotes: booking.adminNotes,
    cancellationReason: booking.cancellationReason,
    emailStatus: booking.emailStatus,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  });
}

router.get("/bookings", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const parsed = GetAdminBookingsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    return response.status(400).json({
      error: "Invalid booking filters.",
    });
  }

  const { search, status, customerType, sort } = parsed.data;
  const filters: SQL[] = [];

  if (search?.trim()) {
    const pattern = `%${escapeLikePattern(search.trim())}%`;
    filters.push(
      or(
        ilike(bookingsTable.bookingId, pattern),
        ilike(bookingsTable.customerName, pattern),
        ilike(bookingsTable.email, pattern),
        ilike(bookingsTable.phone, pattern),
      )!,
    );
  }

  if (status) {
    filters.push(eq(bookingsTable.status, status));
  }

  if (customerType === "guest") {
    filters.push(isNull(bookingsTable.customerId));
  } else if (customerType === "registered") {
    filters.push(isNotNull(bookingsTable.customerId));
  }

  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      sort === "oldest"
        ? asc(bookingsTable.createdAt)
        : desc(bookingsTable.createdAt),
    );

  return response.json(bookings.map(serializeBooking));
});

router.get("/bookings/:bookingId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.bookingId, request.params.bookingId))
    .limit(1);

  if (!booking) {
    return response.status(404).json({ error: "Booking not found." });
  }

  return response.json(serializeBooking(booking));
});

router.patch("/bookings/:bookingId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const parsed = UpdateAdminBookingBody.safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return response.status(400).json({
      error: "Choose a valid status or enter internal notes.",
    });
  }

  const values: {
    status?: string;
    adminNotes?: string | null;
    cancellationReason?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (parsed.data.status) {
    values.status = parsed.data.status;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "adminNotes")) {
    values.adminNotes = parsed.data.adminNotes?.trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "cancellationReason")) {
    values.cancellationReason = parsed.data.cancellationReason?.trim() || null;
  }

  const [existingBooking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.bookingId, request.params.bookingId))
    .limit(1);

  if (!existingBooking) {
    return response.status(404).json({ error: "Booking not found." });
  }

  const requestedStatus = parsed.data.status;
  const statusChanged =
    requestedStatus !== undefined &&
    normalizeStatus(existingBooking.status) !== requestedStatus;

  const [updatedBooking] = await db
    .update(bookingsTable)
    .set(values)
    .where(
      statusChanged
        ? and(
            eq(bookingsTable.bookingId, request.params.bookingId),
            eq(bookingsTable.status, existingBooking.status),
          )
        : eq(bookingsTable.bookingId, request.params.bookingId),
    )
    .returning();

  if (!updatedBooking) {
    const [currentBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.bookingId, request.params.bookingId))
      .limit(1);

    if (!currentBooking) {
      return response.status(404).json({ error: "Booking not found." });
    }

    return response.json(serializeBooking(currentBooking));
  }

  if (
    statusChanged &&
    (requestedStatus === "confirmed" ||
      requestedStatus === "in_progress" ||
      requestedStatus === "completed" ||
      requestedStatus === "cancelled")
  ) {
    try {
      await sendBookingStatusEmail({
        bookingId: updatedBooking.bookingId,
        customerName: updatedBooking.customerName,
        email: updatedBooking.email,
        applianceType: updatedBooking.applianceType,
        preferredDate: updatedBooking.preferredDate,
        preferredTime: updatedBooking.preferredTime,
        address: updatedBooking.address,
        status: requestedStatus,
        cancellationReason: updatedBooking.cancellationReason,
        reviewLink:
          requestedStatus === "completed" && updatedBooking.customerId
            ? buildReviewLink("booking", updatedBooking.bookingId)
            : null,
      });
    } catch (error) {
      request.log.error(
        {
          err: error,
          bookingId: updatedBooking.bookingId,
          status: requestedStatus,
        },
        "Failed to send booking status-change email",
      );
    }
  }

  return response.json(serializeBooking(updatedBooking));
});

export default router;