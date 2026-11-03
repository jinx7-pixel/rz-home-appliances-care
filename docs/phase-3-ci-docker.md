# Phase 3: CI and local/staging containers

This phase prepares CI and container configuration. It does not deploy, grant
production access, accept the remaining vulnerabilities, or authorize a VPS
change. The source inventory is recorded separately in the Phase 3 report.

## GitHub Actions

The existing `.github/workflows/main.yml` is updated in place. It runs for pull
requests targeting `main`, pushes to `main`, and manual dispatch. Feature-branch
pushes do not also trigger a duplicate workflow. Concurrency cancels outdated
runs for the same PR/ref. No `pull_request_target`, deployment, SSH, registry
publishing, production environments or application secrets are used.

Permissions are `contents: read`; checkout does not persist credentials or clean
an existing checkout. All external actions are pinned to verified upstream
release commit SHAs and execute on Node 24. Their reviewed release metadata:

| Action | Release | Commit |
| --- | --- | --- |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| pnpm/action-setup | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |

The local composite action installs **Node 24.15.0 / pnpm 10.34.9**, caches only
the package store, performs frozen installation, and verifies the lockfile did
not change. Each fresh Ubuntu 24.04 job installs its own dependency links; it
does not reuse Windows node_modules or a cross-platform node_modules artifact.

| Required job | Gate |
| --- | --- |
| A: installation | Exact tool versions, package graph, Linux x64/glibc and native Vite/esbuild/Tailwind loading |
| B: quality | Workspace typecheck, configured lint scripts if any, CI helper tests, offline Compose validation |
| C: migrations | Existing 12-test suite: fresh baseline, supported upgrades, adoption, data preservation, drift and rollback |
| D: backend | Explicit fresh service-DB baseline, full regression suite, then existing strict IPv6 release entrypoint with zero-skip assertion |
| E: security | Full and production audits; fail on findings outside the exact version/severity/scope baseline |
| F: builds | Existing root build, including frontend, mockup and API; assert HTML/CSS/JS and all required logging worker assets |

The final `check` job — the status-check context required by branch protection
on `main` — runs even if a dependency job failed or was skipped
and succeeds only if **all six** jobs succeeded. The PostgreSQL jobs use separate
ephemeral PostgreSQL 16.15 service containers with health checks, loopback-mapped
ports and hardcoded **synthetic CI-only** credentials. Migration tests need
CREATEDB; the disposable service role is deliberately privileged. That role
configuration is not a production privilege recommendation.

No lint scripts/configuration existed at implementation. The lint helper
explicitly reports **NOT RUN** in that case; it is not a claimed lint pass.
`actionlint` and Dockerfile checks used locally are separate configuration checks.

## Existing security findings

After Phase 4, `security/audit-baseline.json` has **no finding exceptions**.
Both full and production audits report zero vulnerabilities. Zod is 4.6.6,
resolvers are 5.2.2 and Orval is 8.34.0; the unused TypeDoc/minimatch chain is
removed through that upstream minor update. A narrowly scoped Scalar override
keeps its new Undici 7 consumer patched at 7.30.1. See
`phase-4-security-remediation.md` for compatibility evidence and verification.

This is a change-detection baseline, not a production risk acceptance. It contains
the rationale, required remediation/review, review owner and **2026-11-15 UTC**
review deadline. Expiry, changed package versions/severity, new IDs, newly
production-reachable development exceptions, malformed output and registry errors
fail the gate. Removal of a finding passes and its stale baseline should be
removed during review. No blanket ignore or audit-level suppression is used.

Audit output and the Actions summary show the known findings as open.
`node scripts/ci/audit.mjs --release` explicitly returns failure while a
high/critical finding remains. The empty baseline accepts no new findings of
any severity; CI success is not deployment approval.
There is no release/deployment workflow here.
Review the Phase 2 dependency report for compatibility constraints before changing
versions. Do not force a major upgrade simply to make an audit green.

## Running CI commands locally

Use a clean Linux x64 GNU environment with Node/pnpm versions above for a faithful
CI rehearsal. The repository intentionally excludes Windows, ARM and musl native
packages. Docker builds target `linux/amd64`, Debian variants; do not substitute
Alpine or claim ARM support without a separate lockfile/platform review.

```sh
pnpm install --frozen-lockfile
node scripts/ci/verify-install.mjs
pnpm run typecheck
node scripts/ci/lint.mjs
node --test scripts/ci/*.test.mjs
node scripts/ci/audit.mjs
NODE_ENV=production PORT=5174 BASE_PATH=/ pnpm run build
node scripts/ci/verify-build.mjs
docker compose --env-file docker/.env.example config --quiet
```

