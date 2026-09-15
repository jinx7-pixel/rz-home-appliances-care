---
name: Dynamic admin API caching
description: Cache behavior required for authenticated dashboard API responses.
---

Authenticated dashboard reads must bypass conditional 304 responses and fetch with no-store; an empty 304 body can make a successful admin request list look empty in the UI.

**Why:** Browser and proxy validators can turn Express JSON responses into 304 responses even when the client expects to parse JSON, producing a silent empty-dashboard failure.

**How to apply:** Keep API ETags disabled for dynamic responses, send no-store on admin endpoints, and use cache no-store on dashboard fetches.