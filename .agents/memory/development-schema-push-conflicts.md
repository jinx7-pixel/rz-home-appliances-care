---
name: Development schema push conflicts
description: A durable database workflow caveat for additive schema work in this project.
---

When an additive Drizzle schema push fails on an existing index or constraint name, inspect the live development schema before retrying. The push may already have created some tables or columns before the conflict; apply only the missing additive objects and avoid force-push or broad destructive resets.

**Why:** The development database can contain indexes created by an earlier schema state with names that Drizzle still tries to recreate. A failed push is not proof that none of the requested schema was applied.

**How to apply:** Query `information_schema` and `pg_indexes`, compare against the current schema source, and use a non-destructive additive correction when needed. Keep production schema changes on the supported publish flow.