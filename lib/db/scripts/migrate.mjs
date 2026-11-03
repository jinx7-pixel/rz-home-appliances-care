import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationRoot = new URL("../migrations/", import.meta.url);
const baselineFile = "baseline/20261101_baseline.sql";
const legacyFile = "20260929_add_rate_limit_buckets.sql";
const digest = (text) => createHash("sha256").update(text).digest("hex");

// Deliberately independent of DATABASE_URL at import time, for isolated tests.
export async function fingerprint(client) {
  const { rows } = await client.query(`
    SELECT c.relname AS name, c.relkind AS kind,
      c.relrowsecurity AS row_security, c.relforcerowsecurity AS force_row_security,
      COALESCE((SELECT json_agg(json_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid),
        'identity', a.attidentity, 'generated', a.attgenerated) ORDER BY a.attnum)
        FROM pg_attribute a LEFT JOIN pg_attrdef d
          ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]') AS columns,
      COALESCE((SELECT json_agg(json_build_object(
        'name', k.conname, 'definition', pg_get_constraintdef(k.oid),
        'validated', k.convalidated, 'deferrable', k.condeferrable,
        'deferred', k.condeferred) ORDER BY k.conname)
        FROM pg_constraint k WHERE k.conrelid = c.oid), '[]') AS constraints,
      COALESCE((SELECT json_agg(json_build_object(
        'definition', pg_get_indexdef(i.indexrelid), 'valid', i.indisvalid,
        'ready', i.indisready) ORDER BY pg_get_indexdef(i.indexrelid))
        FROM pg_index i WHERE i.indrelid = c.oid), '[]') AS indexes
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
    ORDER BY c.relname
  `);
  return rows;
}

function requireSchema(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    // Only object names are reported; never row values or connection strings.
    const names = new Set([...actual, ...expected].map((table) => table.name));
    const changed = [...names].filter(
      (name) =>
        JSON.stringify(actual.find((t) => t.name === name)) !==
        JSON.stringify(expected.find((t) => t.name === name)),
    );
    throw new Error(
      `Schema mismatch: ${changed.join(", ")}. Stop and review drift; no automatic repair.`,
    );
  }
}

async function readPlan() {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", migrationRoot), "utf8"),
  );
  if (
    manifest.files.length !== 2 ||
    ![baselineFile, legacyFile].every((file) =>
      manifest.files.some((entry) => entry.file === file),
    )
  ) {
    throw new Error(
      "Unknown migration plan. Forward migrations require a reviewed runner update; never mark unexecuted files applied.",
    );
  }
  const sql = new Map();
  for (const entry of manifest.files) {
    const contents = await readFile(new URL(entry.file, migrationRoot), "utf8");
    // Normalize checkout line endings, but detect any SQL/content edit.
    const normalized = contents.replace(/\r\n/g, "\n");
    if (digest(normalized) !== entry.sha256)
      throw new Error(`Migration checksum mismatch: ${entry.file}`);
    sql.set(entry.file, normalized);
  }
  const expectedText = await readFile(
    new URL("expected-schema.json", migrationRoot),
    "utf8",
  );
  if (digest(expectedText.replace(/\r\n/g, "\n")) !== manifest.schemaSha256) {
    throw new Error("Expected schema checksum mismatch.");
  }
  return { manifest, sql, expected: JSON.parse(expectedText) };
}

async function ledgerExists(client) {
  const { rows } = await client.query(
    "SELECT to_regclass('rz_migrations.history') IS NOT NULL AS present",
  );
  return rows[0].present;
}

async function verifyLedger(client, manifest) {
  const { rows } = await client.query(
    "SELECT file, sha256, disposition FROM rz_migrations.history ORDER BY file",
  );
  const expected = [...manifest.files].sort((a, b) =>
    a.file.localeCompare(b.file),
  );
  if (
    rows.length !== expected.length ||
    rows.some(
      (row, i) =>
        row.file !== expected[i].file ||
        row.sha256 !== expected[i].sha256 ||
        !["applied", "adopted", "included"].includes(row.disposition),
    )
  ) {
    throw new Error(
      "Migration history conflict. Stop; do not edit or replace history.",
    );
  }
}

