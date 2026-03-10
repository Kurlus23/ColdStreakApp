import { pgTable, text, serial, integer, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
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

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: serial("id").primaryKey(),
  locationId: text("location_id").notNull(), // passport location id
  username: text("username").notNull(),
  score: numeric("score", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(), // in seconds
  temperature: integer("temperature").notNull(), // in fahrenheit
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const proUsers = pgTable("pro_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  stripeSessionId: text("stripe_session_id").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProUser = typeof proUsers.$inferSelect;

export const insertPlungeSchema = createInsertSchema(plunges).omit({
  id: true,
  createdAt: true,
});

export const updatePlungeSchema = insertPlungeSchema.partial().pick({
  photoData: true,
  locationName: true,
  locationId: true,
});

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({
  id: true,
  createdAt: true,
});

export const userLocations = pgTable("user_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  description: text("description"),
  submittedBy: text("submitted_by"),
  nominationCount: integer("nomination_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserLocationSchema = createInsertSchema(userLocations).omit({
  id: true,
  nominationCount: true,
  createdAt: true,
});

export type UserLocation = typeof userLocations.$inferSelect;
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;

export type InsertPlunge = z.infer<typeof insertPlungeSchema>;
export type UpdatePlunge = z.infer<typeof updatePlungeSchema>;
export type Plunge = typeof plunges.$inferSelect;
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
