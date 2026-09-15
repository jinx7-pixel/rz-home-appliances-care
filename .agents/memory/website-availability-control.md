---
name: Website availability control
description: The safety boundary for temporarily disabling the customer-facing app.
---

The website availability flag is persisted in the database. When disabled, customer-facing pages show a maintenance/error state and public APIs reject requests, while admin authentication and dashboard APIs remain available so an administrator can restore service.

**Why:** Administrators need a reliable kill switch for public traffic without locking themselves out of the control panel.

**How to apply:** Keep admin routes and the availability-check endpoint outside the public-offline gate. Treat a missing setting as enabled for safe default startup, and require an authenticated admin for changes.