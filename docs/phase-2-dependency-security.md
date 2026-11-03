# Phase 2 dependency security review

Recorded 2026-11-01 using pnpm 10.34.9 and the existing lockfile. No audit fix --force or cross-major override was used.

**Current status:** Phase 4 resolved both findings retained below as historical
Phase 2 evidence. See [Phase 4 remediation](phase-4-security-remediation.md) for
the qualified Zod/Orval updates, the scoped Undici fix and fresh verification.

## Before and after

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before, all dependencies | 1 | 7 | 17 | 4 | 29 |
| After, all dependencies | 0 | 1 | 1 | 0 | 2 |
| After, production dependency filter | 0 | 1 | 0 | 0 | 1 |

Audit exits nonzero because two advisories remain. The after count is not zero and security readiness is not fully achieved. The production filter still includes Zod. Advisory counts are advisory records, not distinct affected package names.

## Selected versions and compatibility

| Package | Installed before | Installed after | Decision / breaking-change risk |
| --- | --- | --- | --- |
| proxy-addr | 2.0.7 | 2.0.8 | Patch within Express ^2.0.7. Preserve exact trust restrictions; all proxy regressions pass. |
| body-parser | 2.3.0 | 2.4.0 | Minor within Express ^2.2.1. Compressed-input error handling changes are intentional security hardening; existing API contracts and tests pass. |
| qs | 6.16.0 | 6.16.1 | Patch within Express/body-parser major-6 ranges. Security error handling only; comma stringify is not used by application code. |
| nodemailer | 10.0.9 | 10.1.4 | Same-major minor upgrade; exact direct pin changed. Node >=20 supported by local Node 24.15. Notification and SMTP-mocked backend flows pass; no live SMTP delivery test. |
| vite | 7.3.6 | 7.3.7 | Patch within major 7; catalog lower bound raised. Node engine remains ^20.19 or >=22.12. Builds are verified separately; frontend sources/design unchanged. |
| fast-uri | 3.1.7 | 3.1.9 | Patch in Ajv ^3.0.1. URI normalization is intentionally stricter; code generation uses the trusted checked-in OpenAPI specification. |
| brace-expansion | 5.0.9 | 5.0.12 | Patch in minimatch ^5.0.8. Resource guard behavior may reject abusive globs; no legitimate untrusted glob feature exists here. |
| source-map-js | 1.2.1 | 1.2.2 | Patch in PostCSS major-1 range. Rejects pathological source-map offsets; production build check covers normal mappings. |
| markdown-it | 14.3.2 | 14.3.3 | Patch in TypeDoc ^14.3.0. Markdown pathological-input handling changes; no public renderer. |
| postcss-selector-parser | 6.0.10 | 6.1.5 | Scoped typography override from exact 6.0.10 to 6.1.5, same major. Typography pins the old version, so lockfile-only refresh cannot fix it; production CSS build is the compatibility check. |
| zod | 3.25.76 | 3.25.76 | Retained. First audited fixed release is 4.6.6, a major migration from 3.25.76. Drizzle peer accepts 4, but generated API schemas, explicit Orval version:3, validation error/email/coercion behavior and installed resolver 3.10.0 need a coordinated migration. No blind global override. |
| minimatch | 10.2.6 | 10.2.6 | Retained. Fixed 11.0.1 is outside current TypeDoc 0.28.20 ^10.2.5 range; registry current TypeDoc still requires 10. A global override would violate the parent compatibility contract. Wait for a compatible parent fix or separately qualify a scoped migration. |

The seven transitive security floors are constrained to their existing majors. They are needed because the targeted lockfile update retained old transitive resolutions. Existing esbuild/js-yaml overrides, native-platform exclusions, and the 1440-minute release-age policy remain intact. No unrelated major dependencies were upgraded.

The existing `@esbuild-kit/esm-loader` replacement (`npm:tsx@^4.21.0`) also re-resolved from tsx **4.23.13 to 4.23.15** while the lockfile was refreshed. This is a same-major patch for the Drizzle tooling alias, not a security-advisory fix; the catalog's ordinary tsx remains 4.23.13. The alias rule itself is unchanged. Fresh Drizzle generation, code generation and build verification passed with this resolution.

## Individual advisory decisions

Each row gives the audited installed version, the advisory fixed range, the actual selected installed version, reachability, and disposition. Compatibility and breaking-change risks apply per package as recorded above. Links point to the advisory records returned by the registry audit; reachability is repository analysis, not a remote-production observation.

