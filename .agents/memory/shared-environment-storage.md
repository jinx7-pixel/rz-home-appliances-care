---
name: Shared environment storage
description: How Replit shared environment settings are represented in this workspace.
---

In this workspace, `setEnvVars` for the shared environment writes values into the tracked `.replit` `[userenv.shared]` section.

**Why:** Re-saving existing values through the shared environment tool caused them to reappear in the repository configuration, so it is not a separate private store here.

**How to apply:** When a value must stay out of Git history, provision it through Replit Secrets and remove its literal from `.replit`; application code can continue reading it from `process.env`.