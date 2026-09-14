# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Production ingress review

The production application router is expected to connect to the API server only
from these loopback proxy peers:

- `127.0.0.1/32`
- `::1/128`

The expected peer list is recorded in
`artifacts/api-server/.replit-artifact/artifact.toml` as
`PRODUCTION_PROXY_PEERS`. On startup, production logs a verified or unexpected
proxy configuration signal. The API also emits an error when a request arrives
from a socket peer outside the expected loopback addresses; inspect that signal
before changing deployment networking.

Changing the trusted proxy list, the recorded production peer list, or the
deployment ingress path requires an explicit security review. Do not replace
the exact loopback CIDRs with `true`, a hop count, or a broader network range.

#### On-call alert: `production-ingress-peer-drift`

**Owner:** The API deployment's platform/on-call operator owns this alert and
the review of any deployment networking change.

Page the on-call operator when a production structured log has `level=50`
(`error`) and its `msg` is either of these exact values:

- `Unexpected production proxy peer configuration; security review required before changing the trusted proxy list`
- `Request arrived from an unexpected production proxy peer; review the deployment ingress path before changing trusted proxy settings`

Use the structured fields already emitted by the API when investigating:

- Startup mismatch: compare `configuredPeers` with `expectedPeers`.
- Request mismatch: review `method`, `path`, `remoteAddress`, and `expectedPeers`.

Do not add `X-Forwarded-For`, forwarded client addresses, or request headers to
this alert. `remoteAddress` is the API's socket peer and is the signal needed
to review the ingress path.

**Response steps:**

1. Acknowledge the page and identify whether it is a startup configuration
   mismatch or an unexpected request socket peer.
2. Compare the event fields with the recorded
   `PRODUCTION_PROXY_PEERS` value (`127.0.0.1/32,::1/128`) and confirm the
   peer is still the intended application-router path.
3. Review the deployment and ingress changes made immediately before the alert.
   Treat an unexplained peer or configuration change as a security incident
   until the deployment owner confirms it.
4. Do not broaden the trusted proxy list or use a hop count/`true` as a
   workaround. Roll back the networking change if the intended path cannot be
   confirmed.
5. If the networking change is approved, update the recorded peer list and
   trusted-proxy configuration together through security review, then verify
   the next production startup log reports the expected peer configuration.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
