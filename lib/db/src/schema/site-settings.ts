import { boolean, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const siteSettingsTable = pgTable("site_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: boolean("value").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SiteSetting = typeof siteSettingsTable.$inferSelect;