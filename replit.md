# RZ Home Appliances Care

Customer-facing appliance repair website with a public guest repair-request form. Customers can submit a request without creating an account; the API validates and saves each request to PostgreSQL and returns a unique Request ID.

## Run & Operate

- `pnpm --filter @workspace/rz-home-appliances-care run dev` — run the website
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/rz-home-appliances-care run typecheck` — typecheck the website
- `pnpm --filter @workspace/api-server run typecheck` — typecheck the API
- `pnpm run typecheck` — typecheck the workspace
- `PORT=23672 BASE_PATH=/ pnpm run build` — build the workspace with artifact routing values

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React, Vite, Tailwind CSS, Wouter, Lucide
- Express API at `/api`
- PostgreSQL with Drizzle ORM
- OpenAPI contract and generated Zod/client packages

## Architecture decisions

- The public repair-request endpoint does not require customer authentication.
- Guest submissions are saved with `customer_id = NULL`; the server owns the Request ID and status values.
- The form saves to the database before returning success and displays the generated Request ID to the customer.
- Account, booking, review, and admin preview routes remain separate from the public guest repair-request flow.

## Product

RZ Home Appliances Care provides appliance repair services in Bengaluru. The site presents washing machine, refrigerator, microwave, and LED TV services, contact details, customer information, and a public repair-request flow.

## Pointers

- Website and repair form: `artifacts/rz-home-appliances-care/src/App.tsx`
- API route: `artifacts/api-server/src/routes/repair-requests.ts`
- Database schema: `lib/db/src/schema/repair-requests.ts`
- API contract: `lib/api-spec/openapi.yaml`