import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";
import { fingerprint, migrate } from "../scripts/migrate.mjs";

// No DATABASE_URL fallback: this suite creates isolated databases on local PG only.
const url = new URL(
  process.env.RZ_MIGRATION_TEST_URL ?? "http://missing.invalid",
);
assert.equal(
  url.protocol,
  "postgresql:",
  "Set an explicit local RZ_MIGRATION_TEST_URL",
);
assert.ok(
  ["127.0.0.1", "[::1]"].includes(url.hostname),
  "Migration tests require an IP loopback host",
);
assert.match(
  url.pathname,
  /^\/rz_phase2_[a-z0-9_]+$/,
  "Use a dedicated rz_phase2_ test database",
);
assert.ok(
  !url.search && !url.hash,
  "Test connection URLs must not contain query parameters or fragments that could override the target",
);
const baseline = await readFile(
  new URL("../migrations/baseline/20261101_baseline.sql", import.meta.url),
  "utf8",
);
const statements = baseline
  .replace(/^--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
const previous =
  statements.filter((s) => !s.includes('"rate_limit_buckets"')).join(";\n") +
  ";";
const expected = JSON.parse(
  await readFile(
    new URL("../migrations/expected-schema.json", import.meta.url),
    "utf8",
  ),
);

async function isolated(t) {
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  const name = `rz_phase2_${randomUUID().replaceAll("-", "")}`;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const target = new URL(url);
  target.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: target.href });
  await client.connect();
  t.after(() => client.end());
  return client;
}

async function seed(client) {
  const customer = (
    await client.query(`INSERT INTO customers (full_name,email,password_hash)
    VALUES ('Synthetic Customer','synthetic@example.invalid','not-a-real-hash') RETURNING id`)
  ).rows[0].id;
  const admin = (
    await client.query(`INSERT INTO admin_users (username,display_name,password_hash)
    VALUES ('synthetic','Synthetic Admin','not-a-real-hash') RETURNING id`)
  ).rows[0].id;
  await client.query(
    `INSERT INTO auth_sessions (customer_id,session_hash,expires_at)
    VALUES ($1,'customer-session',now()+interval '1 day')`,
    [customer],
  );
  await client.query(
    `INSERT INTO admin_sessions (admin_user_id,session_hash,expires_at)
    VALUES ($1,'admin-session',now()+interval '1 day')`,
    [admin],
  );
  await client.query(
    `INSERT INTO password_reset_tokens (customer_id,token_hash,expires_at)
    VALUES ($1,'reset-token',now()+interval '1 day')`,
    [customer],
  );
  await client.query(
    `INSERT INTO repair_requests
    (request_id,customer_name,phone,email,appliance_type,problem_description,address,customer_id,status)
    VALUES ('REQ-SYNTHETIC','Synthetic','9999999999','synthetic@example.invalid',
      'Washing Machine','Legacy description','Synthetic address',$1,'completed')`,
    [customer],
  );
  await client.query(
    `INSERT INTO bookings (booking_id,customer_id,customer_name,email,phone,
    appliance_type,problem_description,preferred_date,preferred_time,address)
    VALUES ('BOOK-SYNTHETIC',$1,'Synthetic','synthetic@example.invalid','9999999999',
      'Legacy appliance','Legacy description','2026-01-01','Legacy free text','Synthetic address')`,
    [customer],
  );
  await client.query(
    `INSERT INTO reviews (review_id,customer_id,request_id,customer_name,customer_email,
    appliance_type,rating,review_message) VALUES ('REV-SYNTHETIC',$1,'REQ-SYNTHETIC',
    'Synthetic','synthetic@example.invalid','Legacy appliance',5,'Synthetic review')`,
    [customer],
  );
  await client.query(
    `INSERT INTO review_invitations (token_hash,customer_id,customer_email,request_id,
    review_id,expires_at,used_at) VALUES ('consumed-token',$1,'synthetic@example.invalid',
    'REQ-SYNTHETIC','REV-DELETED',now()+interval '1 day',now())`,
    [customer],
  );
  // Keep a legacy pointer-only consumed invitation too; Phase 1 rejects both shapes.
  await client.query(`INSERT INTO review_invitations (token_hash,customer_email,booking_id,review_id,expires_at)
    VALUES ('legacy-consumed','synthetic@example.invalid','BOOK-SYNTHETIC','REV-OLD',now()+interval '1 day')`);
  await client.query(
    "INSERT INTO site_settings (key,value) VALUES ('website_enabled',false)",
  );
}

