# RZ Fixer

Customer-facing website and API for **RZ Fixer**, a home-appliance repair service in Bengaluru.

Visitors submit a repair request without creating an account and receive a unique **Request ID** back. Staff sign in to the admin dashboard to triage requests, update their status and moderate customer reviews.

Live site: <https://rzfixer.in>

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database and migrations](#database-and-migrations)
- [API reference](#api-reference)
- [Testing](#testing)
- [Continuous integration](#continuous-integration)
- [Container deployment](#container-deployment)
- [Security model](#security-model)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Public guest repair requests** — no account required; the server owns the Request ID and status values.
- **Registered customer requests** — signed-in customers are linked to their repair requests via `customer_id`; guest submissions are stored with `customer_id = NULL`.
- **Validated intake** — request bodies are validated against the shared OpenAPI contract, including calendar-date and time-of-day checks on the preferred visit slot.
- **Idempotent submissions** — a repeated submission with the same Request ID does not create a second request or send a second email.
- **Admin dashboard** — HTTP-only admin session cookie, search and filtering, request status management, and customer contact details visible only to authenticated administrators.
- **Customer reviews** — single-use review invitations delivered by email, moderated in the admin area.
- **Website availability switch** — a persisted flag can take the public site offline while keeping admin authentication and the dashboard reachable, so service can be restored without locking yourself out.
- **Rate limiting** on guest submissions and admin login attempts.
- **Transactional request lifecycle** — repair requests are persisted before success is returned, and status-change emails are recorded per request.

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.9.3 |
| Runtime | Node.js 24.15.0 (engines: `>=24.15.0 <25`) |
| Package manager | pnpm 10.34.9 (workspace) |
| Frontend | React 19.1.0, Vite 7.3.7, Tailwind CSS 4.1.14, Wouter 3.3.5, Radix UI, lucide-react, framer-motion, react-hook-form, date-fns, recharts, zod 4.6.6 |
| Backend | Express 5.2.1, cookie-parser, cors, bcryptjs 2.4.3, nodemailer 10.1.4, pino 9.14.0 / pino-http 10.5.0 |
| Database | PostgreSQL 16.15, Drizzle ORM 0.45.2, `pg` 8.23.0 |
| API contract | OpenAPI (`lib/api-spec/openapi.yaml`) with Orval 8.34.0 generating the Zod validators and the React client |
| Containers | Docker (multi-stage, pinned image digests) |
| CI | GitHub Actions |

## Repository layout

```
.
├── artifacts/
│   ├── api-server/                    Express API (routes, lib, tests)
│   ├── rz-home-appliances-care/       customer-facing website (Vite + React)
│   └── mockup-sandbox/                design sandbox, not deployed
├── lib/
│   ├── api-spec/                      OpenAPI contract + Orval config
│   ├── api-zod/                       generated Zod validators
│   ├── api-client-react/              generated typed client
│   └── db/                            Drizzle schema, migrations, migrate runner
├── docker/                            Dockerfiles, nginx, healthcheck, env example
├── scripts/ci/                        CI helpers and their regression tests
├── docs/                              phase reports (dependency security, CI/Docker, remediation)
├── security/audit-baseline.json       accepted dependency-findings baseline
├── docker-compose.yml                 local container stack
├── .github/workflows/main.yml         CI pipeline
└── pnpm-workspace.yaml                workspace config, version catalog, security overrides
```

## Prerequisites

| Requirement | Version | Needed for |
|---|---|---|
| Node.js | `24.15.0` (accepts `>=24.15.0 <25`) | everything |
| pnpm | `10.34.9` | everything |
| PostgreSQL | `16.15` | the migration test suite; the container stack provides its own |
| Docker + Compose v2 | recent | the container stack |

The workspace lockfile is restricted to `linux-x64` platform packages, so **build and test on Linux x64** (a container, WSL, or a Linux host).

## Quick start with Docker

This is the same topology used for the production deployment: a static site and the API behind Nginx, with PostgreSQL on a private internal network.

```bash
# 1. Create the local environment file and fill in the two required secrets.
cp docker/.env.example docker/.env.local
#    set POSTGRES_PASSWORD, ADMIN_PASSWORD and APP_BASE_URL in docker/.env.local

# 2. Build and start PostgreSQL and the API.
docker compose --env-file docker/.env.local up -d --build postgres network api

# 3. Apply the database baseline. The API health check waits for the schema,
#    so this must run before the frontend can start.
docker compose --env-file docker/.env.local exec api \
  node /app/lib/db/scripts/migrate.mjs baseline --database rz_phase2_local

# 4. Start the frontend.
docker compose --env-file docker/.env.local up -d frontend
```

The site is then served on <http://127.0.0.1:8080>. The port comes from `WEB_PORT` in `docker/.env.local` (default `8080`) and is bound to `127.0.0.1` only.

The `--database` argument must be the exact database name from `POSTGRES_DB` (default `rz_phase2_local`).

To stop the stack without deleting the database volume:

```bash
docker compose --env-file docker/.env.local stop
```

> `docker/.env.local` is ignored by Git (`.env.*`), so local secrets are never committed.

## Local development

```bash
pnpm install --frozen-lockfile
```

Run the API and the website in separate shells, with the environment exported into each process (see [Environment variables](#environment-variables)):

```bash
# API server
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE \
PORT=3000 NODE_ENV=development APP_BASE_URL=http://localhost:3000 \
pnpm --filter @workspace/api-server run dev

# Website
PORT=23672 BASE_PATH=/ pnpm --filter @workspace/rz-home-appliances-care run dev
```

Other commands:

```bash
pnpm run typecheck                                                    # typecheck the workspace
pnpm run build                                                        # typecheck, then build every package
PORT=23672 BASE_PATH=/ pnpm run build                                 # build with artifact routing values
pnpm --filter @workspace/rz-home-appliances-care run typecheck         # typecheck the website
pnpm --filter @workspace/api-server run typecheck                     # typecheck the API
```

### Local development limitations

These are properties of the current build, not workarounds you can ignore:

- **The API does not load `.env` files.** There is no dotenv loader anywhere in the repository; the API reads `process.env` only. A `.env` file on disk is never read. Export the variables into the process (shell `export`, PM2 environment, Compose `--env-file` interpolation, a systemd `EnvironmentFile`, or `node --env-file=…`). `.env.example` is a **reference list of required keys**, not an auto-loaded file.
- **The Vite build and dev server require `PORT` and `BASE_PATH`.** `vite.config.ts` throws if either is missing. `BASE_PATH` is compiled into the client bundle and must match the path the site is served from.
- **The Vite dev server does not proxy `/api`.** The generated client uses the relative base URL `/api`, which Nginx serves in the container topology. For browser-based integration testing, use the container stack above.
- **Some scripts use POSIX shell syntax** and therefore fail on Windows `cmd`/PowerShell:
  - `pnpm --filter @workspace/api-server run dev` starts with `export NODE_ENV=development && …`
  - `pnpm --filter @workspace/api-server run test:release` uses the `REQUIRE_IPV6_LOOPBACK=1 …` prefix

  To run the **strict IPv6 release gate** on Windows, run the command that the POSIX script expands to, with the variable set in the shell:

  ```powershell
  $env:REQUIRE_IPV6_LOOPBACK = "1"
  pnpm --filter @workspace/api-server exec tsx --test test/*.test.ts 2>&1 |
    Out-File -FilePath strict-ipv6.log -Encoding utf8
  node scripts/ci/verify-tests.mjs strict-ipv6.log
  ```

  In the `@workspace/api-server` package, `test:release` is `REQUIRE_IPV6_LOOPBACK=1 pnpm run test` and `test` is `tsx --test test/*.test.ts`. The block above runs exactly that, followed by the same `verify-tests.mjs` gate CI uses — it is the same strict gate, not the ordinary suite.

  `Out-File -Encoding utf8` is required rather than `Tee-Object`, because PowerShell's `Tee-Object` writes UTF-16LE, which the gate parser cannot read.

## Environment variables

The API reads `process.env` directly. Only `PORT` and `DATABASE_URL` are **enforced** — the process throws at startup if either is missing. The remaining variables change behaviour rather than being validated, and several of them are security-relevant.

| Variable | Required | Default | Purpose / failure mode |
|---|---|---|---|
| `PORT` | **Yes** | — | Mandatory for the API **and** for Vite: both throw if it is unset. The API listens on it; `vite.config.ts` also requires it for the dev and preview servers. The API image sets it to `3000`. |
| `NODE_ENV` | No | unset | Nothing throws when it is unset. **Set it to `production` in production:** it enables the `Secure` cookie attribute, JSON logs instead of pretty-printed logs, the trusted-proxy self-check and the `https`-only CORS rule. Without it, session cookies are not marked `Secure`. |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. `lib/db` throws on import if unset. |
| `APP_BASE_URL` | No | unset | Not validated, but functionally required: it is the CORS allow-list **and** the base for review links in emails. Without it, review invitations contain no link. Set it to the real `https` origin in production. |
| `APP_BASE_PATH` | No | unset | Path prefix applied to generated review links. |
| `ADMIN_PASSWORD` | No | unset | First-admin bootstrap only, used while the admin table is uninitialised. |
| `PRODUCTION_PROXY_PEERS` | No | unset | **Does not control the trust list** — that is hard-coded to `127.0.0.1/32` and `::1/128`. The variable is only compared against it as a startup self-check, and only when `NODE_ENV=production`. A mismatch logs an error on every start. |
| `LOG_LEVEL` | No | `info` | pino log level. |
| `SMTP_HOST` | ✅ for email | — | SMTP server. |
| `SMTP_PORT` | ✅ for email | `587` | **Must be `587`.** The transport rejects any other port. |
| `SMTP_SECURE` | ✅ for email | `false` | **Must be `false`** when the port is 587. |
| `SMTP_REQUIRE_TLS` | ✅ for email | `true` | **Must be `true`.** |
| `SMTP_USER` | ✅ for email | — | SMTP account. |
| `SMTP_APP_PASSWORD` | ✅ for email | — | SMTP app password. |
| `EMAIL_FROM` | ✅ for email | — | Sender address for notifications. |
| `OWNER_EMAIL` | ✅ for email | — | Recipient for new-request notifications. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | ✅ for Compose | `rz_local` / — / `rz_phase2_local` | Container database. `POSTGRES_PASSWORD` fails the stack closed if unset. |
| `WEB_PORT` | — | `8080` | Host port for the container stack (bound to `127.0.0.1`). |
| `BASE_PATH` | ✅ for frontend | — | Base path compiled into the client bundle. |
| `RZ_MIGRATION_TEST_URL` | CI only | — | Connection URL for the migration test suite. |
| `RUNNER_TEMP` / `GITHUB_STEP_SUMMARY` / `RESULTS` | CI only | — | CI artifact paths and the dependency-gate aggregate. |

`.env.example` and `docker/.env.example` are the reference templates.

## Database and migrations

The schema lives in `lib/db/src/schema/` (Drizzle). `lib/db/migrations/` holds a
checksummed migration plan plus the expected-schema fingerprint, and
`lib/db/scripts/migrate.mjs` is the runner.

```bash
pnpm --filter @workspace/db run migrate baseline --database <DATABASE_NAME>
pnpm --filter @workspace/db run migrate upgrade  --database <DATABASE_NAME>
pnpm --filter @workspace/db run migrate adopt    --database <DATABASE_NAME>
pnpm --filter @workspace/db run migrate check    --database <DATABASE_NAME>
```

| Mode | Use when | What it does |
|---|---|---|
| `baseline` | The target database is **empty** | Creates the full schema and the migration ledger. Refuses to run if the `public` schema already has tables. |
| `upgrade` | The database has the current schema but **without** the rate-limit table | Applies the one supported historical migration. |
| `adopt` | The database **already has** the current schema | Creates the ledger only — **no DDL on application tables**. |
| `check` | Any time | Read-only verification. Runs inside `BEGIN READ ONLY`. |

`DATABASE_URL` must be set, and `--database` must be the exact database name.
The runner takes a PostgreSQL advisory lock, verifies plan checksums against
`manifest.json`, and refuses to continue on checksum or ledger conflicts.

Full procedure: [`lib/db/migrations/README.md`](lib/db/migrations/README.md).

## API reference

All endpoints are served under `/api` by the Express API. The 18 routes below are every route registered in `artifacts/api-server/src/routes/`.

| Method | Path | Access |
|---|---|---|
| `GET` | `/api/healthz` | Public |
| `GET` | `/api/site-status` | Public |
| `GET` | `/api/reviews` | Public |
| `POST` | `/api/repair-requests` | Public (guest) or customer session |
| `GET` | `/api/customer/review-target` | Customer session |
| `POST` | `/api/customer/reviews` | Customer session |
| `POST` | `/api/admin/auth/login` | Public, rate limited |
| `POST` | `/api/admin/auth/logout` | Admin session |
| `GET` | `/api/admin/auth/me` | Admin session |
| `GET` | `/api/admin/repair-requests` | Admin session |
| `GET` | `/api/admin/repair-requests/:requestId` | Admin session |
| `PATCH` | `/api/admin/repair-requests/:requestId` | Admin session |
| `GET` | `/api/admin/reviews` | Admin session |
| `GET` | `/api/admin/reviews/:reviewId` | Admin session |
| `PATCH` | `/api/admin/reviews/:reviewId` | Admin session |
| `DELETE` | `/api/admin/reviews/:reviewId` | Admin session |
| `GET` | `/api/admin/site-status` | Admin session |
| `PATCH` | `/api/admin/site-status` | Admin session |

The contract is [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml).
Regenerate the Zod validators and the React client after changing it:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Admin mutations additionally require a matching `Origin` header; see
[Security model](#security-model).

## Testing

| Suite | Command | Count |
|---|---|---|
| Backend | `pnpm --filter @workspace/api-server run test` | 42 |
| Strict IPv6 release gate | `pnpm --filter @workspace/api-server run test:release` | 42, zero skipped |
| Database migrations | `pnpm --filter @workspace/db run test:migrations` | 12 |
| CI helpers and contract tests | `node --test scripts/ci/*.test.mjs` | 48 |
| Types | `pnpm run typecheck` | — |

Notes:

- The **strict IPv6 gate** fails the run if IPv6 loopback support is missing, rather than skipping. It uses a POSIX `VAR=value` prefix, so on Windows run the equivalent command in [Local development limitations](#local-development-limitations) — the same strict gate, not the ordinary suite.
- The **migration suite** creates and drops isolated databases on a local PostgreSQL instance and therefore needs an explicit, loopback-only URL:

  ```bash
  RZ_MIGRATION_TEST_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/rz_phase2_local \
    pnpm --filter @workspace/db run test:migrations
  ```

  The database name must match `rz_phase2_<lowercase>`.

## Continuous integration

[`.github/workflows/main.yml`](.github/workflows/main.yml) runs on every push to `main` and on every pull request targeting `main`.

| Job | Purpose |
|---|---|
| **A — Installation and integrity** | Frozen install, lockfile integrity, package-graph verification |
| **B — TypeScript and configured quality checks** | Typecheck, lint helpers, Compose static validation, CI helper tests |
| **C — PostgreSQL baseline, upgrade and rollback** | Migration suite against PostgreSQL 16.15 |
| **D — Backend and strict IPv6 regressions** | Backend suite plus the zero-skip IPv6 release gate |
| **E — Audit regression gate** | Dependency audit against `security/audit-baseline.json` |
| **F — Production builds and runtime assets** | Production build of every package and asset verification |
| **`check`** | Required status-check context; runs even when a dependency failed and succeeds only if **all six** jobs succeeded |

The workflow has `permissions: contents: read` and uses `persist-credentials: false`.
**CI does not deploy.** It performs checks only; deployment is a separate,
deliberate step.

## Container deployment

`docker/` contains the production images:

| File | Purpose |
|---|---|
| `docker/Dockerfile.frontend` | Builds the Vite site and serves it from Nginx |
| `docker/Dockerfile.api` | Multi-stage build of the API, production dependencies only |
| `docker/nginx.conf` | Serves the SPA and reverse-proxies `/api/` to the API |
| `docker/security-headers.conf` | Content-Security-Policy and related response headers |
| `docker/api-healthcheck.mjs` | Verifies the API, the database and the migration ledger |

The Compose stack runs four services. `api` and `frontend` share the network
namespace of the `network` service, so the API is always reachable over
loopback from Nginx and never needs to be exposed. The `database` network is
`internal`, so PostgreSQL is unreachable from outside the stack. Containers run
as non-root with read-only root filesystems, `cap_drop: [ALL]` and
`no-new-privileges`.

TLS termination is the responsibility of the edge in front of the stack. The
application does not emit `Strict-Transport-Security`; the edge owns that
header so it is not duplicated.

## Security model

- **Trusted proxies** — the API trusts exactly `127.0.0.1/32` and `::1/128`.
  A request from any other peer cannot choose its own forwarded address.
  `PRODUCTION_PROXY_PEERS` must mirror this list; the API logs an error at
  startup if it does not.
- **Admin origin checks** — admin mutations are rejected unless the request's
  `Origin` matches the origin derived from the forwarded scheme and `Host`.
  Requests without an `Origin` header are rejected.
- **CORS** — only the origin in `APP_BASE_URL` is allowed.
- **Sessions** — opaque random tokens in HTTP-only, `SameSite=Lax` cookies;
  only SHA-256 hashes are stored in PostgreSQL. The `Secure` attribute is
  applied when `NODE_ENV=production`.
- **Passwords** — admin and customer passwords are stored as bcrypt hashes.
- **Reset and review links** — single-use random tokens, stored hashed, with
  short expiry.
- **Rate limiting** — guest submissions and admin login attempts are limited
  per client address.
- **Dependency posture** — the workspace pins a minimum release age for npm
  packages, restricts the lockfile to `linux-x64`, and overrides known-vulnerable
  transitive versions. `security/audit-baseline.json` records the accepted
  findings and carries a review-by date; the audit gate fails once that date
  passes, so the baseline must be reviewed deliberately.

## Documentation

| Document | Contents |
|---|---|
| [`docs/phase-2-dependency-security.md`](docs/phase-2-dependency-security.md) | Dependency security phase report |
| [`docs/phase-3-ci-docker.md`](docs/phase-3-ci-docker.md) | CI and container phase report |
| [`docs/phase-4-security-remediation.md`](docs/phase-4-security-remediation.md) | Security remediation report |
| [`lib/db/migrations/README.md`](lib/db/migrations/README.md) | Migration runner: modes, preflight, backup and restore procedure |
| [`security/audit-baseline.json`](security/audit-baseline.json) | Accepted dependency findings and review date |

## Contributing

1. `pnpm install --frozen-lockfile`
2. Make the change, then run the gates:

   ```bash
   pnpm run typecheck
   node --test scripts/ci/*.test.mjs
   pnpm --filter @workspace/api-server run test
   ```

3. Open a pull request. CI must be green, and the required `check` context must
   pass, before a change can be merged.
4. If you change the API contract, run `pnpm --filter @workspace/api-spec run codegen` and commit the regenerated packages.
5. If you change `lib/db/migrations/`, update `manifest.json` with the new SHA-256 checksums and re-run the migration suite.

## License

MIT — as declared by `"license": "MIT"` in `package.json`. The repository does not yet contain a `LICENSE` file; adding it is an outstanding item.
