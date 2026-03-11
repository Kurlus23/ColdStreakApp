import { pgTable, text, serial, integer, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifyToken: text("email_verify_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const plunges = pgTable("plunges", {
  id: serial("id").primaryKey(),
  clientId: text("client_id"), // device-specific UUID for data isolation (nullable for legacy rows)
  userId: integer("user_id"), // linked account user (nullable)
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
}, (t) => [uniqueIndex("leaderboard_location_user_idx").on(t.locationId, t.username)]);

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
  state: text("state"),
  city: text("city"),
  description: text("description"),
  difficulty: text("difficulty"), // "beginner"|"cold"|"very-cold"|"ice-water"|"legendary" (nullable)
  submittedBy: text("submitted_by"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
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