export async function migrate(client, mode) {
  if (!["baseline", "upgrade", "adopt", "check"].includes(mode))
    throw new Error("Unknown migration mode.");
  const { manifest, sql, expected } = await readPlan();
  await client.query(mode === "check" ? "BEGIN READ ONLY" : "BEGIN");
  try {
    await client.query("SET LOCAL search_path = public");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (mode !== "check") {
      const { rows } = await client.query(
        "SELECT pg_try_advisory_xact_lock(1381647945, 2) AS locked",
      );
      if (!rows[0].locked)
        throw new Error("Another migration is running; retry later.");
    }
    const otherHistory = await client.query(`SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = '__drizzle_migrations' AND n.nspname NOT LIKE 'pg_%'
    ) AS present`);
    if (otherHistory.rows[0].present)
      throw new Error(
        "Existing Drizzle migration history found. Stop for reconciliation.",
      );
    const actual = await fingerprint(client);
    if (await ledgerExists(client)) {
      await verifyLedger(client, manifest);
      requireSchema(actual, expected);
      if (mode !== "check")
        throw new Error(
          "Database already tracked. Use check; never replay baseline or adoption.",
        );
    } else {
      if (mode === "check") {
        requireSchema(actual, expected);
        throw new Error(
          "Schema matches, but history is untracked. Explicit adoption required.",
        );
      }
      const ledgerSchema = await client.query(
        "SELECT 1 FROM pg_namespace WHERE nspname = 'rz_migrations'",
      );
      if (ledgerSchema.rowCount)
        throw new Error(
          "Unexpected rz_migrations schema. Stop for history reconciliation.",
        );
      if (mode === "baseline") {
        if (actual.length)
          throw new Error(
            "Baseline requires an empty public schema. Use preflight/adoption for an existing database.",
          );
        await client.query(sql.get(baselineFile));
      } else if (mode === "upgrade") {
        // The one supported historical shape: current schema minus the rate-limit table.
        requireSchema(
          actual,
          expected.filter((table) => table.name !== "rate_limit_buckets"),
        );
        const legacy = sql.get(legacyFile);
        // Preserve the historical file byte-for-byte; move its outer transaction
        // into this transaction so DDL, verification and history commit atomically.
        const body = legacy
          .replace(/^([\s\S]*?)\bBEGIN;\s*/, "")
          .replace(/\s*COMMIT;\s*$/, "");
        if (body === legacy || /\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i.test(body)) {
          throw new Error(
            "Unexpected legacy transaction wrapper. Stop for review.",
          );
        }
        await client.query(body);
      } else {
        requireSchema(actual, expected);
      }
      requireSchema(await fingerprint(client), expected);
      await client.query(`CREATE SCHEMA rz_migrations;
        CREATE TABLE rz_migrations.history (
          file text PRIMARY KEY, sha256 varchar(64) NOT NULL,
          disposition text NOT NULL CHECK (disposition IN ('applied','adopted','included')),
          recorded_at timestamptz NOT NULL DEFAULT now()
        )`);
      for (const entry of manifest.files) {
        const disposition =
          mode === "baseline"
            ? entry.file === baselineFile
              ? "applied"
              : "included"
            : mode === "upgrade" && entry.file === legacyFile
              ? "applied"
              : "adopted";
        await client.query(
          "INSERT INTO rz_migrations.history (file, sha256, disposition) VALUES ($1,$2,$3)",
          [entry.file, entry.sha256, disposition],
        );
      }
      await verifyLedger(client, manifest);
    }
    await client.query("COMMIT");
    return { mode, tables: expected.length, status: "verified" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const [mode, flag, database, ...extra] = process.argv.slice(2);
  if (!mode || flag !== "--database" || !database || extra.length) {
    throw new Error(
      "Usage: node scripts/migrate.mjs baseline|upgrade|adopt|check --database EXACT_DATABASE_NAME",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "rz-fixer-reviewed-migration",
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT current_database() AS name");
    if (rows[0].name !== database)
      throw new Error("Target database does not match explicit confirmation.");
    console.log(JSON.stringify(await migrate(client, mode)));
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error) => {
    // PostgreSQL errors can include SQL/data; only known operator errors are shown.
    console.error(
      error.code
        ? `Migration failed (PostgreSQL ${error.code}); transaction rolled back.`
        : error.message,
    );
    process.exitCode = 1;
  });
}