async function snapshot(client) {
  const data = {};
  for (const { name } of expected.filter(
    (table) => table.name !== "rate_limit_buckets",
  )) {
    data[name] = (
      await client.query(
        `SELECT row_to_json(t) AS row FROM public."${name}" t ORDER BY row_to_json(t)::text`,
      )
    ).rows;
  }
  return data;
}

test("fresh baseline installs every table, unique target, index and validated foreign key", async (t) => {
  const client = await isolated(t);
  assert.deepEqual(await migrate(client, "baseline"), {
    mode: "baseline",
    tables: 11,
    status: "verified",
  });
  assert.deepEqual(await fingerprint(client), expected);
  await seed(client);
  await client.query(
    "INSERT INTO rate_limit_buckets VALUES ('synthetic',ARRAY[now()],now()+interval '1 hour')",
  );
  assert.equal((await migrate(client, "check")).status, "verified");
  assert.equal(
    (await client.query("SELECT count(*)::int AS n FROM rz_migrations.history"))
      .rows[0].n,
    2,
  );
});

test("unique constraints must exist before dependent foreign keys; deferred uniqueness still fails", async (t) => {
  const client = await isolated(t);

  // The baseline carries the FK-critical uniqueness as inline table
  // constraints, so it ships with the table and precedes every foreign key.
  const reordered =
    [
      ...statements.filter((s) => s.startsWith("CREATE TABLE")),
      ...statements.filter((s) => s.startsWith("ALTER TABLE")),
      ...statements.filter(
        (s) => s.startsWith("CREATE") && s.includes("INDEX"),
      ),
    ].join(";\n") + ";";
  await client.query("BEGIN");
  await client.query(reordered);
  await client.query("ROLLBACK");
  assert.deepEqual(await fingerprint(client), []);

  // Guard the underlying rule, not just this baseline: if the uniqueness is
  // ever expressed as a standalone index again and that index is created
  // after the foreign keys, PostgreSQL must reject the result with 42830.
  const deferred = [];
  const withoutInline = statements.map((statement) => {
    if (!statement.startsWith("CREATE TABLE")) return statement;
    const table = statement.match(/CREATE TABLE "([^"]+)"/)[1];
    return statement.replace(
      /,\s*CONSTRAINT "([a-z_]+)" UNIQUE\("([a-z_]+)"\)(?=\s*\))/,
      (_match, name, column) => {
        deferred.push(
          `CREATE UNIQUE INDEX "${name}" ON "${table}" USING btree ("${column}")`,
        );
        return "";
      },
    );
  });
  assert.ok(
    deferred.some((s) => s.includes('"repair_requests_request_id_unique"')) &&
      deferred.some((s) => s.includes('"bookings_booking_id_unique"')),
    "both FK-critical unique objects are inline",
  );
  const misordered =
    [
      ...withoutInline.filter((s) => s.startsWith("CREATE TABLE")),
      ...withoutInline.filter((s) => s.startsWith("ALTER TABLE")),
      ...withoutInline.filter(
        (s) => s.startsWith("CREATE") && s.includes("INDEX"),
      ),
      ...deferred,
    ].join(";\n") + ";";
  await client.query("BEGIN");
  await assert.rejects(client.query(misordered), (error) => error.code === "42830");
  await client.query("ROLLBACK");
  assert.deepEqual(await fingerprint(client), []);
});

test("upgrade adds only rate limiting and preserves UUIDs, legacy nullable fields, sessions and consumed invitations", async (t) => {
  const client = await isolated(t);
  await client.query(previous);
  await seed(client);
  const before = await snapshot(client);
  await migrate(client, "upgrade");
  assert.deepEqual(await snapshot(client), before);
  assert.deepEqual(await fingerprint(client), expected);
  assert.equal((await migrate(client, "check")).status, "verified");
  await assert.rejects(migrate(client, "upgrade"), /already tracked/);
  assert.deepEqual(await snapshot(client), before);
});

test("existing current schema is explicitly adopted without recreating application tables or data", async (t) => {
  const client = await isolated(t);
  await client.query(baseline);
  await seed(client);
  const before = await snapshot(client);
  await assert.rejects(migrate(client, "check"), /untracked/);
  await migrate(client, "adopt");
  assert.deepEqual(await snapshot(client), before);
  assert.equal((await migrate(client, "check")).status, "verified");
});

