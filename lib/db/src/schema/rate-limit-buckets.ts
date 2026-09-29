import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const rateLimitBucketsTable = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: varchar("bucket_key", { length: 64 }).primaryKey(),
    attemptTimestamps: timestamp("attempt_timestamps", {
      withTimezone: true,
      mode: "date",
    })
      .array()
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [index("rate_limit_buckets_expires_at_idx").on(table.expiresAt)],
);

export const insertRateLimitBucketSchema = createInsertSchema(
  rateLimitBucketsTable,
);

export type InsertRateLimitBucket = z.infer<
  typeof insertRateLimitBucketSchema
>;
export type RateLimitBucket = typeof rateLimitBucketsTable.$inferSelect;