| Advisory | Package / severity | Before | Advisory fixed range | After | Application reachability / decision |
| --- | --- | --- | --- | --- | --- |
| [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | fast-uri / moderate | 3.1.7 | `>=3.1.8` | 3.1.9 | Code generation only, via Orval / OpenAPI parser / Ajv; repository-owned specification. No API URL policy uses it. **FIXED in installed tree.** |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | brace-expansion / moderate | 5.0.9 | `>=5.0.12` | 5.0.12 | Code generation/documentation globs through TypeDoc; repository-owned patterns, no HTTP input. **FIXED in installed tree.** |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | brace-expansion / high | 5.0.9 | `>=5.0.11` | 5.0.12 | Code generation/documentation globs through TypeDoc; repository-owned patterns, no HTTP input. **FIXED in installed tree.** |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | brace-expansion / high | 5.0.9 | `>=5.0.10` | 5.0.12 | Code generation/documentation globs through TypeDoc; repository-owned patterns, no HTTP input. **FIXED in installed tree.** |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | source-map-js / high | 1.2.1 | `>=1.2.2` | 1.2.2 | CSS/source-map build processing through PostCSS/Tailwind; repository-owned inputs, no request parser. **FIXED in installed tree.** |
| [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | proxy-addr / critical | 2.0.7 | `>=2.0.8` | 2.0.8 | Express request-IP path is active; the reported broad IPv6-prefix condition is absent with the exact loopback allowlist. Patched anyway. **FIXED in installed tree.** |
| [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | vite / moderate | 7.3.6 | `>=7.3.7` | 7.3.7 | Development/editor or preview server only under the intended static-output deployment; actual hosting was not inspected. Do not expose dev servers. **FIXED in installed tree.** |
| [GHSA-vfgh-jcmw-g37q](https://github.com/advisories/GHSA-vfgh-jcmw-g37q) | markdown-it / low | 14.3.2 | `>=14.3.3` | 14.3.3 | TypeDoc/Orval documentation parsing of repository-owned content; no API Markdown renderer. **FIXED in installed tree.** |
| [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | vite / moderate | 7.3.6 | `>=7.3.7` | 7.3.7 | Development/editor or preview server only under the intended static-output deployment; actual hosting was not inspected. Do not expose dev servers. **FIXED in installed tree.** |
| [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | vite / high | 7.3.6 | `>=7.3.7` | 7.3.7 | Development/editor or preview server only under the intended static-output deployment; actual hosting was not inspected. Do not expose dev servers. **FIXED in installed tree.** |
| [GHSA-gfr2-rv44-r23c](https://github.com/advisories/GHSA-gfr2-rv44-r23c) | markdown-it / high | 14.3.2 | `>=14.3.3` | 14.3.3 | TypeDoc/Orval documentation parsing of repository-owned content; no API Markdown renderer. **FIXED in installed tree.** |
| [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | vite / low | 7.3.6 | `>=7.3.7` | 7.3.7 | Development/editor or preview server only under the intended static-output deployment; actual hosting was not inspected. Do not expose dev servers. **FIXED in installed tree.** |
| [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | vite / moderate | 7.3.6 | `>=7.3.7` | 7.3.7 | Development/editor or preview server only under the intended static-output deployment; actual hosting was not inspected. Do not expose dev servers. **FIXED in installed tree.** |
| [GHSA-39m8-27wv-hr27](https://github.com/advisories/GHSA-39m8-27wv-hr27) | nodemailer / moderate | 10.0.9 | `>=10.0.10` | 10.1.4 | DKIM signing is not configured in the current transporter; no user-supplied raw signing headers. **FIXED in installed tree.** |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | zod / high | 3.25.76 | `>=4.6.6` | 3.25.76 | Runtime validation. No public input collection schema found; generated response arrays and internal timestamp-array schemas exist. JSON input is bounded to 32 KB. This limits exposure but does not patch the package. **REMAINS OPEN.** |
| [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) | body-parser / high | 2.3.0 | `>=2.4.0` | 2.4.0 | Reachable before authentication: Express JSON parsing accepts compressed input. A decoded size limit alone does not fix trailing-compression error handling. **FIXED in installed tree.** |
| [GHSA-8c8m-p3m8-cjg8](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8) | nodemailer / moderate | 10.0.9 | `>=10.1.4` | 10.1.4 | Recipient parser can reinterpret nested comments. Public recipients pass plain-email validation; sender/owner addresses are operator configuration. **FIXED in installed tree.** |
| [GHSA-m943-m63m-w62w](https://github.com/advisories/GHSA-m943-m63m-w62w) | nodemailer / moderate | 10.0.9 | `>=10.1.4` | 10.1.4 | Recipient parser can terminate groups early. Application does not accept raw groups/header address lists from public input. **FIXED in installed tree.** |
| [GHSA-85x2-q946-cp5h](https://github.com/advisories/GHSA-85x2-q946-cp5h) | nodemailer / moderate | 10.0.9 | `>=10.1.4` | 10.1.4 | Quoted angle-address ambiguity. Public recipient email validation rejects the affected display/group syntax. **FIXED in installed tree.** |
| [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | fast-uri / moderate | 3.1.7 | `>=3.1.9` | 3.1.9 | Code generation only, via Orval / OpenAPI parser / Ajv; repository-owned specification. No API URL policy uses it. **FIXED in installed tree.** |
| [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) | fast-uri / low | 3.1.7 | `>=3.1.9` | 3.1.9 | Code generation only, via Orval / OpenAPI parser / Ajv; repository-owned specification. No API URL policy uses it. **FIXED in installed tree.** |
| [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) | fast-uri / moderate | 3.1.7 | `>=3.1.9` | 3.1.9 | Code generation only, via Orval / OpenAPI parser / Ajv; repository-owned specification. No API URL policy uses it. **FIXED in installed tree.** |
| [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) | fast-uri / low | 3.1.7 | `>=3.1.9` | 3.1.9 | Code generation only, via Orval / OpenAPI parser / Ajv; repository-owned specification. No API URL policy uses it. **FIXED in installed tree.** |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | postcss-selector-parser / moderate | 6.0.10 | `>=6.1.5` | 6.1.5 | Tailwind typography build-time selector parsing; no public selector processing endpoint. **FIXED in installed tree.** |
| [GHSA-4ffr-jq9g-5ffx](https://github.com/advisories/GHSA-4ffr-jq9g-5ffx) | nodemailer / moderate | 10.0.9 | `>=10.0.13` | 10.1.4 | SMTP AUTH detection runs against the configured server; a malicious/compromised peer or applicable MITM can reach it before authentication. **FIXED in installed tree.** |
| [GHSA-g73g-hqqh-jr95](https://github.com/advisories/GHSA-g73g-hqqh-jr95) | nodemailer / moderate | 10.0.9 | `>=10.0.13` | 10.1.4 | Angle-address comment ambiguity. Public recipients are validated plain email, not raw RFC 5322 header text. **FIXED in installed tree.** |
| [GHSA-4g23-2xm8-66gc](https://github.com/advisories/GHSA-4g23-2xm8-66gc) | nodemailer / moderate | 10.0.9 | `>=10.0.10` | 10.1.4 | SMTP reply parsing runs against the configured peer; a malicious/compromised peer or applicable MITM can supply excessive multiline replies. **FIXED in installed tree.** |
| [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) | qs / moderate | 6.16.0 | `>=6.16.1` | 6.16.1 | Express/body-parser transitive dependency; no application call to comma-array stringify found. Ordinary query parsing is a different path. **FIXED in installed tree.** |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | minimatch / moderate | 10.2.6 | `>=11.0.1` | 10.2.6 | Development-only TypeDoc globs use trusted patterns and default options; vulnerable amplification requires attacker-controlled patterns with optimizationLevel >= 2. No HTTP path. **REMAINS OPEN.** |

## Installed tree and evidence

Both the lockfile audit and actual package links were verified. A filesystem resolver followed workspace/package dependency links and read 507 reachable installed package manifests: every remediated package resolves only to the selected fixed version, with no unresolved target dependencies. Old unused package directories can remain in the local pnpm store; merely finding a cached directory does not establish application reachability.

A clean isolated workspace, including the existing uncommitted sources but excluding private environment files, was installed with `pnpm install --frozen-lockfile`. It reused the content-addressed pnpm store but began with no node_modules tree. The lockfile remained unchanged. Backend and strict IPv6 suites use only a newly provisioned local PostgreSQL database. See the Phase 2 report for command results and build caveats.

Raw audit JSON, resolved-tree evidence and command logs were saved outside the repository, in a local temporary directory retained by the maintainer. They contain test fixtures and package metadata, not production credentials.

## Remaining release blockers

- Zod GHSA-mrhx-c7xc-m3w5 remains a high advisory in a runtime dependency. Request-size bounds and absent public collection schemas reduce identified exposure; they are not equivalent to a vendor patch or an approved exception. Qualify a Zod 4.6.6 migration with a compatible resolver/generator setup and contract tests before claiming full security readiness.
- minimatch GHSA-g3hv-75wg-m249 remains moderate in development tooling. Avoid untrusted glob/config inputs. Qualify a TypeDoc/Orval-compatible update when available, or perform and approve a narrowly scoped compatibility assessment instead of forcing all minimatch consumers.
- Do not expose Vite development/preview servers as production hosting. Existing Windows native dependency exclusions require separate platform provisioning for local verification; they were not broadened during this security patch.
- Rerun full and production audits near release: advisory databases change. Passing the current fixed-version check is not a guarantee against future advisories.
