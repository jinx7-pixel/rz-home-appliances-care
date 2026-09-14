---
name: Customer authentication security
description: Durable security decisions for the customer account authentication layer.
---

Customer accounts use opaque random session tokens in HTTP-only SameSite cookies; only SHA-256 session hashes are stored in PostgreSQL. Password reset links use random single-use tokens whose hashes are stored with a short expiry.

**Why:** This avoids exposing bearer tokens to frontend storage and prevents database leakage from directly becoming usable sessions or reset links.

**How to apply:** Keep authentication state server-side, never return password hashes or raw reset tokens, invalidate all sessions after a successful password reset, and preserve anonymous repair submissions separately from authenticated customer data.