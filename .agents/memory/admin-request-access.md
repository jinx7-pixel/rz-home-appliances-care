---
name: Admin request access
description: Durable access boundary for the RZ admin repair-request dashboard.
---

The admin dashboard must authenticate through the server-issued HTTP-only admin session cookie and fetch guest repair requests from the protected admin API. Admin credentials are database-seeded and must not be placed in frontend code or API responses.

**Why:** Public repair submissions intentionally remain unauthenticated, while customer contact details must only be visible to authenticated administrators.

**How to apply:** Preserve the `customerType=guest` filter for this dashboard, keep unauthenticated list requests blocked, and never expose password values or hashes in the client.