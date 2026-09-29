---
name: Deployment-edge HSTS
description: HSTS ownership and duplicate-header behavior for the published app.
---

The published app's HTTPS deployment edge adds `Strict-Transport-Security: max-age=63072000; includeSubDomains` to both static-site and API responses. The API should not emit a second HSTS header.

**Why:** The production static root returned only the edge policy, while API responses contained that policy plus a shorter application policy. No Helmet or artifact-level HSTS configuration was present.

**How to apply:** Leave edge-managed HSTS in place and avoid adding Helmet HSTS or manual `Strict-Transport-Security` in the API. If the hosting layer changes, re-check the static root and API responses independently before adding app-level HSTS.