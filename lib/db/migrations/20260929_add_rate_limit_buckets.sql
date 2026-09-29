-- Additive, idempotent migration for the shared API rate limiter.
-- This file is not run at application startup or by the deployment build.
-- Replit-managed production schema changes should use the reviewed Publish flow.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key varchar(64) CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY,
  attempt_timestamps timestamptz[] NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_at_idx
  ON public.rate_limit_buckets USING btree (expires_at);

COMMIT;