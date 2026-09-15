import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const repairRequestsTable = pgTable(
  "repair_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: varchar("request_id", { length: 24 }).notNull(),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 10 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    applianceType: varchar("appliance_type", { length: 64 }).notNull(),
    problemDescription: text("problem_description").notNull(),
    address: text("address").notNull(),
    customerId: uuid("customer_id").references(() => customersTable.id, {
      onDelete: "set null",
    }),
    preferredDate: date("preferred_date", { mode: "string" }),
    preferredTime: varchar("preferred_time", { length: 100 }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    adminNotes: text("admin_notes"),
    emailStatus: varchar("email_status", { length: 24 })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("repair_requests_request_id_unique").on(table.requestId),
    index("repair_requests_customer_id_idx").on(table.customerId),
  ],
);

export const insertRepairRequestSchema = createInsertSchema(
  repairRequestsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRepairRequest = z.infer<typeof insertRepairRequestSchema>;
export type RepairRequest = typeof repairRequestsTable.$inferSelect;