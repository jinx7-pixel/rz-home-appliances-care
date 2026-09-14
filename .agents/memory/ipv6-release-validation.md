---
name: IPv6 release validation
description: The release-test contract for security checks that require IPv6 loopback sockets.
---

IPv6-dependent proxy security tests may skip in ordinary local runs, but the release validation command must require IPv6 loopback support and fail explicitly when the runner reports `EAFNOSUPPORT` or `EADDRNOTAVAIL`.

**Why:** Some development sandboxes do not expose IPv6 at the kernel level, and silently skipping these tests would allow the trusted native loopback and rejected mapped-peer paths to leave release validation untested.

**How to apply:** Keep the strict requirement enabled only by the release validation entry point so developers retain a usable local test command; run the release gate on an IPv6-capable environment before publishing.