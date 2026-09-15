import {
  boolean,
  index,
  integer,
  pgTable,
  text,
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

export const reviewsTable = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: varchar("review_id", { length: 24 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    requestId: varchar("request_id", { length: 24 }).references(
      () => repairRequestsTable.requestId,
      { onDelete: "cascade" },
    ),
    bookingId: varchar("booking_id", { length: 24 }).references(
      () => bookingsTable.bookingId,
      { onDelete: "cascade" },
    ),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    customerEmail: varchar("customer_email", { length: 254 }).notNull(),
    applianceType: varchar("appliance_type", { length: 64 }).notNull(),
    rating: integer("rating").notNull(),
    reviewMessage: text("review_message").notNull(),
    showFirstName: boolean("show_first_name").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(true),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reviews_review_id_unique").on(table.reviewId),
    uniqueIndex("reviews_customer_request_unique").on(
      table.customerId,
      table.requestId,
    ),
    uniqueIndex("reviews_customer_booking_unique").on(
      table.customerId,
      table.bookingId,
    ),
    index("reviews_status_idx").on(table.status),
    index("reviews_customer_id_idx").on(table.customerId),
  ],
);

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;