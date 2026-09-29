---
name: Workspace Git checkpoints
description: Replit Agent file edits may be recorded in local Git history without an explicit git commit command.
---

Check Git state after file edits; do not assume changes are only in the working tree.

**Why:** A workspace cleanup produced local Replit Agent commits without a manual `git commit`, which changed the history state during the task.

**How to apply:** Before reporting whether work is committed, inspect `git status` and recent commit metadata. A local commit does not mean anything was pushed to a remote.