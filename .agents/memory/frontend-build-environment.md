---
name: Frontend build environment
description: Required environment values for producing the customer web artifact build.
---

The customer web artifact's Vite build requires both `PORT` and `BASE_PATH` to be explicitly set; use the same values as the configured web workflow when running a standalone production build.

**Why:** The build configuration intentionally fails fast when either artifact-routing value is missing, even though the dev workflow supplies them.

**How to apply:** For standalone verification, provide the workflow port and the artifact base path before invoking the web package's build script.