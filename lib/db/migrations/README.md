# Reviewed PostgreSQL provisioning and migration plan

Phase 2, 2026-11-01. These commands are manual operator actions, never startup,
build, deployment hooks, or `drizzle-kit push`. No production database was accessed.

## Files and history

- `20260929_add_rate_limit_buckets.sql` is the only previously committed SQL
  migration. Its contents are unchanged. It was additive and had no migration
  journal; the repository does not establish which live database ran it.
- `baseline/20261101_baseline.sql` provisions **empty databases only**. It matches
  all 42 statements generated from the current 11 Drizzle tables, with ordering
  changed to tables/inline constraints, 20 explicit indexes, then 11 foreign keys.
  Unique constraints on `repair_requests.request_id` and `bookings.booking_id` must
  exist before the review/invitation foreign keys reference those columns.
- `expected-schema.json` records column types, nullability, defaults, primary and
  unique constraints, foreign keys (including delete actions and validation),
  index definitions/validity, and table kinds/row-security flags. It was captured
  on PostgreSQL 16.15, the major version the production database runs. Its
  formatting is not a promise of cross-version catalog
  identity: rehearse against the actual target PostgreSQL major version.
- `manifest.json` pins normalized-LF SHA-256 checksums. The explicit ledger in
  `rz_migrations.history` distinguishes SQL applied, existing objects adopted,
  and historical SQL included in a fresh baseline. Adoption does not pretend
  the baseline was executed on an existing database.

Do not introduce a Drizzle journal alongside this ledger without a separate
reconciliation plan. Do not rewrite applied SQL/checksums to hide drift. The
runner refuses other Drizzle history, checksum differences, unexpected ledger
rows, and unknown application table/index/constraint shapes.

## Preflight and supported paths

First obtain a verified backup and restore it into an isolated staging database
on the same PostgreSQL major version, extensions, collation, and application
role setup as the target. Review schema-only exports and non-sensitive integrity
counts. The synthetic tests establish compatibility with the known schema, not
with uninspected production data, triggers, policies, privileges or extensions.
Do not use production credentials for tests.

Set `DATABASE_URL` through the approved secret mechanism; do not paste it into
logs or commit an environment file. Every command also requires the **exact
database name** as a second confirmation. From the repository root:

```text
pnpm --filter @workspace/db run migrate check --database EXACT_DATABASE_NAME
```

`check` is read-only. It verifies the current schema and checksums of a tracked
database. A matching untracked database reports that adoption is required and
exits nonzero; schema differences identify object names without printing data.
An old database missing rate limiting reports a schema mismatch until its
supported upgrade is explicitly selected. A connection name mismatch stops
before any migration transaction.

Choose exactly one path on the staging copy first:

| Database state | Explicit action | Application objects changed |
| --- | --- | --- |
| Empty `public` schema; no migration history | `migrate baseline --database NAME` | Create all 11 tables, indexes and FKs |
| Current 11-table schema, no ledger | `migrate adopt --database NAME` | None; record verified adoption only |
| Current schema except missing `rate_limit_buckets` table/index, no ledger | `migrate upgrade --database NAME` | Execute the original additive rate-limit migration only |
| Already tracked, current schema | `migrate check --database NAME` | None |
| Anything else, including partial rate-limit table, older nullable/constraint shapes, unexpected tables or journals | Stop and reconcile | No automatic repair |

The representative previous profile models a database before applying the sole
historical additive SQL file. It is deliberately narrow: it does **not** claim
to upgrade every schema ever produced by `push`. Git commit `d1f7435` changed
`reviews_review_id_unique` from a unique index into a named unique constraint.
An older index-only database is detected and rejected. Do not drop the index,
recreate tables, replace journals, or invent an applied history to get past this.
Inspect dependencies and a restored copy, then prepare a separately reviewed
additive reconciliation migration if that actual state is encountered.

The runner uses one transaction for DDL, verification and ledger writes, with
an advisory transaction lock, 5-second lock timeout and 30-second statement
timeout. The historical file's own outer BEGIN/COMMIT are removed **in memory**
so they cannot prematurely commit this transaction. No SQL file is rewritten.
Re-running a write mode on an already tracked database stops; `check` is safe
to repeat. Do not run concurrent external schema writers during migration.

## Data integrity and compatibility

No new application constraints, column changes, data rewrites or deletes were
introduced for existing databases. UUID primary keys/defaults, nullable guest
customer links and optional repair date/time fields remain unchanged. Bookings
retain their required customer and visit fields, including legacy free-text
appliance/time values; migration does not impose current HTTP validation on old
rows. Existing primary/unique indexes and all 11 FK delete actions are preserved.

- Repair request IDs retain their unique index. API retry IDs and full-payload
  comparisons retain their Phase 1 behavior; no idempotency keys are regenerated.
