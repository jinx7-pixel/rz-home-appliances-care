import { createRequire } from "node:module";

// Read-only readiness: HTTP, database connectivity and required relation presence.
// This never creates schema or runs migration SQL.
const require = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2_000,
  query_timeout: 2_000,
  statement_timeout: 2_000,
});
try {
  if (!process.env.DATABASE_URL)
    throw new Error("Database configuration missing");
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || "3000"}/api/healthz`,
    { signal: AbortSignal.timeout(2_000) },
  );
  if (!response.ok || (await response.json()).status !== "ok")
    throw new Error("HTTP not ready");
  await client.connect();
  const relations = [
    "public.repair_requests",
    "public.bookings",
    "public.customers",
    "public.auth_sessions",
    "public.password_reset_tokens",
    "public.admin_users",
    "public.admin_sessions",
    "public.reviews",
    "public.review_invitations",
    "public.rate_limit_buckets",
    "public.site_settings",
    "rz_migrations.history",
  ];
  const { rows } = await client.query(
    "SELECT bool_and(to_regclass(name) IS NOT NULL) AS ready FROM unnest($1::text[]) AS name",
    [relations],
  );
  if (!rows[0].ready) throw new Error("Manual provisioning/adoption required");
} catch {
  // Do not emit connection strings, database errors or credentials into health logs.
  console.error(
    "API not ready: verify HTTP, DB connectivity and explicit schema provisioning.",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
