import { pgTable, text, serial, integer, timestamp, numeric, boolean, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(), // login username (nullable for existing users)
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifyToken: text("email_verify_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  displayName: text("display_name"),
  bodyWeight: integer("body_weight"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isDisabled: boolean("is_disabled").default(false).notNull(),
  timezone: text("timezone"), // IANA tz from client (e.g., "America/Los_Angeles")
  country: text("country"),   // ISO-2 country code (e.g., "US", "GB")
  region: text("region"),     // State / region / city (free-form, geo-derived)
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
  timerUsed: boolean("timer_used").default(false).notNull(), // true = in-app timer; false = manually entered
  calories: integer("calories"), // kcal estimate locked at log time (nullable for legacy rows)
  timezone: text("timezone"), // IANA tz captured at log time (nullable for legacy rows)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: serial("id").primaryKey(),
  locationId: text("location_id").notNull(), // passport location id
  username: text("username").notNull(),
  score: numeric("score", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(), // in seconds
  temperature: integer("temperature").notNull(), // in fahrenheit
  // 0=none, 1=timer verified, 2=photo verified, 3=timer+photo verified
  verificationLevel: integer("verification_level").default(0).notNull(),
  hasPhoto: boolean("has_photo").default(false).notNull(),
  locationVerified: boolean("location_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("leaderboard_location_user_idx").on(t.locationId, t.username)]);

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  durationDays: integer("duration_days").notNull().default(7),
  maxUses: integer("max_uses").notNull().default(10),
  usedCount: integer("used_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PromoCode = typeof promoCodes.$inferSelect;

export const proUsers = pgTable("pro_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  stripeSessionId: text("stripe_session_id").notNull(),
  planType: text("plan_type").notNull().default("lifetime"), // 'lifetime' | 'annual'
  stripeSubscriptionId: text("stripe_subscription_id"), // null for lifetime
  expiresAt: timestamp("expires_at"), // null = lifetime; set for annual
  active: boolean("active").default(true).notNull(),
  foundingPlunger: boolean("founding_plunger").default(false).notNull(),
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
  duration: true,
  temperature: true,
  score: true,
  createdAt: true,
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
  accessLat: numeric("access_lat", { precision: 9, scale: 6 }),
  accessLng: numeric("access_lng", { precision: 9, scale: 6 }),
  isBusiness: boolean("is_business").default(false).notNull(),
  businessVerified: boolean("business_verified").default(false).notNull(),
  websiteUrl: text("website_url"),
  phone: text("phone"),
  yelpUrl: text("yelp_url"),
  facebookUrl: text("facebook_url"),
  bookingUrl: text("booking_url"),
  contactEmail: text("contact_email"),
  fullAddress: text("full_address"),
  modalities: text("modalities").array(),
  nominationCount: integer("nomination_count").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  // Public profile slug (unique). Auto-derived from name on first share.
  slug: text("slug").unique(),
  // Business hours stored as { mon: {open: "06:00", close: "20:00", closed: false}, ... }.
  // Null until the owner sets them. Stored as untyped jsonb (cast at read sites
  // — typing this with $type<BusinessHours | null> conflicts with drizzle-zod's
  // wider InsertUserLocation type at insert/update sites).
  hours: jsonb("hours"),
  // Email allowlist for co-managers who can also see this listing's dashboard.
  coManagerEmails: text("co_manager_emails").array().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business hours type — 7 day-of-week keys, each open/close in HH:MM 24h.
export type BusinessHoursDay = { open: string; close: string; closed: boolean };
export type BusinessHours = {
  mon: BusinessHoursDay; tue: BusinessHoursDay; wed: BusinessHoursDay;
  thu: BusinessHoursDay; fri: BusinessHoursDay; sat: BusinessHoursDay; sun: BusinessHoursDay;
};
export const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"] as const;
export type DayKey = typeof DAY_KEYS[number];

export const businessListings = pgTable("business_listings", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => userLocations.id),
  email: text("email").notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  source: text("source").default("stripe").notNull(), // "stripe" | "iap"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BusinessListing = typeof businessListings.$inferSelect;

// Apple/Google IAP-purchased Verified Business subscription. One row per email
// (the RevenueCat appUserId). tierCapacity is the max number of locations this
// subscription can keep verified at once (1, 3, or 10). When the user verifies
// a location on iOS we add a businessListings row with source="iap" and
// stripeSubscriptionId set to a synthetic identifier — the count of those rows
// vs. tierCapacity is the gating check.
export const verifiedBusinessSubs = pgTable("verified_business_subs", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  appUserId: text("app_user_id").notNull(),
  productId: text("product_id").notNull(),
  tierCapacity: integer("tier_capacity").notNull(),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VerifiedBusinessSub = typeof verifiedBusinessSubs.$inferSelect;

// ── Business analytics event logs ─────────────────────────────────────────────
// Per-event tables so we can power the business owner dashboard with totals,
// daily trends, and click breakdowns. Cascade delete with the parent listing.
export const locationViews = pgTable("location_views", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => userLocations.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  clientId: text("client_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("location_views_loc_created_idx").on(t.locationId, t.createdAt)]);

export type LocationView = typeof locationViews.$inferSelect;

export const locationClicks = pgTable("location_clicks", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => userLocations.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "website" | "booking" | "directions" | "phone" | "yelp" | "facebook"
  userId: integer("user_id"),
  clientId: text("client_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("location_clicks_loc_created_idx").on(t.locationId, t.createdAt)]);

export type LocationClick = typeof locationClicks.$inferSelect;

export const insertUserLocationSchema = createInsertSchema(userLocations).omit({
  id: true,
  nominationCount: true,
  createdAt: true,
});

export type UserLocation = typeof userLocations.$inferSelect;
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;

export const badgeProfiles = pgTable("badge_profiles", {
  username: text("username").primaryKey(),
  featuredBadges: text("featured_badges").default("[]").notNull(),
  plungeCount: integer("plunge_count").default(0).notNull(),
  uniqueDays: integer("unique_days").default(0).notNull(),
  coldestTemp: integer("coldest_temp"),
  foundingPlunger: boolean("founding_plunger").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socialLinks: text("social_links").default("{}").notNull(),
});

export type BadgeProfile = typeof badgeProfiles.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  clientId: text("client_id"),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export type InsertPlunge = z.infer<typeof insertPlungeSchema>;
export type UpdatePlunge = z.infer<typeof updatePlungeSchema>;
export type Plunge = typeof plunges.$inferSelect;
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;

// ── Events ────────────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  // Optional end date — max 7 days after eventDate. Event auto-deletes after endDate (or eventDate + 7d if null).
  endDate: timestamp("end_date"),
  locationName: text("location_name"),
  locationId: text("location_id"),
  // Plunge spot coordinates
  plungeLat: numeric("plunge_lat", { precision: 9, scale: 6 }),
  plungeLng: numeric("plunge_lng", { precision: 9, scale: 6 }),
  // Parking / access point coordinates (where directions navigate to)
  accessLat: numeric("access_lat", { precision: 9, scale: 6 }),
  accessLng: numeric("access_lng", { precision: 9, scale: 6 }),
  // Organizer contact info (optional, shown in event detail)
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  createdBy: integer("created_by"),
  createdByUsername: text("created_by_username"),
  shareCode: text("share_code").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  // 'active' | 'postponed' | 'cancelled'
  status: text("status").default("active").notNull(),
  organizerNote: text("organizer_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  maxAttendees: integer("max_attendees"),
  waiverUrl: text("waiver_url"),
  paymentUrl: text("payment_url"),
});

export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export const eventParticipants = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("event_participant_idx").on(t.eventId, t.userId)]);

export type EventParticipant = typeof eventParticipants.$inferSelect;

export const eventCoordinators = pgTable("event_coordinators", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("event_coordinator_idx").on(t.eventId, t.userId)]);

export type EventCoordinator = typeof eventCoordinators.$inferSelect;

export const eventBans = pgTable("event_bans", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  bannedAt: timestamp("banned_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("event_ban_idx").on(t.eventId, t.userId)]);

export type EventBan = typeof eventBans.$inferSelect;

// ── Client Visits ─────────────────────────────────────────────────────────────
// First-touch + recurring activity log for every device that hits the API.
// Provides a server-side ground truth for "real visitors" independent of GA.
export const clientVisits = pgTable("client_visits", {
  clientId: text("client_id").primaryKey(), // UUID stored in localStorage on the client
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  visitCount: integer("visit_count").default(1).notNull(), // increments per request
  userAgent: text("user_agent"),
  lastPath: text("last_path"),
  platform: text("platform"), // "web" | "android" | "ios" — inferred from UA / origin
  userId: integer("user_id"), // set once the client signs in / claims plunges
});

export type ClientVisit = typeof clientVisits.$inferSelect;

export const shareEvents = pgTable("share_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),                  // null for anonymous shares
  clientId: text("client_id"),                 // device id (so we can attribute anon)
  kind: text("kind").notNull(),                // "plunge" | "profile" | "event" | "badge_profile"
  targetId: text("target_id"),                 // plunge id / event slug / username — free-form
  channel: text("channel"),                    // "native" | "webshare" | "clipboard" | "file" | "unknown"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ShareEvent = typeof shareEvents.$inferSelect;

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  username: text("username"),
  email: text("email"),
  category: text("category").notNull(), // bug | refund | feature | other
  message: text("message").notNull(),
  deviceInfo: text("device_info"), // JSON string
  status: text("status").default("open").notNull(), // open | resolved
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true });
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

// ── Churn Surveys ─────────────────────────────────────────────────────────────
// Sent automatically when a user goes inactive (>=7 days since last plunge).
// One row per send; respondedAt + reason populate when the user opens the link.
export const churnSurveys = pgTable("churn_surveys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  daysInactive: integer("days_inactive").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  reason: text("reason"),         // "too_cold" | "lost_interest" | "app_issue" | "found_other" | "life_busy" | "other"
  comment: text("comment"),
  cameBack: boolean("came_back").default(false).notNull(), // flipped true when they plunge again after sentAt
});

export type ChurnSurvey = typeof churnSurveys.$inferSelect;

// ── Reports (Apple App Review Guideline 1.2 — UGC moderation) ─────────────────
// Users can report community-submitted locations or events as inappropriate.
// Admin reviews via /api/admin/reports and either resolves or removes content.
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // "location" | "event"
  targetId: integer("target_id").notNull(),
  targetName: text("target_name"), // snapshot of name at report time
  reporterEmail: text("reporter_email"),
  reporterUsername: text("reporter_username"),
  reason: text("reason").notNull(),
  status: text("status").default("open").notNull(), // open | resolved | removed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true, status: true });
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