Windows Node/package checks can run, but Linux native checks explicitly remain
unexecuted there. Existing POSIX pnpm scripts require an appropriate shell on
Windows. Temporary Windows-native binaries are not part of CI or these images.

For database tests, provision dedicated **local synthetic** databases on a private
PostgreSQL instance. The migration suite requires an explicit loopback URL,
database name starting `rz_phase2_`, no query/fragment target overrides, and a role
allowed to create temporary databases. It never falls back to `DATABASE_URL`.
Do not reuse a database with real customer data. The API suite writes/deletes its
synthetic fixtures, so its URL must also point only to a newly provisioned test DB.

```sh
# Set RZ_MIGRATION_TEST_URL and DATABASE_URL privately to separate local test DBs.
pnpm --filter @workspace/db run test:migrations
pnpm --filter @workspace/db run migrate baseline --database EXACT_TEST_DATABASE
pnpm --filter @workspace/api-server run test
set -o pipefail
pnpm --filter @workspace/api-server run test:release 2>&1 | tee /tmp/rz-strict.log
node scripts/ci/verify-tests.mjs /tmp/rz-strict.log
```

## Container architecture and trust boundary

Both Dockerfiles use multi-stage Debian/GNU builds and a frozen lockfile from
the monorepo root. Shared workspace source is bundled with the API. Runtime keeps
the production dependency graph, external Nodemailer, complete Pino worker assets,
and the standalone database migration tooling. Development tooling is not required
to start the API. The API runs as the non-root Node user with exec-form Node as
its command; Nginx runs as its non-root nginx user on port 8080.

Base images are pinned to release tags **and multi-platform manifest digests**:

- Node `24.15.0-bookworm-slim`
- Nginx `1.30.6-trixie`
- PostgreSQL `16.15-bookworm`

The API's exact trusted peers remain `127.0.0.1/32` and `::1/128`. A conventional
separate bridge-network proxy would arrive from a container subnet and would not
be trusted. Both applications therefore use `network_mode: service:network`.
A small stateless Node process holds that namespace independently of app restarts.
It handles no requests or credentials. Nginx reaches the API at `127.0.0.1:3000`
inside the shared namespace. Only the namespace service publishes
**127.0.0.1:8080**, which is Nginx's listener; API port 3000 and PostgreSQL port
5432 are not published. This permits independent app restarts without losing the
loopback proxy. It remains a single-instance topology, not a scaling architecture.

The database is on an internal network and an isolated named volume. The API also
has a normal edge network for outbound SMTP. Nginx replaces inbound forwarding
headers with its socket-derived client identity; `/api` retains its prefix when
proxying. Client IP behavior must be checked on the eventual real ingress:
Docker NAT or a future external proxy may otherwise collapse clients into a
gateway address. Do not accept arbitrary inbound X-Forwarded-For to work around
that. A different topology requires a separate explicit proxy/security review.

All Nginx temporary paths use the writable `/tmp` mount so it can run non-root
with a read-only root filesystem. Relative redirects retain the caller's mapped
port instead of exposing the container's internal 8080 port.
Frontend static serving supports SPA deep links. Fingerprinted assets are
immutable; `index.html` is not cached. Frontend CSP allows same-origin scripts,
existing Google Fonts and React inline styles; the API retains its own distinct
restrictive CSP. The local HTTP container does not add HSTS; a later reviewed TLS
edge must own that policy. No live VPS Nginx configuration was touched.

The API readiness command checks HTTP `/api/healthz`, read-only database
connectivity and the presence of the 11 application tables plus the migration
ledger. It does not apply migrations and is not a complete schema-fingerprint or
business-flow test. A database without explicit provisioning/adoption stays
unhealthy. Existing `/api/healthz` application functionality is unchanged.

Background idle PostgreSQL connection errors are handled without logging the
connection object; the pool replaces those clients. Request query errors still
follow the existing API error handling. This prevents a database restart from
crashing the API or dumping connection details.
SIGTERM/SIGINT now stop new API connections, drain active HTTP requests, close the
database pool, and exit. A 15-second deadline forces an unsuccessful exit for a
stuck request/query; Compose allows 25 seconds. Nginx receives SIGQUIT, with a
10-second worker drain limit inside its 15-second Compose grace period. Persistent
volume data is retained when services stop.

## Local environment and build approval

Do not automatically start Docker Desktop/Engine. First validate configuration
offline. If the engine is stopped, the operator must start Docker Desktop with
Linux containers. **Image builds/container startup require the user's separate
approval after this configuration is reviewable.** Commands below document the
approved next step; they are not evidence that it already ran.

Copy `docker/.env.example` to an ignored `docker/.env.local` and replace local
database/admin placeholders with unique synthetic-test values. The default
Compose URL interpolates the database user/password/name: use URI-safe letters,
digits and underscores here. Do not reuse production credentials. Keep SMTP
blank for health-only smoke checks; notification attempts will record delivery
failure, not send real mail or silently mock success. For later SMTP integration
testing, provision a separately approved test account.

