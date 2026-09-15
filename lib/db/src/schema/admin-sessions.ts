import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const adminSessionsTable = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" }),
    sessionHash: varchar("session_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_sessions_admin_user_id_idx").on(table.adminUserId),
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export type AdminSession = typeof adminSessionsTable.$inferSelect;