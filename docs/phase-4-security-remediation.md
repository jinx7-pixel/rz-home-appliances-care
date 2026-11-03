# Phase 4 security remediation

## Compatibility decision before dependency changes — 2026-11-02

The starting full audit has one high Zod finding and one moderate minimatch
finding. Production audit includes Zod. No audit exception is being added.

### Zod: qualify 3.25.76 to 4.6.6

The reviewed advisory affects versions below 4.6.6; no patched version 3 is
published. Version 4.6.6 is the smallest patched release and predates the existing
one-day package-release-age limit. This is an intentional major migration.

- Direct catalog consumers: API schemas, database, frontend and mockup sandbox.
  The API uses both shared runtime libraries. Drizzle schemas already import
  `zod/v4`; drizzle-zod 0.8.3 accepts `^3.25.0 || ^4.0.0`.
- Orval 8.33.0's Zod generator accepts a `zod >=3` peer and supports explicit
  version 4 output. Its configuration must match the updated catalog. Generation
  will be rehearsed in isolation to preserve existing uncommitted generated code.
- Resolver 3.10.0 uses the old Zod error API. Both frontend manifests will move
  to 5.2.2, which supports Zod 4. Its React Hook Form peer is `^7.55.0`; installed
  7.87.0 already satisfies it and accepts React 19.1.0. No React or React Hook
  Form upgrade is needed. Resolver 5 separates input/output inference; no current
  application uses zodResolver, and interoperability will be tested directly.
- TypeScript 5.9.3 meets Zod 4's requirements; Node 24 and pnpm 10 are retained.
  Express 5 does not depend on the Zod major. No middleware/trust/cookie change
  is part of the migration.
- Risks to verify: stricter email/UUID/safe-integer parsing, date/string/number
  coercion, nullable/optional values, issue formatting and resolver errors.
  Public validation field-error structure, invitation anti-replay, idempotency
  and the entire existing backend/migration suites must continue to pass.

### minimatch: remove the vulnerable chain through the smallest parent update

Only TypeDoc 0.28.20 (through development-only Orval 8.33.0 and its plugin/core
graph) introduces minimatch 10.2.6. Current TypeDoc still requests `^10.2.5`.
The first patched minimatch is 11.0.1, supporting Node 18/20/>=22. Node 24 is
compatible, but that alone does not qualify the dependency upgrade.

Package inspection identified an actual API incompatibility: TypeDoc's
`dist/node-utils.js` calls `Minimatch.matchOne` for partial directory traversal;
minimatch 11 removed this method and changed parsed pattern entries from RegExp
to Matcher objects. A scoped override would break TypeDoc file discovery.
An isolated override reproduced `TypeError: mini.matchOne is not a function`.
Versions 11.0.2 through 11.0.4 also omit that API. No global/scoped override or
fabricated patched version will be introduced.

Reviewing parent releases identified a compatible alternative: **Orval 8.34.0**,
the first minor after installed 8.33.0, removes TypeDoc from runtime dependencies
of both Orval and @orval/core. Documentation tools become optional peers. This
project generates React Query clients and Zod schemas, not TypeDoc documentation;
its existing `autoInstallPeers: false` setting is retained. No feature configured
by this project is disabled, and no dependency omission flag is introduced.

Node requirements remain >=22.18.0, satisfied by 24.15.0; generator Zod peer >=3
accepts 4.6.6. This avoids upgrading to unrelated latest Orval 8.46.0. Its own
same-release @orval/* packages necessarily move together. Existing specification,
React Query output, schema output, TypeScript checks and contract tests will
qualify this targeted minor update. The advisory is resolved only if actual
installed links and full/production audits confirm minimatch is absent.

The initial parent update introduced Scalar json-magic 0.13.5, whose exact
Undici 7.24.4 dependency produced 29 development audit findings (10 high,
14 moderate, 5 low). This candidate was not accepted as the final result.
A narrowly scoped `@scalar/json-magic@0.13.5>undici: 7.30.1` override selects
the minimum same-major release covering every reported affected range. Node
>=20.18.1 is supported; 24.15.0 is compatible. Scalar's separate Undici 8
consumer is untouched. Local and loopback-HTTP specification generation will
exercise compatibility; no production endpoint accepts specification URLs.
All new findings must disappear before this remediation can pass.

## Primary references

- [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Zod migration guide](https://zod.dev/v4/changelog)
- [Resolver 5 compatibility changes](https://github.com/react-hook-form/resolvers/releases/tag/v5.0.0)
- [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [minimatch 11 source](https://raw.githubusercontent.com/isaacs/minimatch/v11.0.1/src/index.ts)
- [Orval 8.34.0 package](https://raw.githubusercontent.com/orval-labs/orval/v8.34.0/packages/orval/package.json)
- [Orval core 8.34.0 package](https://raw.githubusercontent.com/orval-labs/orval/v8.34.0/packages/core/package.json)
- [Undici 7.30.1 security release](https://github.com/nodejs/undici/releases/tag/v7.30.1)

## Final evidence — 2026-11-02

Both full and production audits now report **zero vulnerabilities**, including
zero new high/critical findings. The actual installed package links contain
Zod 4.6.6 for application consumers and patched 4.6.7 in Scalar/Orval tooling,
Undici 7.30.1 and 8.12.3, and no resolved TypeDoc/minimatch package. Resolution
inspection covered 474 reachable package manifests, not unused store folders.

Both resolved advisory entries were removed from the baseline; `findings` is
empty. The original owner/review date remain unchanged. The release audit gate
passed, and the empty-baseline test rejects a reintroduced advisory. No audit
category or severity was suppressed.

Final checks on the complete remediated tree:

| Check | Result |
| --- | --- |
| Host frozen installation, scripts disabled | Passed, lockfile preserved |
| Fresh Linux frozen install with normal scripts/native checks | Passed, checksum preserved |
| Workspace typecheck, host and Linux | Passed |
| Frontend, API and mockup production builds | Passed, Linux |
| Backend / strict IPv6 suites | 42/42 each, zero skipped |
| PostgreSQL migration suite | 12/12, zero skipped |
| CI helpers and dependency compatibility | 16/16, zero skipped |
| Captured before/after validation contracts | 34 identical results |
| Isolated generation matching final validators | Passed |
| Compose, actionlint, Dockerfile lint and Git whitespace checks | Passed |

The original backend/migration tests, design, schema and proxy restrictions are
preserved. Synthetic PostgreSQL projects were stopped cleanly; temporary runner
containers were removed. Volumes and verification images are retained locally.
Previously built runtime app images were not deployed or silently retagged.

Evidence is retained outside the repository, in a local temporary directory
maintained by the maintainer, with final Linux logs in `final/`. The detailed
report is retained locally alongside the project workspace and is not published
to the repository.
Historical Phase 2/3 reports describe their original state.

**The dependency-security blocker is cleared.** This is not deployment approval
or verification of every production operational requirement. No commit, push,
production access, deployment or VPS modification occurred. Stop after Phase 4.
