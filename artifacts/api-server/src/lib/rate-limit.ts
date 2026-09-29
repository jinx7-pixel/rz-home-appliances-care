import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db, rateLimitBucketsTable } from "@workspace/db";
import { logger } from "./logger";

const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
let nextCleanupAt = 0;

type RateLimitOptions = {
  scope: string;
  clientKey: string;
  maxAttempts: number;
  windowMs: number;
};

async function pruneExpiredBuckets(now: number): Promise<void> {
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + RATE_LIMIT_CLEANUP_INTERVAL_MS;

  try {
    await db
      .delete(rateLimitBucketsTable)
      .where(lt(rateLimitBucketsTable.expiresAt, new Date(now)));
  } catch (error) {
    nextCleanupAt = 0;
    logger.warn({ err: error }, "Failed to prune expired rate-limit buckets");
  }
}

export async function isRateLimited({
  scope,
  clientKey,
  maxAttempts,
  windowMs,
}: RateLimitOptions): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucketKey = createHash("sha256")
    .update(`${scope}\0${clientKey}`)
    .digest("hex");

  await pruneExpiredBuckets(now);

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${bucketKey}), 0)`,
    );

    const [bucket] = await transaction
      .select({
        attemptTimestamps: rateLimitBucketsTable.attemptTimestamps,
      })
      .from(rateLimitBucketsTable)
      .where(eq(rateLimitBucketsTable.bucketKey, bucketKey))
      .limit(1);

    const recentAttempts = (bucket?.attemptTimestamps ?? []).filter(
      (timestamp) => timestamp.getTime() > cutoff,
    );
    const isLimited = recentAttempts.length >= maxAttempts;

    if (!isLimited) {
      recentAttempts.push(new Date(now));
    }

    const latestAttempt = recentAttempts.at(-1)?.getTime() ?? now;
    const expiresAt = new Date(latestAttempt + windowMs);

    if (bucket) {
      await transaction
        .update(rateLimitBucketsTable)
        .set({ attemptTimestamps: recentAttempts, expiresAt })
        .where(eq(rateLimitBucketsTable.bucketKey, bucketKey));
    } else {
      await transaction.insert(rateLimitBucketsTable).values({
        bucketKey,
        attemptTimestamps: recentAttempts,
        expiresAt,
      });
    }

    return isLimited;
  });
}