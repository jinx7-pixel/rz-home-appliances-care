# Contributing to RZ Home Appliances Care

Thanks for contributing. This is a customer-facing service website with a
public marketing site, a customer repair-request form, an admin dashboard and a
customer review system — so correctness and security matter more here than in a
typical front-end project.

- [Quick start](#quick-start)
- [How to work on a change](#how-to-work-on-a-change)
- [Branch naming](#branch-naming)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Review guidelines](#review-guidelines)
- [Code style](#code-style)
- [Project memory](#project-memory)
- [Reporting bugs](#reporting-bugs)
- [What will not be merged](#what-will-not-be-merged)

---

## Quick start

This is a **pnpm workspace monorepo**. The packages are:

| Path | What it is |
| --- | --- |
| `artifacts/rz-home-appliances-care/` | The public marketing site and customer-facing app (React · TypeScript · Vite) |
| `artifacts/api-server/` | The REST API (Express · TypeScript) |
| `artifacts/mockup-sandbox/` | Design mockups — not deployed |
| `lib/db/` | Database package — Drizzle schema and migrations (PostgreSQL) |
| `lib/api-spec/` | OpenAPI specification and the Orval generator config |
| `lib/api-client-react/` | Generated React client for the API |
| `lib/api-zod/` | Generated Zod schemas and types |
| `lib/db/` | Drizzle schema and SQL migrations |
| `scripts/` | Small maintenance scripts |

```bash
git clone https://github.com/jinx7-pixel/rz-home-appliances-care.git
cd rz-home-appliances-care

pnpm install --frozen-lockfile
```

Create your local environment file:

```bash
cp .env.example .env
```

Then, in the way the project is normally run:

```bash
pnpm run dev
```

**Stack:** React · TypeScript · Vite · Express · PostgreSQL · Drizzle · Zod · Orval · pnpm
**Tests:** `pnpm test`
**CI:** `.github/workflows/main.yml` — typecheck and build
**Hosting:** Replit

---

## How to work on a change

1. **Check for an existing issue**, or open one. Anything touching auth,
   customer data, or the database needs a discussion first.
2. **Branch off `main`.** `main` is protected — you cannot push to it directly,
   and every change arrives through a pull request.
3. **Make the change**, keeping it as small as possible.
4. **Run the local checks** — the same ones CI runs:
   ```bash
   pnpm install --frozen-lockfile
   pnpm run typecheck
   pnpm run build
   pnpm test
   ```
5. **Open a pull request** and describe what changed and why.
6. **Respond to review.** Push fixes as new commits on the same branch.

---

## Branch naming

| Prefix | Use it for | Example |
| --- | --- | --- |
| `feature/` | New functionality | `feature/repair-request-tracking` |
| `fix/` | A bug fix | `fix/booking-form-validation` |
| `docs/` | Documentation only | `docs/api-spec-setup` |
| `refactor/` | No behaviour change | `refactor/extract-review-service` |
| `perf/` | Performance work | `perf/reviews-pagination` |
| `test/` | Tests only | `test/admin-auth-coverage` |
| `chore/` | Tooling, dependencies | `chore/bump-pnpm` |

Rules:

- Lowercase, hyphen-separated.
- One branch, one concern.
- Rebase on `main` before requesting review:
  ```bash
  git fetch origin
  git rebase origin/main
  ```

---

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(optional scope): <short summary in the imperative mood>

<optional body>

<optional footer>
```

| Type | Use it for |
| --- | --- |
| `feat` | New user-visible functionality |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting only — no behaviour change |
| `refactor` | Restructure with no behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system or dependency changes |
| `ci` | Workflow changes |
| `chore` | Maintenance that fits nothing else |

Scopes used in this repository: `site`, `api`, `db`, `auth`, `reviews`,
`bookings`, `mockups`, `docs`.

```
feat(api): add rate-limit bucket for repair requests
fix(auth): expire admin sessions after 8 hours of inactivity
refactor(site): extract the hero section into its own component
docs(memory): record the IPv6 release validation steps
```

Rules:

- Imperative mood, no trailing full stop, 72 characters or fewer on the subject.
- One logical change per commit.
- Body explains **why** when it is not obvious.
- `Fixes #123` closes an issue automatically.

---

## Pull requests

Before requesting review, confirm:

- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run build` passes.
- [ ] `pnpm test` passes, and new behaviour has new tests.
- [ ] The PR description explains **what** changed and **why**.
- [ ] Screenshots are attached for any UI change.
- [ ] No secrets, `.env` files, credentials, or real customer data are included.
- [ ] The diff contains no unrelated reformatting.
- [ ] If the API contract changed, `lib/api-spec/openapi.yaml` was updated and
      the generated clients were regenerated.

### Review guidelines

Reviewers check, in this order:

1. **Correctness** — does it do what it says? For a bug fix, is there a test
   that fails without the fix?
2. **Customer data safety** — this project stores repair requests, customer
   details, admin accounts, and review content. A change that could expose,
   lose, or corrupt any of that blocks the merge until it is fixed.
3. **Security** — new endpoints need authentication, authorisation, Zod
   validation, and rate limiting. Admin routes need admin authorisation
   specifically. Never log customer data, tokens, or credentials.
4. **Scope** — is the change limited to what it claims?
5. **Tests** — does the suite cover the new path?
6. **Consistency** — does it match the existing package layout, naming, and
   error-handling style?

**How to review:**

1. Read the description, then the diff.
2. Run `pnpm run typecheck && pnpm run build && pnpm test` locally.
3. Comment on the code, not the person.
4. Approve when it is correct and safe. Say plainly when a PR is ready.
5. If a change is risky, say what would make it acceptable.

**Who merges:** the repository owner. One approval plus green CI is enough.

---

## Code style

**TypeScript**

- Strict mode. No `any` — use `unknown` and narrow.
- `const` by default; `let` only when reassigned; never `var`.
- `import type` for type-only imports.
- `async`/`await` over raw promise chains.

**React**

- Function components only.
- Hooks at the top level of a component, never in a condition or a loop.
- `useCallback` / `useMemo` only with a measured reason.
- Reusable UI in `src/components/ui/`, feature UI in `src/components/`, page
  level components in `src/pages/`.

**API server**

- Layering: `routes` → `services` → repositories.
  - `routes` parse and validate the request.
  - `services` hold the business logic.
  - A route must not contain business rules.
- Validate every input with a Zod schema at the edge.
- Every new endpoint needs authentication, authorisation, and rate limiting.
- Use the shared error shape so the frontend can rely on it.

**API contract**

- `lib/api-spec/openapi.yaml` is the source of truth.
- Change the spec, then regenerate the clients — do not hand-edit anything under
  `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/`.
- Regenerate with:
  ```bash
  pnpm --filter api-spec run generate
  ```

**Database**

- Schema lives in `lib/db/src/schema/`.
- SQL migrations live in `lib/db/migrations/`, named
  `YYYYMMDD_add_<thing>.sql`.
- Never edit a migration that has already been merged. Add a new one.
- A schema change and the code that depends on it belong in the same PR.

**Naming**

- Files are `camelCase.ts` for modules and `PascalCase.tsx` for components.
- `*.routes.ts` · `*.service.ts` · `*.schemas.ts` · `*.repository.ts`.

---

## Project memory

This repository keeps its working notes in `.agents/memory/`. Each file is one
topic, and the file name is the topic.

```
.agents/memory/
├── MEMORY.md                        ← index and orientation
├── customer-auth-security.md
├── deployment-edge-hsts.md
├── ipv6-release-validation.md
├── website-availability-control.md
└── …
```

**When you learn something that is not obvious from the code** — a deployment
gotcha, a security decision, a validation step that is not derivable from the
code — write it down in a new file there, and add a line to `MEMORY.md`.

**When you make a change that invalidates something written there**, update
that file in the same PR. Stale memory is worse than no memory, because someone
will trust it.

This is also how a fresh session — or a new contributor — gets oriented without
reading the entire history.

---

## Reporting bugs

Use the **Bug report** issue template. Include the package, the route or
component, the exact steps, and the observed versus expected behaviour. Attach
the relevant console or server output with customer data removed.

Security vulnerabilities should **not** be opened as public issues. Follow
[SECURITY.md](SECURITY.md).

---

## What will not be merged

- A change that fails CI.
- A change that touches customer data handling without tests.
- A new endpoint without authentication, authorisation, validation, and rate
  limiting.
- A hardcoded secret, API key, password, or connection string.
- A real `.env` file, or real customer data, in the repository.
- A hand-edited generated file under `lib/api-client-react/src/generated/` or
  `lib/api-zod/src/generated/`.
- A `pnpm-lock.yaml` edited by hand.
- Formatting churn mixed into a behavioural change.
- A migration that edits an already-merged migration file.
- A commit message of `.wq` / `wq` / `Merge branch 'main' of …` with no
  meaningful description.

---

## Code of Conduct

Participation in this project is governed by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

See [LICENSE](LICENSE).
