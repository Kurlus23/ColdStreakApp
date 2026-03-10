import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const plunges = pgTable("plunges", {
  id: serial("id").primaryKey(),
  duration: integer("duration").notNull(), // in seconds
  temperature: integer("temperature").notNull(), // in fahrenheit
  score: numeric("score", { precision: 10, scale: 2 }).notNull(), // plunge score
  hrAvg: integer("hr_avg"), // average heart rate bpm (nullable)
  spo2Avg: integer("spo2_avg"), // average blood oxygen % (nullable)
  photoData: text("photo_data"), // base64 data URL of photo (nullable)
  locationName: text("location_name"), // display name of location (nullable)
  locationId: text("location_id"), // passport location id (nullable)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlungeSchema = createInsertSchema(plunges).omit({
  id: true,
  createdAt: true,
});

export const updatePlungeSchema = insertPlungeSchema.partial().pick({
  photoData: true,
  locationName: true,
  locationId: true,
});

export type InsertPlunge = z.infer<typeof insertPlungeSchema>;
export type UpdatePlunge = z.infer<typeof updatePlungeSchema>;
export type Plunge = typeof plunges.$inferSelect;
