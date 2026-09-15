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

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: varchar("booking_id", { length: 24 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 10 }).notNull(),
    applianceType: varchar("appliance_type", { length: 64 }).notNull(),
    problemDescription: text("problem_description").notNull(),
    preferredDate: date("preferred_date", { mode: "string" }).notNull(),
    preferredTime: varchar("preferred_time", { length: 100 }).notNull(),
    address: text("address").notNull(),
    additionalNotes: text("additional_notes"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
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
    uniqueIndex("bookings_booking_id_unique").on(table.bookingId),
    index("bookings_customer_id_idx").on(table.customerId),
  ],
);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;