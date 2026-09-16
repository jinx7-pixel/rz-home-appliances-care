import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import {
  CreateCustomerReviewBody,
  CreateCustomerReviewResponse,
  GetAdminReviewParams,
  GetAdminReviewResponse,
  GetAdminReviewsQueryParams,
  GetAdminReviewsResponseItem,
  GetCustomerReviewEligibleResponseItem,
  GetCustomerReviewTargetQueryParams,
  GetCustomerReviewTargetResponse,
  GetPublicReviewsQueryParams,
  GetPublicReviewsResponseItem,
  UpdateAdminReviewBody,
  UpdateAdminReviewParams,
  UpdateAdminReviewResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
  repairRequestsTable,
  reviewsTable,
} from "@workspace/db";
import { getAuthenticatedCustomer } from "../lib/auth-session";
import { requireAdmin } from "./admin-repair-requests";
import {
  getReviewInvitation,
  getReviewInvitationRecord,
  markReviewInvitationUsed,
  reviewExistsForSource,
} from "../lib/review-invitations";

const router: IRouter = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function createReviewId(): string {
  return `RZR-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] || "Customer";
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RC";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function sourceTypeFor(review: {
  requestId: string | null;
  bookingId: string | null;
}): "repair_request" | "booking" {
  return review.requestId ? "repair_request" : "booking";
}

function sourceIdFor(review: {
  requestId: string | null;
  bookingId: string | null;
}): string {
  return review.requestId ?? review.bookingId ?? "";
}

async function getCompletedTarget(
  customerId: string | null,
  customerEmail: string | null,
  requestId: string | undefined,
  bookingId: string | undefined,
) {
  if (requestId) {
    const ownership = customerId
      ? and(
          eq(repairRequestsTable.customerId, customerId),
          eq(repairRequestsTable.email, customerEmail!),
        )
      : and(
          isNull(repairRequestsTable.customerId),
          eq(repairRequestsTable.email, customerEmail!),
        );
    const [request] = await db
      .select()
      .from(repairRequestsTable)
      .where(
        and(
          eq(repairRequestsTable.requestId, requestId),
            ownership,
          eq(repairRequestsTable.status, "completed"),
        ),
      )
      .limit(1);
    return request
      ? {
          sourceType: "repair_request" as const,
          sourceId: request.requestId,
          applianceType: request.applianceType,
          status: request.status,
          createdAt: request.createdAt,
          customerId: request.customerId,
          customerName: request.customerName,
          customerEmail: request.email,
        }
      : null;
  }

  if (bookingId) {
    const ownership = customerId
      ? and(
          eq(bookingsTable.customerId, customerId),
          eq(bookingsTable.email, customerEmail!),
        )
      : eq(bookingsTable.email, customerEmail!);
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.bookingId, bookingId),
            ownership,
          eq(bookingsTable.status, "completed"),
        ),
      )
      .limit(1);
    return booking
      ? {
          sourceType: "booking" as const,
          sourceId: booking.bookingId,
          applianceType: booking.applianceType,
          status: booking.status,
          createdAt: booking.createdAt,
          customerId: booking.customerId,
          customerName: booking.customerName,
          customerEmail: booking.email,
        }
      : null;
  }

  return null;
}

router.get("/reviews", async (request, response) => {
  const parsed = GetPublicReviewsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid review limit." });
    return;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.status, "approved"))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(parsed.data.limit);

  response.json(
    reviews.map((review) =>
      GetPublicReviewsResponseItem.parse({
        reviewId: review.reviewId,
        rating: review.rating,
        reviewMessage: review.reviewMessage,
        customerLabel: review.showFirstName
          ? firstName(review.customerName)
          : initials(review.customerName),
        applianceType: review.applianceType,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      }),
    ),
  );
});

router.get("/customer/reviews/eligible", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  if (!customer) {
    response.status(401).json({ error: "Authentication is required to view reviews." });
    return;
  }

  const [requests, bookings, reviews] = await Promise.all([
    db
      .select({
        sourceId: repairRequestsTable.requestId,
        applianceType: repairRequestsTable.applianceType,
        status: repairRequestsTable.status,
        createdAt: repairRequestsTable.createdAt,
      })
      .from(repairRequestsTable)
      .where(
        and(
          eq(repairRequestsTable.customerId, customer.id),
          eq(repairRequestsTable.status, "completed"),
        ),
      ),
    db
      .select({
        sourceId: bookingsTable.bookingId,
        applianceType: bookingsTable.applianceType,
        status: bookingsTable.status,
        createdAt: bookingsTable.createdAt,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.customerId, customer.id),
          eq(bookingsTable.status, "completed"),
        ),
      ),
    db
      .select({
        reviewId: reviewsTable.reviewId,
        requestId: reviewsTable.requestId,
        bookingId: reviewsTable.bookingId,
        status: reviewsTable.status,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.customerId, customer.id)),
  ]);

  const reviewBySource = new Map(
    reviews.map((review) => [
      review.requestId ?? review.bookingId,
      review,
    ]),
  );
  const eligible = [
    ...requests.map((item) => ({ ...item, sourceType: "repair_request" as const })),
    ...bookings.map((item) => ({ ...item, sourceType: "booking" as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  response.json(
    eligible.map((item) =>
      GetCustomerReviewEligibleResponseItem.parse({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        applianceType: item.applianceType,
        status: item.status,
        createdAt: item.createdAt,
        reviewSubmitted: reviewBySource.has(item.sourceId),
        reviewStatus: reviewBySource.get(item.sourceId)?.status ?? null,
        reviewId: reviewBySource.get(item.sourceId)?.reviewId ?? null,
      }),
    ),
  );
});

router.get("/customer/review-target", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  const parsed = GetCustomerReviewTargetQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Choose one request or booking to review." });
    return;
  }

  const { requestId, bookingId, token } = parsed.data;
  const invitation = token ? await getReviewInvitation(token) : null;
  if (token && !invitation) {
    const record = await getReviewInvitationRecord(token);
    if (record?.reviewId) {
      response.status(409).json({ error: "A review has already been submitted for this service." });
      return;
    }
    response.status(404).json({ error: "This review link is invalid or has expired." });
    return;
  }
  const resolvedRequestId = invitation?.requestId ?? requestId;
  const resolvedBookingId = invitation?.bookingId ?? bookingId;
  if (
    invitation &&
    ((requestId && requestId !== invitation.requestId) ||
      (bookingId && bookingId !== invitation.bookingId))
  ) {
    response.status(403).json({ error: "This review link is not valid for that service." });
    return;
  }
  if ((resolvedRequestId ? 1 : 0) + (resolvedBookingId ? 1 : 0) !== 1) {
    response.status(400).json({ error: "Choose one request or booking to review." });
    return;
  }

  if (!invitation && !customer) {
    response.status(401).json({ error: "Authentication is required to view reviews." });
    return;
  }
  const target = await getCompletedTarget(
    invitation?.customerId ?? customer?.id ?? null,
    invitation?.customerEmail ?? customer?.email ?? null,
    resolvedRequestId,
    resolvedBookingId,
  );
  if (!target) {
    response.status(404).json({
      error: "Only your completed repair work can receive a review.",
    });
    return;
  }

  const [existingReview] = await db
    .select()
    .from(reviewsTable)
    .where(
      and(
        resolvedRequestId
          ? eq(reviewsTable.requestId, resolvedRequestId)
          : eq(reviewsTable.bookingId, resolvedBookingId!),
      ),
    )
    .limit(1);

  response.json(
    GetCustomerReviewTargetResponse.parse({
      sourceType: target.sourceType,
      sourceId: target.sourceId,
      applianceType: target.applianceType,
      status: target.status,
      existingReview: existingReview
        ? await serializeAdminReview(existingReview)
        : null,
    }),
  );
});

router.post("/customer/reviews", async (request, response) => {
  const customer = await getAuthenticatedCustomer(request, response);
  const parsed = CreateCustomerReviewBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please add a rating and a review of at least 10 characters." });
    return;
  }

  const { requestId, bookingId, token } = parsed.data;
  const invitation = token ? await getReviewInvitation(token) : null;
  if (token && !invitation) {
    const record = await getReviewInvitationRecord(token);
    if (record?.reviewId) {
      response.status(409).json({ error: "A review has already been submitted for this service." });
      return;
    }
    response.status(404).json({ error: "This review link is invalid or has expired." });
    return;
  }
  if (!invitation && !customer) {
    response.status(401).json({ error: "Authentication is required to submit a review." });
    return;
  }
  const resolvedRequestId = invitation?.requestId ?? requestId ?? undefined;
  const resolvedBookingId = invitation?.bookingId ?? bookingId ?? undefined;
  if (
    invitation &&
    ((requestId && requestId !== invitation.requestId) ||
      (bookingId && bookingId !== invitation.bookingId))
  ) {
    response.status(403).json({ error: "This review link is not valid for that service." });
    return;
  }
  if ((resolvedRequestId ? 1 : 0) + (resolvedBookingId ? 1 : 0) !== 1) {
    response.status(400).json({ error: "Choose one request or booking to review." });
    return;
  }

  const target = await getCompletedTarget(
    invitation?.customerId ?? customer?.id ?? null,
    invitation?.customerEmail ?? customer?.email ?? null,
    resolvedRequestId,
    resolvedBookingId,
  );
  if (!target) {
    response.status(400).json({
      error: "Only your completed repair work can receive a review.",
    });
    return;
  }

  if (await reviewExistsForSource(resolvedRequestId ?? null, resolvedBookingId ?? null)) {
    response.status(409).json({ error: "A review has already been submitted for this work." });
    return;
  }

  try {
    const [review] = await db
      .insert(reviewsTable)
      .values({
        reviewId: createReviewId(),
         customerId: target.customerId,
         requestId: resolvedRequestId ?? null,
         bookingId: resolvedBookingId ?? null,
         customerName: target.customerName,
         customerEmail: target.customerEmail,
        applianceType: target.applianceType,
        rating: parsed.data.rating,
        reviewMessage: parsed.data.reviewMessage.trim(),
        showFirstName: parsed.data.showFirstName,
        isVerified: true,
        status: "pending",
      })
      .returning();

     if (invitation) {
       await markReviewInvitationUsed(invitation.id, review.reviewId);
     }
     response.status(201).json(
       CreateCustomerReviewResponse.parse(await serializeAdminReview(review)),
     );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      response.status(409).json({ error: "A review has already been submitted for this work." });
      return;
    }
    throw error;
  }
});

async function serializeAdminReview(review: typeof reviewsTable.$inferSelect) {
  let relatedStatus = "completed";
  let relatedDate: string | null = null;
  let relatedTime: string | null = null;
  let relatedAddress: string | null = null;
  let relatedProblemDescription: string | null = null;

  if (review.requestId) {
    const [request] = await db
      .select({
        status: repairRequestsTable.status,
        preferredDate: repairRequestsTable.preferredDate,
        preferredTime: repairRequestsTable.preferredTime,
        address: repairRequestsTable.address,
        problemDescription: repairRequestsTable.problemDescription,
      })
      .from(repairRequestsTable)
      .where(eq(repairRequestsTable.requestId, review.requestId))
      .limit(1);
    if (request) {
      relatedStatus = request.status;
      relatedDate = request.preferredDate;
      relatedTime = request.preferredTime;
      relatedAddress = request.address;
      relatedProblemDescription = request.problemDescription;
    }
  } else if (review.bookingId) {
    const [booking] = await db
      .select({
        status: bookingsTable.status,
        preferredDate: bookingsTable.preferredDate,
        preferredTime: bookingsTable.preferredTime,
        address: bookingsTable.address,
        problemDescription: bookingsTable.problemDescription,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.bookingId, review.bookingId))
      .limit(1);
    if (booking) {
      relatedStatus = booking.status;
      relatedDate = booking.preferredDate;
      relatedTime = booking.preferredTime;
      relatedAddress = booking.address;
      relatedProblemDescription = booking.problemDescription;
    }
  }

  return GetAdminReviewsResponseItem.parse({
    reviewId: review.reviewId,
    customerId: review.customerId,
    customerName: review.customerName,
    customerEmail: review.customerEmail,
    sourceType: sourceTypeFor(review),
    sourceId: sourceIdFor(review),
    applianceType: review.applianceType,
    relatedStatus,
    relatedDate,
    relatedTime,
    relatedAddress,
    relatedProblemDescription,
    rating: review.rating,
    reviewMessage: review.reviewMessage,
    showFirstName: review.showFirstName,
    isVerified: review.isVerified,
    status: review.status,
    adminNotes: review.adminNotes,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  });
}

router.get("/admin/reviews", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;

  const parsed = GetAdminReviewsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid review filters." });
    return;
  }

  const filters: SQL[] = [];
  if (parsed.data.search?.trim()) {
    const pattern = `%${escapeLikePattern(parsed.data.search.trim())}%`;
    filters.push(
      or(
        ilike(reviewsTable.reviewId, pattern),
        ilike(reviewsTable.customerName, pattern),
        ilike(reviewsTable.customerEmail, pattern),
        ilike(reviewsTable.requestId, pattern),
        ilike(reviewsTable.bookingId, pattern),
      )!,
    );
  }
  if (parsed.data.rating) filters.push(eq(reviewsTable.rating, parsed.data.rating));
  if (parsed.data.status) filters.push(eq(reviewsTable.status, parsed.data.status));

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      parsed.data.sort === "oldest"
        ? asc(reviewsTable.createdAt)
        : desc(reviewsTable.createdAt),
    );

  response.json(await Promise.all(reviews.map(serializeAdminReview)));
});

router.get("/admin/reviews/:reviewId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const parsed = GetAdminReviewParams.safeParse(request.params);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid review ID." });
    return;
  }

  const [review] = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.reviewId, parsed.data.reviewId))
    .limit(1);
  if (!review) {
    response.status(404).json({ error: "Review not found." });
    return;
  }
  response.json(await serializeAdminReview(review));
});

router.patch("/admin/reviews/:reviewId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const params = UpdateAdminReviewParams.safeParse(request.params);
  const parsed = UpdateAdminReviewBody.safeParse(request.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    response.status(400).json({ error: "Choose a valid review status or enter admin notes." });
    return;
  }

  const values: {
    status?: string;
    adminNotes?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (parsed.data.status) values.status = parsed.data.status;
  if (Object.prototype.hasOwnProperty.call(parsed.data, "adminNotes")) {
    values.adminNotes = parsed.data.adminNotes?.trim() || null;
  }

  const [review] = await db
    .update(reviewsTable)
    .set(values)
    .where(eq(reviewsTable.reviewId, params.data.reviewId))
    .returning();
  if (!review) {
    response.status(404).json({ error: "Review not found." });
    return;
  }
  response.json(await serializeAdminReview(review));
});

router.delete("/admin/reviews/:reviewId", async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const [review] = await db
    .delete(reviewsTable)
    .where(eq(reviewsTable.reviewId, request.params.reviewId))
    .returning({ reviewId: reviewsTable.reviewId });
  if (!review) {
    response.status(404).json({ error: "Review not found." });
    return;
  }
  response.status(204).send();
});

export default router;