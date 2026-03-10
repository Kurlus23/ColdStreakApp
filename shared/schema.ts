import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const plunges = pgTable("plunges", {
  id: serial("id").primaryKey(),
  duration: integer("duration").notNull(), // in seconds
  temperature: integer("temperature").notNull(), // in fahrenheit
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlungeSchema = createInsertSchema(plunges).omit({
  id: true,
  createdAt: true,
});

export type InsertPlunge = z.infer<typeof insertPlungeSchema>;
export type Plunge = typeof plunges.$inferSelect;
