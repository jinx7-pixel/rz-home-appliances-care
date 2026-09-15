# RZ Home Appliances Care

Frontend-only website for presenting RZ Home Appliances Care services in Bengaluru, with repair request, booking, account, review, and operations experiences represented as local UI flows.

## Run & Operate

- `pnpm --filter @workspace/rz-home-appliances-care run dev` — run the website
- `pnpm --filter @workspace/rz-home-appliances-care run typecheck` — typecheck the website
- `pnpm --filter @workspace/rz-home-appliances-care run build` — build the static website
- `pnpm run typecheck` — typecheck the workspace
- `pnpm run build` — typecheck and build the workspace

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React, Vite, Tailwind CSS, Wouter, Lucide
- Static frontend artifact: `artifacts/rz-home-appliances-care`

## Architecture decisions

- The project intentionally has no API server, database, authentication provider, email delivery, or server-side form submission.
- Customer-facing forms validate and demonstrate the interaction locally, then explain that the frontend-only edition does not send or persist information.
- Public review cards are clearly presented as sample stories rather than live database content.

## Product

RZ Home Appliances Care provides a polished service website for appliance repair customers in Bengaluru. It presents washing machine, refrigerator, microwave, and LED TV repair services, contact options, service information, sample customer stories, and frontend-only booking/account/admin previews.

## Pointers

- Main website: `artifacts/rz-home-appliances-care/src/App.tsx`
- Frontend-only route previews: `artifacts/rz-home-appliances-care/src/pages/static-pages.tsx`
- Shared styles: `artifacts/rz-home-appliances-care/src/index.css`