import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  reviewInvitationsTable,
  reviewsTable,
} from "@workspace/db";

const REVIEW_INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ReviewSourceType = "request" | "booking";

function hashReviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createReviewInvitation(data: {
  sourceType: ReviewSourceType;
  sourceId: string;
  customerId: string | null;
  customerEmail: string;
}): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const sourceValues =
    data.sourceType === "request"
      ? { requestId: data.sourceId, bookingId: null }
      : { requestId: null, bookingId: data.sourceId };

  await db.insert(reviewInvitationsTable).values({
    tokenHash: hashReviewToken(token),
    customerId: data.customerId,
    customerEmail: data.customerEmail.trim().toLowerCase(),
    ...sourceValues,
    expiresAt: new Date(now.getTime() + REVIEW_INVITATION_TTL_MS),
    createdAt: now,
  });

  return token;
}

export async function getReviewInvitation(token: string) {
  const [invitation] = await db
    .select()
    .from(reviewInvitationsTable)
    .where(
      and(
        eq(reviewInvitationsTable.tokenHash, hashReviewToken(token)),
        gt(reviewInvitationsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invitation ?? null;
}

export async function getReviewInvitationRecord(token: string) {
  const [invitation] = await db
    .select()
    .from(reviewInvitationsTable)
    .where(eq(reviewInvitationsTable.tokenHash, hashReviewToken(token)))
    .limit(1);
  return invitation ?? null;
}

export async function markReviewInvitationUsed(
  invitationId: string,
  reviewId: string,
): Promise<boolean> {
  const [updated] = await db
    .update(reviewInvitationsTable)
    .set({ usedAt: new Date(), reviewId })
    .where(
      and(
        eq(reviewInvitationsTable.id, invitationId),
        isNull(reviewInvitationsTable.usedAt),
      ),
    )
    .returning({ id: reviewInvitationsTable.id });
  return Boolean(updated);
}

export async function reviewExistsForSource(
  requestId: string | null,
  bookingId: string | null,
): Promise<boolean> {
  const [review] = await db
    .select({ reviewId: reviewsTable.reviewId })
    .from(reviewsTable)
    .where(
      requestId
        ? eq(reviewsTable.requestId, requestId)
        : eq(reviewsTable.bookingId, bookingId!),
    )
    .limit(1);
  return Boolean(review);
}