test("baseline refuses existing tables and does not alter data", async (t) => {
  const client = await isolated(t);
  await client.query(previous);
  await seed(client);
  const before = await snapshot(client);
  await assert.rejects(migrate(client, "baseline"), /empty public schema/);
  assert.deepEqual(await snapshot(client), before);
  assert.equal(
    (await client.query("SELECT to_regnamespace('rz_migrations') AS ledger"))
      .rows[0].ledger,
    null,
  );
});

test("incompatible nullable-field drift stops upgrade before DDL", async (t) => {
  const client = await isolated(t);
  await client.query(previous);
  await client.query(
    "ALTER TABLE repair_requests ALTER COLUMN address DROP NOT NULL",
  );
  const before = await fingerprint(client);
  await assert.rejects(
    migrate(client, "upgrade"),
    /Schema mismatch: repair_requests/,
  );
  assert.deepEqual(await fingerprint(client), before);
});

test("historical review unique-index versus constraint drift is reported, never silently rewritten", async (t) => {
  const client = await isolated(t);
  await client.query(baseline);
  await client.query(`ALTER TABLE reviews DROP CONSTRAINT reviews_review_id_unique;
    CREATE UNIQUE INDEX reviews_review_id_unique ON reviews(review_id)`);
  const before = await fingerprint(client);
  await assert.rejects(migrate(client, "adopt"), /Schema mismatch: reviews/);
  assert.deepEqual(await fingerprint(client), before);
});

test("unknown Drizzle history stops migration without changing any public tables", async (t) => {
  const client = await isolated(t);
  await client.query(
    "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id integer)",
  );
  await assert.rejects(
    migrate(client, "baseline"),
    /Existing Drizzle migration history/,
  );
  assert.deepEqual(await fingerprint(client), []);
});

test("ledger checksum conflicts fail without changing history", async (t) => {
  const client = await isolated(t);
  await migrate(client, "baseline");
  await client.query("UPDATE rz_migrations.history SET sha256=repeat('0',64)");
  await assert.rejects(migrate(client, "check"), /Migration history conflict/);
  assert.equal(
    (
      await client.query(
        "SELECT count(*)::int n FROM rz_migrations.history WHERE sha256=repeat('0',64)",
      )
    ).rows[0].n,
    2,
  );
});

test("migration lock contention fails promptly", async (t) => {
  const client = await isolated(t);
  const lockClient = new pg.Client(client.connectionParameters);
  await lockClient.connect();
  try {
    await lockClient.query("BEGIN; SELECT pg_advisory_xact_lock(1381647945,2)");
    await assert.rejects(migrate(client, "baseline"), /Another migration/);
    assert.deepEqual(await fingerprint(client), []);
  } finally {
    await lockClient.query("ROLLBACK");
    await lockClient.end();
  }
});

test("failure after DDL rolls back schema and ledger together", async (t) => {
  const client = await isolated(t);
  await client.query(previous);
  await seed(client);
  const before = await snapshot(client);
  const failing = {
    query: (sql, ...args) =>
      sql.startsWith("CREATE SCHEMA rz_migrations")
        ? Promise.reject(new Error("synthetic ledger failure"))
        : client.query(sql, ...args),
  };
  await assert.rejects(migrate(failing, "upgrade"), /synthetic ledger failure/);
  assert.deepEqual(await snapshot(client), before);
  assert.equal(
    (
      await client.query(
        "SELECT to_regclass('public.rate_limit_buckets') AS name",
      )
    ).rows[0].name,
    null,
  );
  assert.equal(
    (await client.query("SELECT to_regnamespace('rz_migrations') AS name"))
      .rows[0].name,
    null,
  );
});

test("existing uniqueness, relationships and durable consumed markers retain their semantics", async (t) => {
  const client = await isolated(t);
  await migrate(client, "baseline");
  await seed(client);
  await assert.rejects(
    client.query("INSERT INTO customers SELECT * FROM customers"),
    (e) => e.code === "23505",
  );
  await assert.rejects(
    client.query("UPDATE reviews SET request_id='REQ-NOT-PRESENT'"),
    (e) => e.code === "23503",
  );
  await client.query("DELETE FROM reviews");
  assert.equal(
    (
      await client.query(
        "SELECT count(*)::int n FROM review_invitations WHERE used_at IS NOT NULL OR review_id IS NOT NULL",
      )
    ).rows[0].n,
    2,
  );
  await client.query("DELETE FROM customers");
  assert.equal(
    (await client.query("SELECT count(*)::int n FROM auth_sessions")).rows[0].n,
    0,
  );
  assert.equal(
    (await client.query("SELECT customer_id FROM repair_requests")).rows[0]
      .customer_id,
    null,
  );
});