- Invitation `used_at` and `review_id` are preserved verbatim, including old
  pointer-only consumption. `review_id` is deliberately **not** a foreign key:
  deleting a review must not erase the durable consumed marker or reopen a token.
  Claiming an invitation and inserting its review remain one API transaction.
- Nullable customer FKs on requests/reviews/invitations still use SET NULL;
  customer auth/reset tokens and bookings still use CASCADE. Review/invitation
  source links retain CASCADE. This baseline does not change deletion policy.
- Unique hashed admin sessions, admin-user cascade, and session expiry index
  remain intact. No password/session hashes are migrated or logged.
- Rate limiting retains its hashed bucket PK, timestamp array, expiry index and
  transaction advisory lock. Proxy trust remains exactly `127.0.0.1/32`, `::1/128`.

There is no database CHECK for rating bounds, status values or exactly one
review source in the existing schema. Do not add those during adoption. Before
any future tightening, count invalid ratings/statuses, missing or dual source
links, duplicate candidate keys, dangling FKs, nulls and consumed invitations
on a restored copy. Review remediation with the owner before changing data.
Additional expiry/customer-email indexes are performance proposals only, pending
query plans and table sizes; none were added speculatively.

## Forward migrations

The Phase 2 runner intentionally recognizes only these two SQL inputs; it does
not auto-glob migrations or mark unknown files applied. For the next schema
change, create a **new** numbered additive SQL file and retain both historical
checksums. Extend the runner with an ordered pending-migration chain and explicit
pre/post fingerprints, execute/record only genuinely pending files, and test
both a fresh baseline plus all forward files and every supported upgrade path.
Do not replace the baseline with a snapshot of a later schema while it is in use.

Create referenced tables and candidate unique keys before adding dependent FKs.
For large populated tables, plan any concurrent index creation separately from
the transaction runner; never add `CONCURRENTLY` inside its transaction. Consider
`NOT VALID` foreign/check constraints with explicit later validation where
appropriate, after synthetic and restored-data compatibility checks. Such work
requires its own reviewed migration and was not executed here.

## Rollback and recovery

1. Before an approved real migration, create a protected PostgreSQL custom-format
   backup (`pg_dump -Fc`) and save a schema-only export and ledger export. Record
   server/client versions and backup completion; retain according to the owner's
   policy. A file existing is not proof that it restores.
2. Restore the backup into a **new isolated database** with `pg_restore
   --exit-on-error --single-transaction`. Do not use `--clean` on a live database.
   Compare schema/ledger and data counts/digests, and exercise core flows there.
3. On statement, lock, checksum or verification failure, the runner rolls back
   the transaction, including newly created tables and ledger. An injected
   post-DDL ledger failure is covered by the migration tests. Fix the cause and
   inspect the actual state before retrying.
4. If an already committed upgrade causes an application problem, stop writes,
   assess a forward fix and preserve the current backup/WAL. The additive rate
   table can remain while rolling back application code. Do not run a destructive
   DOWN migration to remove it or erase the ledger.
5. For recovery from data loss, restore to a new database or use tested PITR
   according to the actual hosting topology, verify, then perform a separately
   approved cutover. Do not overwrite the existing database as a shortcut.

No production rollback, schema change, backup or cutover is authorized by this
Phase 2 work. Actual backup retention, PITR and credentials remain deployment
prerequisites.

## Verification

Migration tests use an explicitly supplied `RZ_MIGRATION_TEST_URL`, require an
IP loopback host and a dedicated `rz_phase2_` database, create new random test
databases, and never fall back to the application's `DATABASE_URL`.

```text
pnpm --filter @workspace/db run test:migrations
```

They verify fresh provisioning, old generator ordering failure, additive upgrade,
adoption, row-for-row synthetic data preservation, invitation deletion behavior,
uniqueness/FKs, incompatible shapes and journals, ledger conflicts, concurrent
migration locking, and transactional recovery. These are local PostgreSQL tests,
not a substitute for testing a protected production restore before rollout.

## Pooling and connection recommendations (no application configuration changed)

The production connection topology is unknown. Keep these as deployment review
inputs, not hardcoded application defaults. Start with a small pool (for example
5-10 connections **per API process**) and budget all workers, admin tools and
maintenance clients below the database connection limit, with an operational
reserve. A pooler may require a smaller per-process pool; benchmark rather than
multiply defaults across replicas.

Consider a 5-10 second connection timeout, 30-60 second idle connection timeout,
5-15 second ordinary statement timeout, short lock timeout, and an
idle-in-transaction timeout. Verify actual query latency, SMTP interaction and
transaction boundaries before selecting values. The standalone migration client
already bounds connection establishment to 10 seconds and its own transaction
statements/locks as described above. Verify TLS/CA requirements, pooler mode and
prepared-statement behavior for the selected host. Runtime pool limits, graceful
shutdown and readiness work need a separate topology-aware change.
