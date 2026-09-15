---
name: Wouter query parameters
description: Query-string handling in the customer web app's Wouter router.
---

Wouter's `useLocation()` returns the current pathname without the query string. Features that depend on query parameters must read `window.location.search` or use Wouter's dedicated search hook; path-parameter routes should read the pathname separately.

**Why:** The review page originally parsed query parameters from `useLocation()`, so valid dashboard and email links lost their request or booking ID before the backend lookup.

**How to apply:** Do not parse `?` from `useLocation()` output. Use the browser search string/search hook, and keep backend ownership, completion-status, and duplicate-review checks authoritative.