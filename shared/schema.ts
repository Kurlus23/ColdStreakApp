import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const plunges = pgTable("plunges", {
  id: serial("id").primaryKey(),
  duration: integer("duration").notNull(), // in seconds
  temperature: integer("temperature").notNull(), // in fahrenheit
  score: numeric("score", { precision: 10, scale: 2 }).notNull(), // plunge score
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlungeSchema = createInsertSchema(plunges).omit({
  id: true,
  createdAt: true,
});

export type InsertPlunge = z.infer<typeof insertPlungeSchema>;
export type Plunge = typeof plunges.$inferSelect;