`APP_BASE_URL` must match a separately configured HTTPS staging origin for full
browser/admin testing. The example `.invalid` address is a placeholder. Production
cookies remain Secure; an HTTP-only smoke stack is not a complete authentication
rehearsal. Do not weaken cookies, CORS or proxy trust to make local HTTP convenient.

`.dockerignore` excludes private env files (including examples), Git history,
node_modules, generated output, logs, backups, local PostgreSQL data, common
private-key formats and Replit environment configuration. Build arguments contain
no credentials. Runtime environment variables are supported for the staging
configuration; production secret storage must be reviewed separately.

## Build, manually provision, start and inspect (after approval)

From the repository root, using **only** the isolated local env file:

```sh
docker compose --env-file docker/.env.local config --quiet
docker compose --env-file docker/.env.local build frontend api
docker compose --env-file docker/.env.local up -d --wait network postgres
docker compose --env-file docker/.env.local run --rm --no-deps api \
  node /app/lib/db/scripts/migrate.mjs baseline --database rz_phase2_local
docker compose --env-file docker/.env.local up -d --wait
docker compose --env-file docker/.env.local ps
docker compose --env-file docker/.env.local logs --tail=100 api frontend postgres network
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/healthz
curl --fail http://127.0.0.1:8080/reviews
docker compose --env-file docker/.env.local exec api node /app/docker/api-healthcheck.mjs
docker compose --env-file docker/.env.local stop
```

The database name in the migration command must match the explicitly chosen
synthetic database. `baseline` is only for a truly empty database. For existing
supported databases use the Phase 2 `adopt`, `upgrade` or read-only `check` modes
after backup/restore rehearsal. Never replay baseline, force-push schema, replace
migration history, or remove the volume to get past a mismatch. The original
migration SQL/history is unchanged and never runs automatically at startup.

Health, `/api` connectivity, database queries, SPA routing, forwarded client-IP
behavior, HTTP headers and shutdown must all be exercised after images are built.
Use a temporary local project name/volume for disposable verification to avoid
collisions with another developer stack. Do not attach an existing production
PGDATA directory to this image. PostgreSQL 16 stores its cluster in
`PGDATA=/var/lib/postgresql/data`; the volume is mounted there, and a volume
written by the PostgreSQL 18 image is not readable by this server.
Stopping the stack preserves its database; destructive volume cleanup is not part
of this workflow.

## Troubleshooting and deployment alternatives

- **Docker unavailable:** start Desktop manually, select Linux containers, then
  approve verification. Do not invoke service startup or change the user's Docker
  context automatically.
- **Native package missing:** confirm Linux x64/glibc and the exact lockfile.
  ARM/Alpine builds are unsupported by the current intentional native exclusions.
  Do not inject Windows binaries into Linux images.
- **API unhealthy:** verify DB health, exact database name, runtime credentials
  and explicit migration/adoption. Health logs intentionally omit detailed DB
  errors/connection strings. Inspect approved synthetic data only.
- **Proxy errors:** both apps must join the stable namespace service; keep the
  API on 3000 and Nginx on 8080. If the namespace-holder container is replaced,
  recreate both apps together. App restarts do not replace this namespace.
  Do not scale these fixed-port services without a separate architecture review.
- **Browser login/cookies:** confirm HTTPS origin and Secure-cookie behavior;
  HTTP health success does not prove authenticated browser flows.
- **Audit fails:** inspect new findings or baseline expiry; do not add a generic
  ignore or change severity thresholds. The baseline is empty after Phase 4;
  new findings require remediation rather than an implicit exception.
- **Lockfile mismatch:** reconcile reviewed manifests in development, not with a
  non-frozen install during CI or image builds.

The eventual VPS may use a managed PostgreSQL service, host-installed PostgreSQL,
or a separately operated database container. This file intentionally prepares a
local/staging database. Do not assume the VPS must use it. External-DB topology
needs reviewed network/TLS settings, database roles, backups and connection limits;
replace the local service/dependency in a separately approved configuration.

Future deployment automation may need names such as `VPS_HOST`, `VPS_USER`,
`VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`, `VPS_DEPLOY_PATH`, and, if a registry
is chosen, `REGISTRY_USERNAME`/`REGISTRY_TOKEN` or narrowly scoped GHCR permissions.
These are planning names only: **none are created or configured in this phase**.
Runtime DATABASE_URL, admin and SMTP credentials belong in a reviewed server-side
secret mechanism, not Docker build args, images or public workflow files. CI
currently requires no production GitHub Secrets and cannot deploy.
