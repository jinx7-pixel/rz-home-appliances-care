import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bookingsTable } from "./bookings";
import { customersTable } from "./customers";
import { repairRequestsTable } from "./repair-requests";
import { reviewsTable } from "./reviews";

export const reviewInvitationsTable = pgTable(
  "review_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    customerId: uuid("customer_id").references(() => customersTable.id, {
      onDelete: "set null",
    }),
    customerEmail: varchar("customer_email", { length: 254 }).notNull(),
    requestId: varchar("request_id", { length: 24 }).references(
      () => repairRequestsTable.requestId,
      { onDelete: "cascade" },
    ),
    bookingId: varchar("booking_id", { length: 24 }).references(
      () => bookingsTable.bookingId,
      { onDelete: "cascade" },
    ),
    reviewId: varchar("review_id", { length: 24 }).references(
      () => reviewsTable.reviewId,
      { onDelete: "set null" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("review_invitations_token_hash_unique").on(table.tokenHash),
    index("review_invitations_request_id_idx").on(table.requestId),
    index("review_invitations_booking_id_idx").on(table.bookingId),
  ],
);

export const insertReviewInvitationSchema = createInsertSchema(
  reviewInvitationsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertReviewInvitation = z.infer<
  typeof insertReviewInvitationSchema
>;
export type ReviewInvitation = typeof reviewInvitationsTable.$inferSelect;