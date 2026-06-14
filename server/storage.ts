import { db } from "./db";
import {
  plunges, leaderboardEntries, proUsers, promoCodes, userLocations, businessListings, users, badgeProfiles, pushSubscriptions,
  events, eventParticipants, eventCoordinators, eventBans, supportMessages, clientVisits, shareEvents,
  verifiedBusinessSubs, reports, locationViews, locationClicks,
  type InsertPlunge, type UpdatePlunge, type Plunge,
  type InsertLeaderboardEntry, type LeaderboardEntry, type ProUser,
  type PromoCode, type UserLocation, type InsertUserLocation, type User, type BadgeProfile, type PushSubscription,
  type BusinessListing, type Event, type EventParticipant, type EventCoordinator, type EventBan,
  type SupportMessage, type InsertSupportMessage, type ClientVisit,
  type VerifiedBusinessSub,
  type Report, type InsertReport,
  type BusinessHours,
  streakFreezes, type StreakFreeze,
  spotifyAccounts, type SpotifyAccount,
} from "@shared/schema";
import { desc, eq, sql, or, isNull, and, not, lt, gte, inArray, sum } from "drizzle-orm";

export interface IStorage {
  // Plunges
  getPlunges(clientId?: string, userId?: number): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
  updatePlunge(id: number, patch: UpdatePlunge): Promise<Plunge>;
  deletePlunge(id: number): Promise<void>;
  claimPlunges(clientId: string, userId: number): Promise<void>;
  // Leaderboard
  getLeaderboard(locationId: string, limit?: number): Promise<(LeaderboardEntry & { foundingPlunger: boolean })[]>;
  addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
  deleteLeaderboardEntry(id: number): Promise<void>;
  // Pro users
  getProUser(email: string): Promise<ProUser | null>;
  getAllProUsers(): Promise<ProUser[]>;
  getFreeUsers(): Promise<{ id: number; email: string; username: string | null; displayName: string | null; isDisabled: boolean; createdAt: Date }[]>;
  setUserDisabled(id: number, disabled: boolean): Promise<void>;
  getProUserCount(): Promise<number>;
  createProUser(email: string, stripeSessionId: string, opts?: { planType?: string; stripeSubscriptionId?: string; expiresAt?: Date }): Promise<ProUser>;
  updateProUserSubscription(subscriptionId: string, expiresAt: Date): Promise<void>;
  deactivateProUserBySubscriptionId(subscriptionId: string): Promise<void>;
  setProUserActive(email: string, active: boolean): Promise<ProUser | null>;
  deleteProUser(email: string): Promise<boolean>;
  // Promo codes
  getPromoCode(code: string): Promise<PromoCode | null>;
  redeemPromoCode(code: string): Promise<PromoCode | null>;
  // Community locations
  getUserLocations(country?: string, includeHidden?: boolean): Promise<UserLocation[]>;
  getUserLocationById(id: number): Promise<UserLocation | null>;
  createUserLocation(loc: InsertUserLocation): Promise<UserLocation>;
  updateUserLocation(id: number, updates: Partial<InsertUserLocation>): Promise<UserLocation | null>;
  setLocationHidden(id: number, hidden: boolean): Promise<UserLocation | null>;
  deleteUserLocation(id: number): Promise<void>;
  nominateUserLocation(id: number): Promise<UserLocation | null>;
  // Auth users
  createUser(email: string, passwordHash: string, opts?: { username?: string; displayName?: string; bodyWeight?: number }): Promise<User>;
  upsertAdminAccount(email: string, passwordHash: string, opts?: { username?: string }): Promise<void>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByUsernameInsensitive(username: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  deleteUser(id: number): Promise<void>;
  setResetToken(email: string, token: string, expiry: Date): Promise<boolean>;
  getUserByResetToken(token: string): Promise<User | null>;
  clearResetToken(id: number): Promise<void>;
  updatePassword(id: number, passwordHash: string): Promise<void>;
  setVerifyToken(userId: number, token: string): Promise<void>;
  verifyEmailToken(token: string): Promise<User | null>;
  updateUserProfile(id: number, patch: { displayName?: string; bodyWeight?: number; username?: string }): Promise<User>;
  getUserCount(): Promise<number>;

  // Client visits (server-side first-touch / activity ground truth)
  recordClientVisit(data: { clientId: string; userAgent?: string; path?: string; platform?: string; userId?: number }): Promise<void>;
  getRecentClientVisits(limit?: number): Promise<ClientVisit[]>;
  getClientVisitStats(): Promise<{ totalClients: number; newClients24h: number; newClients7d: number; newClients30d: number; activeClients24h: number; activeClients7d: number }>;

  // Share events (track every Share button press, native share, etc.)
  recordShareEvent(data: { userId?: number; clientId?: string; kind: string; targetId?: string; channel?: string }): Promise<void>;
  getShareCountsByUser(): Promise<Map<number, { total: number; byKind: Record<string, number>; lastAt: Date | null }>>;
  getRecentShares(limit?: number): Promise<Array<{ id: number; userId: number | null; clientId: string | null; kind: string; targetId: string | null; channel: string | null; createdAt: Date }>>;

  // Combined per-user usage report (signup + plunges + streaks + last seen)
  getUserActivityReport(): Promise<Array<{
    id: number;
    email: string;
    username: string | null;
    displayName: string | null;
    emailVerified: boolean;
    isAdmin: boolean;
    isPro: boolean;
    signedUpAt: Date;
    totalPlunges: number;
    uniqueDays: number;
    currentStreak: number;
    longestStreak: number;
    firstPlungeAt: Date | null;
    lastPlungeAt: Date | null;
    plungesThisMonth: number;
    lastPlungeTemp: number | null;
    lastPlungeDurationSec: number | null;
    lastPlungeScore: number | null;
    lastApiSeenAt: Date | null;
    totalApiVisits: number;
    platforms: string | null;
    totalShares: number;
    sharesByKind: Record<string, number>;
    lastShareAt: Date | null;
  }>>;

  upsertBadgeProfile(data: { username: string; featuredBadges: string; plungeCount: number; uniqueDays: number; coldestTemp: number | null; foundingPlunger?: boolean; avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void>;
  updateBadgeProfileMeta(username: string, data: { avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void>;
  getBadgeProfile(username: string): Promise<BadgeProfile | null>;
  getFoundingPlungerBatch(displayNames: string[]): Promise<Record<string, boolean>>;

  // Business listings
  createBusinessListing(data: { locationId: number; email: string; stripeSessionId?: string; stripeSubscriptionId?: string; expiresAt?: Date; source?: "stripe" | "iap" }): Promise<BusinessListing>;
  getBusinessListingBySubscriptionId(subscriptionId: string): Promise<BusinessListing | null>;
  markLocationBusinessVerified(locationId: number, verified: boolean): Promise<void>;
  updateBusinessListingSubscription(subscriptionId: string, expiresAt: Date): Promise<void>;
  deactivateBusinessListingBySubscriptionId(subscriptionId: string): Promise<void>;
  // Verified Business Listing IAP subs
  countActiveBusinessListingsForEmail(email: string, source?: "stripe" | "iap"): Promise<number>;
  deactivateAllIapBusinessListingsForEmail(email: string): Promise<void>;
  upsertVerifiedBusinessSub(data: { email: string; appUserId: string; productId: string; tierCapacity: number; expiresAt: Date | null; active: boolean }): Promise<VerifiedBusinessSub>;
  getVerifiedBusinessSubByEmail(email: string): Promise<VerifiedBusinessSub | null>;
  setVerifiedBusinessSubActive(email: string, active: boolean): Promise<void>;
  bindIapBusinessListing(args: {
    email: string;
    locationId: number;
    appUserId: string;
    productId: string;
    tierCapacity: number;
    expiresAt: Date | null;
  }): Promise<{ ok: true; used: number; capacity: number } | { ok: false; reason: "capacity"; used: number; capacity: number }>;
  // Reconcile local iap-business state with RevenueCat ground truth.
  // Used by /api/iap/verified-business-status on every read so that
  // missed/delayed webhooks, expired entitlements, and tier downgrades
  // are corrected immediately. Runs atomically in a single transaction.
  reconcileVerifiedBusinessFromRC(args: {
    email: string;
    rcActive: boolean;
    productId: string | null;
    tierCapacity: number | null;
    expiresAt: Date | null;
    appUserId: string;
  }): Promise<{ active: boolean; tierCapacity: number; used: number }>;
  // Push notifications
  upsertPushSubscription(data: { userId?: number; clientId?: string; endpoint: string; p256dh: string; auth: string }): Promise<PushSubscription>;
  getPushSubscription(endpoint: string): Promise<PushSubscription | null>;
  getPushSubscriptionsByUser(userId: number): Promise<PushSubscription[]>;
  getPushSubscriptionsByClient(clientId: string): Promise<PushSubscription[]>;
  updatePushSubscriptionSentAt(endpoint: string): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  // Events
  getEvents(): Promise<Event[]>;
  getEventByCode(shareCode: string): Promise<Event | null>;
  getEventById(id: number): Promise<Event | null>;
  createEvent(data: { name: string; description?: string; eventDate: Date; endDate?: Date; locationName?: string; locationId?: string; plungeLat?: number; plungeLng?: number; accessLat?: number; accessLng?: number; contactName?: string; contactPhone?: string; contactEmail?: string; createdBy?: number; createdByUsername?: string; shareCode: string; maxAttendees?: number | null; waiverUrl?: string; paymentUrl?: string; isPrivate?: boolean; status?: string; organizerNote?: string }): Promise<Event>;
  updateEvent(id: number, data: { name?: string; description?: string; eventDate?: Date; endDate?: Date | null; locationName?: string; plungeLat?: number | null; plungeLng?: number | null; accessLat?: number | null; accessLng?: number | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; maxAttendees?: number | null; waiverUrl?: string | null; paymentUrl?: string | null; isPrivate?: boolean; status?: string; organizerNote?: string | null }): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  deleteExpiredEvents(): Promise<number>;
  getEventParticipants(eventId: number): Promise<EventParticipant[]>;
  getEventParticipantCount(eventId: number): Promise<number>;
  joinEvent(eventId: number, userId: number, username: string): Promise<EventParticipant>;
  leaveEvent(eventId: number, userId: number): Promise<void>;
  getJoinedEventIds(userId: number): Promise<number[]>;
  removeEventParticipant(eventId: number, userId: number): Promise<void>;
  isEventParticipant(eventId: number, userId: number): Promise<boolean>;
  // Event coordinators
  getEventCoordinators(eventId: number): Promise<EventCoordinator[]>;
  addEventCoordinator(eventId: number, userId: number, username: string): Promise<EventCoordinator>;
  removeEventCoordinator(eventId: number, userId: number): Promise<void>;
  isEventCoordinator(eventId: number, userId: number): Promise<boolean>;
  // Event bans
  getEventBans(eventId: number): Promise<EventBan[]>;
  banEventParticipant(eventId: number, userId: number, username: string): Promise<EventBan>;
  unbanEventParticipant(eventId: number, userId: number): Promise<void>;
  isEventBanned(eventId: number, userId: number): Promise<boolean>;
  // Event leaderboard
  getEventLeaderboard(eventId: number): Promise<Array<{ username: string; userId: number; totalScore: number; plungeCount: number }>>;
  // Location view tracking
  incrementLocationView(id: number): Promise<void>;
  // Business analytics
  getMyVerifiedListings(email: string): Promise<UserLocation[]>;
  recordLocationView(data: { locationId: number; userId?: number | null; clientId?: string | null }): Promise<void>;
  recordLocationClick(data: { locationId: number; kind: string; userId?: number | null; clientId?: string | null }): Promise<void>;
  getLocationStats(locationId: number, days: number): Promise<{
    views: { allTime: number; window: number };
    plunges: { allTime: number; window: number; uniquePlungers: number };
    clicks: Record<string, number>;
  }>;
  getLocationTrend(locationId: number, days: number): Promise<Array<{ date: string; views: number; plunges: number; clicks: number }>>;
  getLocationLeaderboard(locationId: number, limit: number): Promise<Array<{
    username: string;
    userId: number | null;
    bestScore: number;
    plungeCount: number;
    lastPlungeAt: Date;
  }>>;
  getAllVerifiedListings(): Promise<UserLocation[]>;
  // Public profile / share / hours / co-managers / CSV export
  getLocationBySlug(slug: string): Promise<UserLocation | null>;
  ensureLocationSlug(id: number): Promise<string>;
  updateLocationHours(id: number, hours: BusinessHours | null): Promise<void>;
  updateLocationTimezone(id: number, timezone: string | null): Promise<void>;
  addCoManager(id: number, email: string): Promise<string[]>;
  removeCoManager(id: number, email: string): Promise<string[]>;
  exportLocationPlungersCSV(locationId: number, opts: { sortBy: "bestScore" | "plungeCount" | "periodPlunges" | "lastPlungeAt"; days: number }): Promise<string>;
  // User lookup for coordinator assignment
  getUserByDisplayName(displayName: string): Promise<User | null>;
  getUserByEmailPrefix(prefix: string): Promise<User | null>;
  clearAdminDisplayNames(): Promise<void>;
  // Support messages
  createSupportMessage(msg: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessages(): Promise<SupportMessage[]>;
  getSupportMessageById(id: number): Promise<SupportMessage | null>;
  resolveSupportMessage(id: number): Promise<void>;
  // UGC reports (Apple App Review Guideline 1.2)
  createReport(report: InsertReport): Promise<Report>;
  getReports(status?: "open" | "resolved" | "removed"): Promise<Report[]>;
  setReportStatus(id: number, status: "open" | "resolved" | "removed"): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPlunges(clientId?: string, userId?: number): Promise<Plunge[]> {
    if (userId) {
      return await db.select().from(plunges)
        .where(eq(plunges.userId, userId))
        .orderBy(desc(plunges.createdAt));
    }
    if (clientId) {
      return await db.select().from(plunges)
        .where(or(eq(plunges.clientId, clientId), isNull(plunges.clientId)))
        .orderBy(desc(plunges.createdAt));
    }
    return await db.select().from(plunges).orderBy(desc(plunges.createdAt));
  }

  async createPlunge(plunge: InsertPlunge): Promise<Plunge> {
    const [newPlunge] = await db.insert(plunges).values(plunge).returning();
    return newPlunge;
  }

  async updatePlunge(id: number, patch: UpdatePlunge): Promise<Plunge> {
    const [updated] = await db.update(plunges).set(patch).where(eq(plunges.id, id)).returning();
    return updated;
  }

  async deletePlunge(id: number): Promise<void> {
    await db.delete(plunges).where(eq(plunges.id, id));
  }

  async claimPlunges(clientId: string, userId: number): Promise<void> {
    await db.update(plunges)
      .set({ userId })
      .where(and(eq(plunges.clientId, clientId), isNull(plunges.userId)));
  }

  async getLeaderboard(locationId: string, limit = 10): Promise<(LeaderboardEntry & { foundingPlunger: boolean })[]> {
    const rows = await db
      .select({
        id: leaderboardEntries.id,
        locationId: leaderboardEntries.locationId,
        username: leaderboardEntries.username,
        score: leaderboardEntries.score,
        duration: leaderboardEntries.duration,
        temperature: leaderboardEntries.temperature,
        verificationLevel: leaderboardEntries.verificationLevel,
        hasPhoto: leaderboardEntries.hasPhoto,
        locationVerified: leaderboardEntries.locationVerified,
        createdAt: leaderboardEntries.createdAt,
        foundingPlunger: badgeProfiles.foundingPlunger,
        featuredBadges: badgeProfiles.featuredBadges,
      })
      .from(leaderboardEntries)
      .leftJoin(badgeProfiles, eq(leaderboardEntries.username, badgeProfiles.username))
      .where(eq(leaderboardEntries.locationId, locationId))
      .orderBy(desc(leaderboardEntries.score))
      .limit(limit);
    return rows.map((r) => ({ ...r, foundingPlunger: r.foundingPlunger ?? false, featuredBadges: r.featuredBadges ?? "[]" }));
  }

  async addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const [result] = await db
      .insert(leaderboardEntries)
      .values({ ...entry, score: String(entry.score) })
      .onConflictDoUpdate({
        target: [leaderboardEntries.locationId, leaderboardEntries.username],
        set: {
          score: sql`GREATEST(excluded.score::numeric, leaderboard_entries.score::numeric)`,
          duration: sql`CASE WHEN excluded.score::numeric > leaderboard_entries.score::numeric THEN excluded.duration ELSE leaderboard_entries.duration END`,
          temperature: sql`CASE WHEN excluded.score::numeric > leaderboard_entries.score::numeric THEN excluded.temperature ELSE leaderboard_entries.temperature END`,
          createdAt: sql`CASE WHEN excluded.score::numeric > leaderboard_entries.score::numeric THEN now() ELSE leaderboard_entries.created_at END`,
          verificationLevel: sql`GREATEST(excluded.verification_level, leaderboard_entries.verification_level)`,
          hasPhoto: sql`excluded.has_photo OR leaderboard_entries.has_photo`,
          locationVerified: sql`excluded.location_verified OR leaderboard_entries.location_verified`,
        },
      })
      .returning();
    return result;
  }

  async deleteLeaderboardEntry(id: number): Promise<void> {
    await db.delete(leaderboardEntries).where(eq(leaderboardEntries.id, id));
  }

  async getProUser(email: string): Promise<ProUser | null> {
    const [user] = await db.select().from(proUsers).where(eq(proUsers.email, email.toLowerCase()));
    return user ?? null;
  }

  async getAllProUsers(): Promise<ProUser[]> {
    return db.select().from(proUsers).orderBy(desc(proUsers.createdAt));
  }

  async getFreeUsers(): Promise<{ id: number; email: string; username: string | null; displayName: string | null; isDisabled: boolean; createdAt: Date }[]> {
    return db
      .select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, isDisabled: users.isDisabled, createdAt: users.createdAt })
      .from(users)
      .where(sql`lower(${users.email}) NOT IN (
        SELECT email FROM pro_users
        WHERE active = true AND (expires_at IS NULL OR expires_at > NOW())
      )`)
      .orderBy(desc(users.createdAt))
      .limit(500);
  }

  async setUserDisabled(id: number, disabled: boolean): Promise<void> {
    await db.update(users).set({ isDisabled: disabled }).where(eq(users.id, id));
  }

  async setProUserActive(email: string, active: boolean): Promise<ProUser | null> {
    const [updated] = await db
      .update(proUsers)
      .set({ active })
      .where(eq(proUsers.email, email.toLowerCase()))
      .returning();
    return updated ?? null;
  }

  async deleteProUser(email: string): Promise<boolean> {
    const result = await db
      .delete(proUsers)
      .where(eq(proUsers.email, email.toLowerCase()))
      .returning({ id: proUsers.id });
    return result.length > 0;
  }

  async getProUserCount(): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proUsers)
      .where(and(eq(proUsers.active, true), not(eq(proUsers.planType, "promo"))));
    return count;
  }

  async createProUser(email: string, stripeSessionId: string, opts?: { planType?: string; stripeSubscriptionId?: string; expiresAt?: Date }): Promise<ProUser> {
    const newPlan = opts?.planType ?? "lifetime";
    const lowerEmail = email.toLowerCase();

    // Application-level downgrade guard: never overwrite lifetime with a lower plan.
    // This is more reliable than a SQL CASE expression in the ON CONFLICT clause.
    const existing = await this.getProUser(lowerEmail);
    if (existing && existing.planType === "lifetime" && newPlan !== "lifetime") {
      console.log(`[storage] Skipping downgrade attempt: ${lowerEmail} is lifetime, rejecting ${newPlan}`);
      // Re-activate if it was deactivated and keep all lifetime values
      if (!existing.active) {
        const [updated] = await db.update(proUsers).set({ active: true }).where(eq(proUsers.email, lowerEmail)).returning();
        return updated;
      }
      return existing;
    }

    const count = await this.getProUserCount();
    const isPaidPlan = newPlan !== "promo";
    const isFounder = isPaidPlan && count < 1000;
    const newSubId = newPlan === "lifetime" ? null : (opts?.stripeSubscriptionId ?? null);
    const newExpiry = newPlan === "lifetime" ? null : (opts?.expiresAt ?? null);

    const [user] = await db
      .insert(proUsers)
      .values({
        email: lowerEmail,
        stripeSessionId,
        foundingPlunger: isFounder,
        planType: newPlan,
        stripeSubscriptionId: newSubId,
        expiresAt: newExpiry,
      })
      .onConflictDoUpdate({
        target: proUsers.email,
        set: {
          stripeSessionId,
          active: true,
          planType: newPlan,
          stripeSubscriptionId: newSubId,
          expiresAt: newExpiry,
        },
      })
      .returning();
    return user;
  }

  async updateProUserSubscription(subscriptionId: string, expiresAt: Date): Promise<void> {
    await db.update(proUsers)
      .set({ expiresAt, active: true })
      .where(eq(proUsers.stripeSubscriptionId, subscriptionId));
  }

  async deactivateProUserBySubscriptionId(subscriptionId: string): Promise<void> {
    await db.update(proUsers)
      .set({ active: false })
      .where(eq(proUsers.stripeSubscriptionId, subscriptionId));
  }

  async getPromoCode(code: string): Promise<PromoCode | null> {
    const [row] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase().trim()));
    return row ?? null;
  }

  async seedPromoCode(code: string, durationDays: number, maxUses: number): Promise<void> {
    const normalized = code.toUpperCase().trim();
    const existing = await db.select().from(promoCodes).where(eq(promoCodes.code, normalized));
    if (existing.length === 0) {
      await db.insert(promoCodes).values({ code: normalized, durationDays, maxUses, usedCount: 0 });
    }
  }

  async redeemPromoCode(code: string): Promise<PromoCode | null> {
    const normalized = code.toUpperCase().trim();
    const [row] = await db.select().from(promoCodes).where(eq(promoCodes.code, normalized));
    if (!row) return null;
    if (row.usedCount >= row.maxUses) return null;
    const [updated] = await db
      .update(promoCodes)
      .set({ usedCount: row.usedCount + 1 })
      .where(eq(promoCodes.code, normalized))
      .returning();
    return updated;
  }

  async getUserLocationById(id: number): Promise<UserLocation | null> {
    const [loc] = await db.select().from(userLocations).where(eq(userLocations.id, id)).limit(1);
    return loc ?? null;
  }

  async getUserLocations(country?: string, includeHidden = false): Promise<UserLocation[]> {
    const conditions = [];
    if (!includeHidden) conditions.push(eq(userLocations.isHidden, false));
    if (country && country !== "All") conditions.push(eq(userLocations.country, country));
    return await db.select().from(userLocations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(userLocations.nominationCount));
  }

  async setLocationHidden(id: number, hidden: boolean): Promise<UserLocation | null> {
    const [updated] = await db.update(userLocations).set({ isHidden: hidden }).where(eq(userLocations.id, id)).returning();
    return updated ?? null;
  }

  async createUserLocation(loc: InsertUserLocation): Promise<UserLocation> {
    const [created] = await db.insert(userLocations).values(loc).returning();
    return created;
  }

  async updateUserLocation(id: number, updates: Partial<InsertUserLocation>): Promise<UserLocation | null> {
    const [updated] = await db.update(userLocations).set(updates).where(eq(userLocations.id, id)).returning();
    return updated ?? null;
  }

  async deleteUserLocation(id: number): Promise<void> {
    await db.delete(userLocations).where(eq(userLocations.id, id));
  }

  async nominateUserLocation(id: number): Promise<UserLocation | null> {
    const [updated] = await db
      .update(userLocations)
      .set({ nominationCount: sql`${userLocations.nominationCount} + 1` })
      .where(eq(userLocations.id, id))
      .returning();
    return updated ?? null;
  }

  async createUser(
    email: string,
    passwordHash: string,
    opts?: { username?: string; displayName?: string; bodyWeight?: number },
  ): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        ...(opts?.username ? { username: opts.username } : {}),
        ...(opts?.displayName ? { displayName: opts.displayName } : {}),
        ...(typeof opts?.bodyWeight === "number" && opts.bodyWeight > 0
          ? { bodyWeight: Math.round(opts.bodyWeight) }
          : {}),
      })
      .returning();
    return user;
  }

  async upsertAdminAccount(email: string, passwordHash: string, opts?: { username?: string }): Promise<void> {
    const e = email.toLowerCase();
    const [existing] = await db.select().from(users).where(eq(users.email, e));
    if (!existing) {
      await db.insert(users).values({
        email: e,
        username: opts?.username ?? null,
        passwordHash,
        emailVerified: true,
        isAdmin: true,
        isDisabled: false,
      });
      console.log(`[seed] Admin account created: ${e}${opts?.username ? ` (username: ${opts.username})` : ""}`);
    } else {
      // IMPORTANT: do NOT overwrite passwordHash on existing accounts.
      // The seed runs on every server startup; resetting the password each time
      // would silently undo any password change made via /api/admin/force-password-reset
      // or any future password-reset flow. To rotate an admin password use that
      // endpoint instead.
      await db.update(users).set({
        isAdmin: true,
        isDisabled: false,
        ...(opts?.username ? { username: opts.username } : {}),
      }).where(eq(users.email, e));
      console.log(`[seed] Admin account confirmed (password preserved): ${e}`);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user ?? null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user ?? null;
  }

  // Case-insensitive lookup — used to enforce unique handles regardless of casing.
  async getUserByUsernameInsensitive(username: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`);
    return user ?? null;
  }

  async getUserById(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async setResetToken(email: string, token: string, expiry: Date): Promise<boolean> {
    const result = await db.update(users)
      .set({ resetToken: token, resetTokenExpiry: expiry })
      .where(eq(users.email, email.toLowerCase()))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async getUserByResetToken(token: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user ?? null;
  }

  async clearResetToken(id: number): Promise<void> {
    await db.update(users)
      .set({ resetToken: null, resetTokenExpiry: null })
      .where(eq(users.id, id));
  }

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async setVerifyToken(userId: number, token: string): Promise<void> {
    await db.update(users)
      .set({ emailVerifyToken: token })
      .where(eq(users.id, userId));
  }

  async verifyEmailToken(token: string): Promise<User | null> {
    const [user] = await db.select().from(users)
      .where(eq(users.emailVerifyToken, token));
    if (!user) return null;
    const [updated] = await db.update(users)
      .set({ emailVerified: true, emailVerifyToken: null })
      .where(eq(users.id, user.id))
      .returning();
    return updated ?? null;
  }

  async updateUserProfile(id: number, patch: { displayName?: string; bodyWeight?: number; username?: string }): Promise<User> {
    const [updated] = await db.update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getUserCount(): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    return count;
  }

  async upsertBadgeProfile(data: { username: string; featuredBadges: string; plungeCount: number; uniqueDays: number; coldestTemp: number | null; foundingPlunger?: boolean; avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void> {
    const fp = data.foundingPlunger ?? false;
    const existing = await this.getBadgeProfile(data.username);
    await db.insert(badgeProfiles)
      .values({
        username: data.username,
        featuredBadges: data.featuredBadges,
        plungeCount: data.plungeCount,
        uniqueDays: data.uniqueDays,
        coldestTemp: data.coldestTemp,
        foundingPlunger: fp,
        updatedAt: new Date(),
        avatarUrl: data.avatarUrl ?? existing?.avatarUrl ?? null,
        bio: data.bio ?? existing?.bio ?? null,
        socialLinks: data.socialLinks ?? existing?.socialLinks ?? "{}",
      })
      .onConflictDoUpdate({
        target: badgeProfiles.username,
        set: {
          featuredBadges: data.featuredBadges,
          plungeCount: data.plungeCount,
          uniqueDays: data.uniqueDays,
          coldestTemp: data.coldestTemp,
          foundingPlunger: fp,
          updatedAt: new Date(),
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.socialLinks !== undefined ? { socialLinks: data.socialLinks } : {}),
        },
      });
  }

  async updateBadgeProfileMeta(username: string, data: { avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.avatarUrl !== undefined) set.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) set.bio = data.bio;
    if (data.socialLinks !== undefined) set.socialLinks = data.socialLinks;
    await db.insert(badgeProfiles)
      .values({ username, featuredBadges: "[]", plungeCount: 0, uniqueDays: 0, coldestTemp: null, foundingPlunger: false, ...set })
      .onConflictDoUpdate({ target: badgeProfiles.username, set });
  }

  async getBadgeProfile(username: string): Promise<BadgeProfile | null> {
    const [profile] = await db.select().from(badgeProfiles).where(eq(badgeProfiles.username, username));
    return profile ?? null;
  }

  async getFoundingPlungerBatch(displayNames: string[]): Promise<Record<string, boolean>> {
    if (!displayNames.length) return {};
    const rows = await db
      .select({ displayName: users.displayName, foundingPlunger: proUsers.foundingPlunger })
      .from(users)
      .innerJoin(proUsers, eq(proUsers.email, users.email))
      .where(sql`lower(${users.displayName}) IN (${sql.join(displayNames.map((n) => sql`lower(${n})`), sql`, `)})`);
    const map: Record<string, boolean> = {};
    for (const row of rows) {
      if (row.displayName) map[row.displayName.toLowerCase()] = row.foundingPlunger ?? false;
    }
    return map;
  }

  async createBusinessListing(data: { locationId: number; email: string; stripeSessionId?: string; stripeSubscriptionId?: string; expiresAt?: Date; source?: "stripe" | "iap" }): Promise<BusinessListing> {
    const [listing] = await db.insert(businessListings).values({
      locationId: data.locationId,
      email: data.email,
      stripeSessionId: data.stripeSessionId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      expiresAt: data.expiresAt ?? null,
      active: true,
      source: data.source ?? "stripe",
    }).returning();
    return listing;
  }

  async getBusinessListingBySubscriptionId(subscriptionId: string): Promise<BusinessListing | null> {
    const [listing] = await db.select().from(businessListings).where(eq(businessListings.stripeSubscriptionId, subscriptionId));
    return listing ?? null;
  }

  async markLocationBusinessVerified(locationId: number, verified: boolean): Promise<void> {
    await db.update(userLocations).set({ businessVerified: verified }).where(eq(userLocations.id, locationId));
  }

  async updateBusinessListingSubscription(subscriptionId: string, expiresAt: Date): Promise<void> {
    await db.update(businessListings).set({ expiresAt, active: true }).where(eq(businessListings.stripeSubscriptionId, subscriptionId));
  }

  async deactivateBusinessListingBySubscriptionId(subscriptionId: string): Promise<void> {
    const [listing] = await db.update(businessListings)
      .set({ active: false })
      .where(eq(businessListings.stripeSubscriptionId, subscriptionId))
      .returning();
    if (listing) {
      await db.update(userLocations).set({ businessVerified: false }).where(eq(userLocations.id, listing.locationId));
    }
  }

  async countActiveBusinessListingsForEmail(email: string, source?: "stripe" | "iap"): Promise<number> {
    const lowered = email.toLowerCase().trim();
    const where = source
      ? and(eq(sql`lower(${businessListings.email})`, lowered), eq(businessListings.active, true), eq(businessListings.source, source))
      : and(eq(sql`lower(${businessListings.email})`, lowered), eq(businessListings.active, true));
    const rows = await db.select({ id: businessListings.id }).from(businessListings).where(where);
    return rows.length;
  }

  async deactivateAllIapBusinessListingsForEmail(email: string): Promise<void> {
    const lowered = email.toLowerCase().trim();
    const rows = await db.update(businessListings)
      .set({ active: false })
      .where(and(eq(sql`lower(${businessListings.email})`, lowered), eq(businessListings.source, "iap"), eq(businessListings.active, true)))
      .returning();
    for (const row of rows) {
      await db.update(userLocations).set({ businessVerified: false }).where(eq(userLocations.id, row.locationId));
    }
  }

  async upsertVerifiedBusinessSub(data: { email: string; appUserId: string; productId: string; tierCapacity: number; expiresAt: Date | null; active: boolean }): Promise<VerifiedBusinessSub> {
    const lowered = data.email.toLowerCase().trim();
    const [sub] = await db.insert(verifiedBusinessSubs)
      .values({
        email: lowered,
        appUserId: data.appUserId,
        productId: data.productId,
        tierCapacity: data.tierCapacity,
        expiresAt: data.expiresAt,
        active: data.active,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: verifiedBusinessSubs.email,
        set: {
          appUserId: data.appUserId,
          productId: data.productId,
          tierCapacity: data.tierCapacity,
          expiresAt: data.expiresAt,
          active: data.active,
          updatedAt: new Date(),
        },
      })
      .returning();
    return sub;
  }

  async getVerifiedBusinessSubByEmail(email: string): Promise<VerifiedBusinessSub | null> {
    const lowered = email.toLowerCase().trim();
    const [sub] = await db.select().from(verifiedBusinessSubs).where(eq(verifiedBusinessSubs.email, lowered));
    return sub ?? null;
  }

  async setVerifiedBusinessSubActive(email: string, active: boolean): Promise<void> {
    const lowered = email.toLowerCase().trim();
    await db.update(verifiedBusinessSubs)
      .set({ active, updatedAt: new Date() })
      .where(eq(verifiedBusinessSubs.email, lowered));
  }

  // Atomic capacity-checked bind. Wraps upsert of the sub row, capacity
  // count, and listing insert in a single transaction with a row-level
  // lock on the per-email sub row, so concurrent /api/iap/verify-business
  // calls cannot exceed the tier's location cap.
  async bindIapBusinessListing(args: {
    email: string;
    locationId: number;
    appUserId: string;
    productId: string;
    tierCapacity: number;
    expiresAt: Date | null;
  }): Promise<{ ok: true; used: number; capacity: number } | { ok: false; reason: "capacity"; used: number; capacity: number }> {
    const lowered = args.email.toLowerCase().trim();
    return await db.transaction(async (tx) => {
      // 1) Upsert the sub row (and lock it) — serializes concurrent binds
      //    for the same email.
      await tx.insert(verifiedBusinessSubs)
        .values({
          email: lowered,
          appUserId: args.appUserId,
          productId: args.productId,
          tierCapacity: args.tierCapacity,
          expiresAt: args.expiresAt,
          active: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: verifiedBusinessSubs.email,
          set: {
            appUserId: args.appUserId,
            productId: args.productId,
            tierCapacity: args.tierCapacity,
            expiresAt: args.expiresAt,
            active: true,
            updatedAt: new Date(),
          },
        });
      // SELECT FOR UPDATE the sub row — guarantees other concurrent
      // transactions for this email queue behind us before counting.
      await tx.execute(sql`SELECT id FROM verified_business_subs WHERE email = ${lowered} FOR UPDATE`);

      // 2) Idempotency — does this location already have an active iap binding?
      const existing = await tx.select({ id: businessListings.id })
        .from(businessListings)
        .where(and(
          eq(businessListings.locationId, args.locationId),
          eq(sql`lower(${businessListings.email})`, lowered),
          eq(businessListings.source, "iap"),
          eq(businessListings.active, true),
        ));
      if (existing.length > 0) {
        const usedRows = await tx.select({ id: businessListings.id })
          .from(businessListings)
          .where(and(
            eq(sql`lower(${businessListings.email})`, lowered),
            eq(businessListings.source, "iap"),
            eq(businessListings.active, true),
          ));
        await tx.update(userLocations).set({ businessVerified: true }).where(eq(userLocations.id, args.locationId));
        return { ok: true as const, used: usedRows.length, capacity: args.tierCapacity };
      }

      // 3) Capacity check (now safe under the row lock)
      const usedRows = await tx.select({ id: businessListings.id })
        .from(businessListings)
        .where(and(
          eq(sql`lower(${businessListings.email})`, lowered),
          eq(businessListings.source, "iap"),
          eq(businessListings.active, true),
        ));
      if (usedRows.length >= args.tierCapacity) {
        return { ok: false as const, reason: "capacity", used: usedRows.length, capacity: args.tierCapacity };
      }

      // 4) Insert the listing + flip the verified bit
      await tx.insert(businessListings).values({
        locationId: args.locationId,
        email: lowered,
        stripeSessionId: `iap-${args.productId || "verified_business"}-${args.appUserId}`,
        stripeSubscriptionId: `iap-vb-${args.appUserId}-${args.locationId}`,
        expiresAt: args.expiresAt ?? null,
        active: true,
        source: "iap",
      });
      await tx.update(userLocations).set({ businessVerified: true }).where(eq(userLocations.id, args.locationId));

      return { ok: true as const, used: usedRows.length + 1, capacity: args.tierCapacity };
    });
  }

  async reconcileVerifiedBusinessFromRC(args: {
    email: string;
    rcActive: boolean;
    productId: string | null;
    tierCapacity: number | null;
    expiresAt: Date | null;
    appUserId: string;
  }): Promise<{ active: boolean; tierCapacity: number; used: number }> {
    const lowered = args.email.toLowerCase().trim();
    return await db.transaction(async (tx) => {
      // Inactive at RC → deactivate everything for this email regardless
      // of whether a local sub row exists. Earlier versions gated this
      // on localSub?.active and could leave orphaned active iap listings
      // when a webhook was missed.
      if (!args.rcActive) {
        await tx.update(verifiedBusinessSubs)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(verifiedBusinessSubs.email, lowered));
        const rows = await tx.update(businessListings)
          .set({ active: false })
          .where(and(
            eq(sql`lower(${businessListings.email})`, lowered),
            eq(businessListings.source, "iap"),
            eq(businessListings.active, true),
          ))
          .returning();
        for (const row of rows) {
          await tx.update(userLocations).set({ businessVerified: false }).where(eq(userLocations.id, row.locationId));
        }
        return { active: false, tierCapacity: 0, used: 0 };
      }

      // Active at RC but unrecognized product / no tier mapping → fail
      // closed: deactivate all iap listings (treat capacity as 0) so an
      // unmapped product can never grant verified status. We still
      // upsert the sub row so support can see the unmapped product id.
      if (!args.tierCapacity) {
        await tx.insert(verifiedBusinessSubs)
          .values({
            email: lowered,
            appUserId: args.appUserId,
            productId: args.productId ?? "",
            tierCapacity: 0,
            expiresAt: args.expiresAt,
            active: true,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: verifiedBusinessSubs.email,
            set: {
              appUserId: args.appUserId,
              productId: args.productId ?? "",
              tierCapacity: 0,
              expiresAt: args.expiresAt,
              active: true,
              updatedAt: new Date(),
            },
          });
        await tx.execute(sql`SELECT id FROM verified_business_subs WHERE email = ${lowered} FOR UPDATE`);
        const orphans = await tx.update(businessListings)
          .set({ active: false })
          .where(and(
            eq(sql`lower(${businessListings.email})`, lowered),
            eq(businessListings.source, "iap"),
            eq(businessListings.active, true),
          ))
          .returning();
        for (const row of orphans) {
          await tx.update(userLocations).set({ businessVerified: false }).where(eq(userLocations.id, row.locationId));
        }
        return { active: true, tierCapacity: 0, used: 0 };
      }

      // Active + recognized tier → refresh local cache to match RC
      await tx.insert(verifiedBusinessSubs)
        .values({
          email: lowered,
          appUserId: args.appUserId,
          productId: args.productId ?? "",
          tierCapacity: args.tierCapacity,
          expiresAt: args.expiresAt,
          active: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: verifiedBusinessSubs.email,
          set: {
            appUserId: args.appUserId,
            productId: args.productId ?? "",
            tierCapacity: args.tierCapacity,
            expiresAt: args.expiresAt,
            active: true,
            updatedAt: new Date(),
          },
        });
      // Lock the sub row before touching listings so concurrent binds
      // for this email cannot insert a new listing between our count
      // and our trim.
      await tx.execute(sql`SELECT id FROM verified_business_subs WHERE email = ${lowered} FOR UPDATE`);

      // Tier-downgrade enforcement: if local active iap listings exceed
      // the new tier cap, deactivate the oldest excess listings until
      // we're back under the limit. Oldest-first preserves the user's
      // most recently chosen verified locations.
      const activeListings = await tx.select({
          id: businessListings.id,
          locationId: businessListings.locationId,
          createdAt: businessListings.createdAt,
        })
        .from(businessListings)
        .where(and(
          eq(sql`lower(${businessListings.email})`, lowered),
          eq(businessListings.source, "iap"),
          eq(businessListings.active, true),
        ))
        .orderBy(businessListings.createdAt);

      let used = activeListings.length;
      if (used > args.tierCapacity) {
        const excessCount = used - args.tierCapacity;
        const toDeactivate = activeListings.slice(0, excessCount);
        for (const row of toDeactivate) {
          await tx.update(businessListings).set({ active: false }).where(eq(businessListings.id, row.id));
          await tx.update(userLocations).set({ businessVerified: false }).where(eq(userLocations.id, row.locationId));
        }
        used = args.tierCapacity;
      }

      return { active: true, tierCapacity: args.tierCapacity, used };
    });
  }

  async upsertPushSubscription(data: { userId?: number; clientId?: string; endpoint: string; p256dh: string; auth: string }): Promise<PushSubscription> {
    const [sub] = await db.insert(pushSubscriptions)
      .values({ userId: data.userId ?? null, clientId: data.clientId ?? null, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: data.userId ?? null, clientId: data.clientId ?? null, p256dh: data.p256dh, auth: data.auth },
      })
      .returning();
    return sub;
  }

  async getPushSubscription(endpoint: string): Promise<PushSubscription | null> {
    const [sub] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return sub ?? null;
  }

  async getPushSubscriptionsByUser(userId: number): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getPushSubscriptionsByClient(clientId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.clientId, clientId));
  }

  async updatePushSubscriptionSentAt(endpoint: string): Promise<void> {
    await db.update(pushSubscriptions).set({ lastSentAt: new Date() }).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }

  async getEvents(): Promise<Event[]> {
    return db.select().from(events).where(eq(events.isActive, true)).orderBy(desc(events.eventDate));
  }

  async getEventByCode(shareCode: string): Promise<Event | null> {
    const [evt] = await db.select().from(events).where(eq(events.shareCode, shareCode));
    return evt ?? null;
  }

  async getEventById(id: number): Promise<Event | null> {
    const [evt] = await db.select().from(events).where(eq(events.id, id));
    return evt ?? null;
  }

  async createEvent(data: { name: string; description?: string; eventDate: Date; endDate?: Date; locationName?: string; locationId?: string; plungeLat?: number; plungeLng?: number; accessLat?: number; accessLng?: number; contactName?: string; contactPhone?: string; contactEmail?: string; createdBy?: number; createdByUsername?: string; shareCode: string; maxAttendees?: number | null; waiverUrl?: string; paymentUrl?: string; isPrivate?: boolean; status?: string; organizerNote?: string }): Promise<Event> {
    const [evt] = await db.insert(events).values({
      name: data.name,
      description: data.description ?? null,
      eventDate: data.eventDate,
      endDate: data.endDate ?? null,
      locationName: data.locationName ?? null,
      locationId: data.locationId ?? null,
      plungeLat: data.plungeLat != null ? String(data.plungeLat) : null,
      plungeLng: data.plungeLng != null ? String(data.plungeLng) : null,
      accessLat: data.accessLat != null ? String(data.accessLat) : null,
      accessLng: data.accessLng != null ? String(data.accessLng) : null,
      contactName: data.contactName ?? null,
      contactPhone: data.contactPhone ?? null,
      contactEmail: data.contactEmail ?? null,
      createdBy: data.createdBy ?? null,
      createdByUsername: data.createdByUsername ?? null,
      shareCode: data.shareCode,
      isActive: true,
      isPrivate: data.isPrivate ?? false,
      status: data.status ?? "active",
      organizerNote: data.organizerNote ?? null,
      maxAttendees: data.maxAttendees ?? null,
      waiverUrl: data.waiverUrl ?? null,
      paymentUrl: data.paymentUrl ?? null,
    }).returning();
    return evt;
  }

  async updateEvent(id: number, data: { name?: string; description?: string; eventDate?: Date; endDate?: Date | null; locationName?: string; plungeLat?: number | null; plungeLng?: number | null; accessLat?: number | null; accessLng?: number | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; maxAttendees?: number | null; waiverUrl?: string | null; paymentUrl?: string | null; isPrivate?: boolean; status?: string; organizerNote?: string | null }): Promise<Event> {
    const set: Partial<typeof events.$inferInsert> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.description !== undefined) set.description = data.description || null;
    if (data.eventDate !== undefined) set.eventDate = data.eventDate;
    if ("endDate" in data) set.endDate = data.endDate ?? null;
    if (data.locationName !== undefined) set.locationName = data.locationName || null;
    if ("plungeLat" in data) set.plungeLat = data.plungeLat != null ? String(data.plungeLat) : null;
    if ("plungeLng" in data) set.plungeLng = data.plungeLng != null ? String(data.plungeLng) : null;
    if ("accessLat" in data) set.accessLat = data.accessLat != null ? String(data.accessLat) : null;
    if ("accessLng" in data) set.accessLng = data.accessLng != null ? String(data.accessLng) : null;
    if ("contactName" in data) set.contactName = data.contactName ?? null;
    if ("contactPhone" in data) set.contactPhone = data.contactPhone ?? null;
    if ("contactEmail" in data) set.contactEmail = data.contactEmail ?? null;
    if ("maxAttendees" in data) set.maxAttendees = data.maxAttendees ?? null;
    if ("waiverUrl" in data) set.waiverUrl = data.waiverUrl ?? null;
    if ("paymentUrl" in data) set.paymentUrl = data.paymentUrl ?? null;
    if ("isPrivate" in data) set.isPrivate = data.isPrivate ?? false;
    if ("status" in data) set.status = data.status ?? "active";
    if ("organizerNote" in data) set.organizerNote = data.organizerNote ?? null;
    const [evt] = await db.update(events).set(set).where(eq(events.id, id)).returning();
    return evt;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(eventBans).where(eq(eventBans.eventId, id));
    await db.delete(eventCoordinators).where(eq(eventCoordinators.eventId, id));
    await db.delete(eventParticipants).where(eq(eventParticipants.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  async deleteExpiredEvents(): Promise<number> {
    const now = new Date();
    // Expired = endDate < now, OR (endDate IS NULL AND eventDate + 7 days < now)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(events).where(
      or(
        lt(events.endDate, now),
        and(isNull(events.endDate), lt(events.eventDate, sevenDaysAgo))
      )
    ).returning({ id: events.id });
    return deleted.length;
  }

  async getEventLeaderboard(eventId: number): Promise<Array<{ username: string; userId: number; totalScore: number; plungeCount: number }>> {
    const evt = await this.getEventById(eventId);
    if (!evt) return [];
    const windowStart = new Date(evt.eventDate);
    const windowEnd = evt.endDate ? new Date(evt.endDate) : new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const participants = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
    if (participants.length === 0) return [];
    const userIds = participants.map((p) => p.userId);
    const rows = await db
      .select({
        userId: plunges.userId,
        totalScore: sql<number>`COALESCE(SUM(${plunges.score}::numeric), 0)`,
        plungeCount: sql<number>`COUNT(*)`,
      })
      .from(plunges)
      .where(
        and(
          inArray(plunges.userId, userIds),
          gte(plunges.createdAt, windowStart),
          lt(plunges.createdAt, windowEnd)
        )
      )
      .groupBy(plunges.userId);

    const scoreMap = new Map(rows.map((r) => [r.userId!, { totalScore: Number(r.totalScore), plungeCount: Number(r.plungeCount) }]));
    const result = participants.map((p) => ({
      userId: p.userId,
      username: p.username,
      totalScore: scoreMap.get(p.userId)?.totalScore ?? 0,
      plungeCount: scoreMap.get(p.userId)?.plungeCount ?? 0,
    }));
    return result.sort((a, b) => b.totalScore - a.totalScore);
  }

  async incrementLocationView(id: number): Promise<void> {
    await db.update(userLocations).set({ viewCount: sql`${userLocations.viewCount} + 1` }).where(eq(userLocations.id, id));
  }

  async getMyVerifiedListings(email: string): Promise<UserLocation[]> {
    const e = email.toLowerCase().trim();
    return await db.select().from(userLocations)
      .where(and(
        eq(userLocations.isBusiness, true),
        eq(userLocations.businessVerified, true),
        eq(userLocations.isHidden, false),
        // Owner OR co-manager (case-insensitive on both sides)
        or(
          sql`lower(${userLocations.contactEmail}) = ${e}`,
          sql`exists (select 1 from unnest(${userLocations.coManagerEmails}) as cm(em) where lower(cm.em) = ${e})`,
        ),
      ))
      .orderBy(desc(userLocations.createdAt));
  }

  async recordLocationView(data: { locationId: number; userId?: number | null; clientId?: string | null }): Promise<void> {
    await db.insert(locationViews).values({
      locationId: data.locationId,
      userId: data.userId ?? null,
      clientId: data.clientId ?? null,
    });
    await db.update(userLocations)
      .set({ viewCount: sql`${userLocations.viewCount} + 1` })
      .where(eq(userLocations.id, data.locationId));
  }

  async recordLocationClick(data: { locationId: number; kind: string; userId?: number | null; clientId?: string | null }): Promise<void> {
    await db.insert(locationClicks).values({
      locationId: data.locationId,
      kind: data.kind,
      userId: data.userId ?? null,
      clientId: data.clientId ?? null,
    });
  }

  async getLocationStats(locationId: number, days: number): Promise<{
    views: { allTime: number; window: number };
    plunges: { allTime: number; window: number; uniquePlungers: number };
    clicks: Record<string, number>;
  }> {
    const sinceDate = new Date(Date.now() - days * 86400 * 1000);
    const locKey = `community-${locationId}`;

    // viewCount on userLocations is the canonical all-time counter (existed before
    // the locationViews event log, so the log alone would undercount historical data).
    const [locRow] = await db.select({ viewCount: userLocations.viewCount }).from(userLocations).where(eq(userLocations.id, locationId));
    const viewsAllTime = Number(locRow?.viewCount ?? 0);

    const [viewWindow] = await db.select({ count: sql<number>`count(*)` }).from(locationViews)
      .where(and(eq(locationViews.locationId, locationId), gte(locationViews.createdAt, sinceDate)));

    const [plungeAllTime] = await db.select({ count: sql<number>`count(*)` }).from(plunges)
      .where(eq(plunges.locationId, locKey));
    const [plungeWindow] = await db.select({ count: sql<number>`count(*)` }).from(plunges)
      .where(and(eq(plunges.locationId, locKey), gte(plunges.createdAt, sinceDate)));

    // Unique plungers = distinct identity (userId if signed in, else clientId).
    const idRows = await db.select({ uid: plunges.userId, cid: plunges.clientId })
      .from(plunges).where(eq(plunges.locationId, locKey));
    const uniqueSet = new Set<string>();
    idRows.forEach((r) => {
      if (r.uid) uniqueSet.add(`u:${r.uid}`);
      else if (r.cid) uniqueSet.add(`c:${r.cid}`);
    });

    const clickRows = await db.select({ kind: locationClicks.kind, c: sql<number>`count(*)` })
      .from(locationClicks)
      .where(and(eq(locationClicks.locationId, locationId), gte(locationClicks.createdAt, sinceDate)))
      .groupBy(locationClicks.kind);
    const clicks: Record<string, number> = {};
    clickRows.forEach((r) => { clicks[r.kind] = Number(r.c); });

    return {
      views: { allTime: viewsAllTime, window: Number(viewWindow?.count ?? 0) },
      plunges: { allTime: Number(plungeAllTime?.count ?? 0), window: Number(plungeWindow?.count ?? 0), uniquePlungers: uniqueSet.size },
      clicks,
    };
  }

  async getLocationTrend(locationId: number, days: number): Promise<Array<{ date: string; views: number; plunges: number; clicks: number }>> {
    const sinceDate = new Date(Date.now() - days * 86400 * 1000);
    const locKey = `community-${locationId}`;

    const viewRows = await db.select({
      day: sql<string>`to_char(date_trunc('day', ${locationViews.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    }).from(locationViews)
      .where(and(eq(locationViews.locationId, locationId), gte(locationViews.createdAt, sinceDate)))
      .groupBy(sql`date_trunc('day', ${locationViews.createdAt})`);

    const plungeRows = await db.select({
      day: sql<string>`to_char(date_trunc('day', ${plunges.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    }).from(plunges)
      .where(and(eq(plunges.locationId, locKey), gte(plunges.createdAt, sinceDate)))
      .groupBy(sql`date_trunc('day', ${plunges.createdAt})`);

    const clickRows = await db.select({
      day: sql<string>`to_char(date_trunc('day', ${locationClicks.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    }).from(locationClicks)
      .where(and(eq(locationClicks.locationId, locationId), gte(locationClicks.createdAt, sinceDate)))
      .groupBy(sql`date_trunc('day', ${locationClicks.createdAt})`);

    // Build a continuous window with zero-fill for empty days
    const map = new Map<string, { views: number; plunges: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400 * 1000);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { views: 0, plunges: 0, clicks: 0 });
    }
    viewRows.forEach((r) => { const e = map.get(r.day); if (e) e.views = Number(r.count); });
    plungeRows.forEach((r) => { const e = map.get(r.day); if (e) e.plunges = Number(r.count); });
    clickRows.forEach((r) => { const e = map.get(r.day); if (e) e.clicks = Number(r.count); });

    return Array.from(map.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLocationLeaderboard(locationId: number, limit: number): Promise<Array<{
    username: string;
    userId: number | null;
    bestScore: number;
    plungeCount: number;
    lastPlungeAt: Date;
  }>> {
    const locKey = `community-${locationId}`;
    // Group by a single identity key per plunger:
    //   - signed-in users → group by userId (so multiple devices collapse to one row)
    //   - guest plunges → group by clientId (one row per device)
    // Rows missing both userId and clientId fall into a single "anon" bucket.
    const identityKey = sql<string>`coalesce('u-' || ${plunges.userId}::text, 'c-' || ${plunges.clientId}, 'anon')`;
    const rows = await db.select({
      identity: identityKey,
      userId: sql<number | null>`max(${plunges.userId})`,
      clientId: sql<string | null>`max(${plunges.clientId})`,
      displayName: sql<string | null>`max(${users.displayName})`,
      email: sql<string | null>`max(${users.email})`,
      bestScore: sql<number>`max(${plunges.score})`,
      plungeCount: sql<number>`count(*)`,
      lastAt: sql<Date>`max(${plunges.createdAt})`,
    })
      .from(plunges)
      .leftJoin(users, eq(plunges.userId, users.id))
      .where(eq(plunges.locationId, locKey))
      .groupBy(identityKey)
      .orderBy(desc(sql`max(${plunges.score})`))
      .limit(limit);

    return rows.map((r) => ({
      username: r.displayName ?? r.email?.split("@")[0] ?? (r.clientId ? "Anon (device)" : "Anon"),
      userId: r.userId ?? null,
      bestScore: Number(r.bestScore),
      plungeCount: Number(r.plungeCount),
      lastPlungeAt: r.lastAt as Date,
    }));
  }

  // ── Public profile / sharing / hours / co-managers / CSV export ──────────
  async getAllVerifiedListings(): Promise<UserLocation[]> {
    return await db.select().from(userLocations)
      .where(and(
        eq(userLocations.isBusiness, true),
        eq(userLocations.businessVerified, true),
        eq(userLocations.isHidden, false),
      ))
      .orderBy(desc(userLocations.createdAt));
  }

  async getLocationBySlug(slug: string): Promise<UserLocation | null> {
    const [row] = await db.select().from(userLocations)
      .where(and(eq(userLocations.slug, slug), eq(userLocations.isHidden, false)));
    return row ?? null;
  }

  async ensureLocationSlug(id: number): Promise<string> {
    const [loc] = await db.select().from(userLocations).where(eq(userLocations.id, id));
    if (!loc) throw new Error("Location not found");
    if (loc.slug) return loc.slug;
    const base = (loc.name ?? "biz")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 48) || "biz";
    // Try base, then append short random suffixes until unique.
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        await db.update(userLocations).set({ slug: candidate }).where(eq(userLocations.id, id));
        return candidate;
      } catch (err: any) {
        if (err?.code !== "23505") throw err; // not a unique-violation → bubble up
        // collision: try again
      }
    }
    throw new Error("Could not generate unique slug");
  }

  async updateLocationHours(id: number, hours: BusinessHours | null): Promise<void> {
    await db.update(userLocations).set({ hours: hours as any }).where(eq(userLocations.id, id));
  }

  async updateLocationTimezone(id: number, timezone: string | null): Promise<void> {
    await db.update(userLocations).set({ timezone }).where(eq(userLocations.id, id));
  }

  async addCoManager(id: number, email: string): Promise<string[]> {
    const e = email.toLowerCase().trim();
    const [loc] = await db.select({ co: userLocations.coManagerEmails }).from(userLocations).where(eq(userLocations.id, id));
    const current = (loc?.co ?? []).map((s) => s.toLowerCase());
    if (current.includes(e)) return loc!.co;
    const next = [...(loc?.co ?? []), e];
    await db.update(userLocations).set({ coManagerEmails: next }).where(eq(userLocations.id, id));
    return next;
  }

  async removeCoManager(id: number, email: string): Promise<string[]> {
    const e = email.toLowerCase().trim();
    const [loc] = await db.select({ co: userLocations.coManagerEmails }).from(userLocations).where(eq(userLocations.id, id));
    const next = (loc?.co ?? []).filter((s) => s.toLowerCase() !== e);
    await db.update(userLocations).set({ coManagerEmails: next }).where(eq(userLocations.id, id));
    return next;
  }

  async exportLocationPlungersCSV(
    locationId: number,
    opts: { sortBy: "bestScore" | "plungeCount" | "periodPlunges" | "lastPlungeAt"; days: number },
  ): Promise<string> {
    const locKey = `community-${locationId}`;
    const sinceDate = new Date(Date.now() - opts.days * 86400 * 1000);
    // Privacy policy for v1:
    //   • anonymous_id is the first 8 chars of md5(userId|clientId).
    //   • The hash is unsalted on purpose so a business owner sees the SAME
    //     anonymous_id for the same plunger across repeat exports of THEIR
    //     OWN listing — that repeat-visit signal is the whole point of the
    //     leaderboard CSV.
    //   • A side-effect of using a global (unsalted) hash is that an admin
    //     who exports multiple listings can correlate plungers across them.
    //     This is acceptable for v1 because admins are trusted support staff
    //     and business owners only ever see their own listing's CSV.
    //   • Future enhancement: per-listing salted HMAC if we add multi-owner
    //     analytics that mix listings.
    const identityKey = sql<string>`coalesce('u-' || ${plunges.userId}::text, 'c-' || ${plunges.clientId}, 'anon')`;
    const rows = await db.select({
      identityHash: sql<string>`md5(coalesce('u-' || ${plunges.userId}::text, 'c-' || ${plunges.clientId}, 'anon'))`,
      isAccount: sql<boolean>`bool_or(${plunges.userId} is not null)`,
      displayName: sql<string | null>`max(${users.displayName})`,
      bestScore: sql<number>`max(${plunges.score})`,
      lifetimePlunges: sql<number>`count(*)`,
      periodPlunges: sql<number>`sum(case when ${plunges.createdAt} >= ${sinceDate} then 1 else 0 end)`,
      avgDuration: sql<number>`coalesce(avg(${plunges.duration}), 0)`,
      coldestTemp: sql<number | null>`min(${plunges.temperature})`,
      firstPlungeAt: sql<Date>`min(${plunges.createdAt})`,
      lastPlungeAt: sql<Date>`max(${plunges.createdAt})`,
    })
      .from(plunges)
      .leftJoin(users, eq(plunges.userId, users.id))
      .where(eq(plunges.locationId, locKey))
      .groupBy(identityKey);

    // Sort in JS so we can support all four options without SQL gymnastics.
    const sortField = opts.sortBy;
    const sorted = [...rows].sort((a, b) => {
      const va = sortField === "lastPlungeAt"
        ? new Date(a.lastPlungeAt as Date).getTime()
        : Number((a as any)[sortField] ?? 0);
      const vb = sortField === "lastPlungeAt"
        ? new Date(b.lastPlungeAt as Date).getTime()
        : Number((b as any)[sortField] ?? 0);
      return vb - va;
    });

    const header = [
      "plunger_display_name",
      "account_type",
      "anonymous_id",
      "lifetime_plunges",
      `plunges_last_${opts.days}d`,
      "best_cold_score",
      "avg_duration_seconds",
      "coldest_temp_c",
      "first_plunge_at",
      "last_plunge_at",
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of sorted) {
      // Privacy: never include raw email, userId, or clientId. Display name is
      // the user's chosen public handle (already shown on leaderboards).
      // Anonymous plungers without a display name show as "Anon" + short hash.
      const shortId = r.identityHash.slice(0, 8);
      const display = r.displayName ?? (r.isAccount ? `Anon (#${shortId})` : `Anon device (#${shortId})`);
      lines.push([
        escape(display),
        escape(r.isAccount ? "account" : "anonymous_device"),
        escape(shortId),
        escape(r.lifetimePlunges),
        escape(r.periodPlunges),
        escape(Number(r.bestScore).toFixed(2)),
        escape(Number(r.avgDuration).toFixed(0)),
        escape(r.coldestTemp == null ? "" : Number(r.coldestTemp).toFixed(1)),
        escape((r.firstPlungeAt as Date).toISOString()),
        escape((r.lastPlungeAt as Date).toISOString()),
      ].join(","));
    }
    return lines.join("\n") + "\n";
  }

  async getEventParticipants(eventId: number): Promise<EventParticipant[]> {
    return db.select().from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId))
      .orderBy(desc(eventParticipants.joinedAt));
  }

  async getEventParticipantCount(eventId: number): Promise<number> {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
    return Number(count);
  }

  async joinEvent(eventId: number, userId: number, username: string): Promise<EventParticipant> {
    const [participant] = await db.insert(eventParticipants)
      .values({ eventId, userId, username })
      .onConflictDoUpdate({ target: [eventParticipants.eventId, eventParticipants.userId], set: { username } })
      .returning();
    return participant;
  }

  async leaveEvent(eventId: number, userId: number): Promise<void> {
    await db.delete(eventParticipants).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
  }

  async getJoinedEventIds(userId: number): Promise<number[]> {
    const rows = await db.select({ eventId: eventParticipants.eventId }).from(eventParticipants)
      .where(eq(eventParticipants.userId, userId));
    return rows.map((r) => r.eventId);
  }

  async removeEventParticipant(eventId: number, userId: number): Promise<void> {
    await db.delete(eventParticipants).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
  }

  async isEventParticipant(eventId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ id: eventParticipants.id }).from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
    return !!row;
  }

  async getEventCoordinators(eventId: number): Promise<EventCoordinator[]> {
    return db.select().from(eventCoordinators)
      .where(eq(eventCoordinators.eventId, eventId))
      .orderBy(eventCoordinators.addedAt);
  }

  async addEventCoordinator(eventId: number, userId: number, username: string): Promise<EventCoordinator> {
    const [row] = await db.insert(eventCoordinators)
      .values({ eventId, userId, username })
      .onConflictDoUpdate({ target: [eventCoordinators.eventId, eventCoordinators.userId], set: { username } })
      .returning();
    return row;
  }

  async removeEventCoordinator(eventId: number, userId: number): Promise<void> {
    await db.delete(eventCoordinators).where(
      and(eq(eventCoordinators.eventId, eventId), eq(eventCoordinators.userId, userId))
    );
  }

  async isEventCoordinator(eventId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ id: eventCoordinators.id }).from(eventCoordinators)
      .where(and(eq(eventCoordinators.eventId, eventId), eq(eventCoordinators.userId, userId)));
    return !!row;
  }

  async getEventBans(eventId: number): Promise<EventBan[]> {
    return db.select().from(eventBans).where(eq(eventBans.eventId, eventId)).orderBy(desc(eventBans.bannedAt));
  }

  async banEventParticipant(eventId: number, userId: number, username: string): Promise<EventBan> {
    // Remove from participants first
    await db.delete(eventParticipants).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
    const [ban] = await db.insert(eventBans)
      .values({ eventId, userId, username })
      .onConflictDoUpdate({ target: [eventBans.eventId, eventBans.userId], set: { username } })
      .returning();
    return ban;
  }

  async unbanEventParticipant(eventId: number, userId: number): Promise<void> {
    await db.delete(eventBans).where(and(eq(eventBans.eventId, eventId), eq(eventBans.userId, userId)));
  }

  async isEventBanned(eventId: number, userId: number): Promise<boolean> {
    const [row] = await db.select({ id: eventBans.id }).from(eventBans)
      .where(and(eq(eventBans.eventId, eventId), eq(eventBans.userId, userId)));
    return !!row;
  }

  async getUserByDisplayName(displayName: string): Promise<User | null> {
    const [user] = await db.select().from(users)
      .where(sql`lower(${users.displayName}) = lower(${displayName})`)
      .orderBy(users.id);
    return user ?? null;
  }

  async getUserByEmailPrefix(prefix: string): Promise<User | null> {
    // Matches users whose email starts with prefix@ (case-insensitive)
    const [user] = await db.select().from(users)
      .where(sql`lower(split_part(${users.email}, '@', 1)) = lower(${prefix})`);
    return user ?? null;
  }

  async clearAdminDisplayNames(): Promise<void> {
    // Admin accounts should never have a display name that could shadow a real user's profile
    await db.update(users)
      .set({ displayName: null })
      .where(eq(users.email, "admin@coldstreakapp.com"));
  }

  async createSupportMessage(msg: InsertSupportMessage): Promise<SupportMessage> {
    const [row] = await db.insert(supportMessages).values(msg).returning();
    return row;
  }

  async getSupportMessages(): Promise<SupportMessage[]> {
    return db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt));
  }

  async getSupportMessageById(id: number): Promise<SupportMessage | null> {
    const [row] = await db.select().from(supportMessages).where(eq(supportMessages.id, id));
    return row ?? null;
  }

  async resolveSupportMessage(id: number): Promise<void> {
    await db.update(supportMessages).set({ status: "resolved" }).where(eq(supportMessages.id, id));
  }

  // ── UGC Reports (Apple App Review Guideline 1.2) ───────────────────────────
  async createReport(report: InsertReport): Promise<Report> {
    const [row] = await db.insert(reports).values(report).returning();
    return row;
  }

  async getReports(status?: "open" | "resolved" | "removed"): Promise<Report[]> {
    if (status) {
      return db.select().from(reports).where(eq(reports.status, status)).orderBy(desc(reports.createdAt));
    }
    return db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async setReportStatus(id: number, status: "open" | "resolved" | "removed"): Promise<void> {
    await db.update(reports).set({ status }).where(eq(reports.id, id));
  }

  // ── Client visits ──────────────────────────────────────────────────────────
  async recordClientVisit(data: {
    clientId: string; userAgent?: string; path?: string; platform?: string;
    userId?: number; timezone?: string; country?: string; ip?: string;
  }): Promise<void> {
    await db.insert(clientVisits)
      .values({
        clientId: data.clientId,
        userAgent: data.userAgent ?? null,
        lastPath: data.path ?? null,
        platform: data.platform ?? null,
        userId: data.userId ?? null,
      })
      .onConflictDoUpdate({
        target: clientVisits.clientId,
        set: {
          lastSeenAt: new Date(),
          visitCount: sql`${clientVisits.visitCount} + 1`,
          userAgent: data.userAgent ?? sql`${clientVisits.userAgent}`,
          lastPath: data.path ?? sql`${clientVisits.lastPath}`,
          platform: data.platform ?? sql`${clientVisits.platform}`,
          userId: data.userId ?? sql`${clientVisits.userId}`,
        },
      });

    // Enrich the linked user record (best effort; never throw to caller).
    if (data.userId) {
      try { await this.enrichUserGeo(data.userId, data.timezone, data.country, data.ip); }
      catch (err) { console.error("[geo] enrich failed:", (err as any)?.message ?? err); }
    }
  }

  // ── User geo enrichment ────────────────────────────────────────────────────
  // Updates user.timezone from the client-reported IANA timezone header (no
  // personal data — comparable to user-agent metadata) and user.country from
  // Cloudflare's cf-ipcountry header (already part of the request routing
  // infrastructure). We deliberately do NOT call any third-party IP-geolocation
  // service for finer-grained location, to stay within the existing privacy
  // disclosures.
  async enrichUserGeo(userId: number, timezone?: string, country?: string, _ip?: string): Promise<void> {
    if (!timezone && !country) return;
    const [u] = await db.select({
      id: users.id, timezone: users.timezone, country: users.country,
    }).from(users).where(eq(users.id, userId));
    if (!u) return;

    const patch: Partial<typeof users.$inferInsert> = {};
    if (timezone && timezone !== u.timezone) patch.timezone = timezone;
    if (country && country !== u.country) patch.country = country;
    if (Object.keys(patch).length > 0) {
      await db.update(users).set(patch).where(eq(users.id, userId));
    }
  }

  async getRecentClientVisits(limit = 100): Promise<ClientVisit[]> {
    return db.select().from(clientVisits).orderBy(desc(clientVisits.lastSeenAt)).limit(limit);
  }

  async recordShareEvent(data: { userId?: number; clientId?: string; kind: string; targetId?: string; channel?: string }): Promise<void> {
    await db.insert(shareEvents).values({
      userId: data.userId ?? null,
      clientId: data.clientId ?? null,
      kind: data.kind,
      targetId: data.targetId ?? null,
      channel: data.channel ?? null,
    });
  }

  async getShareCountsByUser() {
    const result = await db.execute(sql`
      SELECT user_id,
             COUNT(*)::int                                                     AS total,
             COUNT(*) FILTER (WHERE kind = 'plunge')::int                       AS plunge_shares,
             COUNT(*) FILTER (WHERE kind = 'profile' OR kind = 'badge_profile')::int AS profile_shares,
             COUNT(*) FILTER (WHERE kind = 'event')::int                        AS event_shares,
             MAX(created_at)                                                    AS last_at
      FROM share_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    `);
    const rows = ((result as any)?.rows ?? result ?? []) as Array<{ user_id: number; total: number; plunge_shares: number; profile_shares: number; event_shares: number; last_at: Date | null }>;
    const map = new Map<number, { total: number; byKind: Record<string, number>; lastAt: Date | null }>();
    for (const r of rows) {
      map.set(r.user_id, {
        total: Number(r.total) || 0,
        byKind: {
          plunge: Number(r.plunge_shares) || 0,
          profile: Number(r.profile_shares) || 0,
          event: Number(r.event_shares) || 0,
        },
        lastAt: r.last_at ?? null,
      });
    }
    return map;
  }

  async getRecentShares(limit = 100) {
    return db.select().from(shareEvents).orderBy(desc(shareEvents.createdAt)).limit(limit);
  }

  async getUserActivityReport() {
    const shareCounts = await this.getShareCountsByUser();
    const _uaResult = await db.execute(sql`
      WITH plunge_stats AS (
        SELECT
          user_id,
          COUNT(*)::int                                                                    AS total_plunges,
          COUNT(DISTINCT DATE(created_at))::int                                            AS unique_days,
          COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW()))::int AS plunges_this_month,
          MIN(created_at)                                                                  AS first_plunge_at,
          MAX(created_at)                                                                  AS last_plunge_at,
          MAX(score)::float                                                                AS best_score_lifetime,
          MAX(score) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW()))::float AS best_score_this_month,
          ARRAY_AGG(DISTINCT DATE(created_at) ORDER BY DATE(created_at) DESC)              AS plunge_days
        FROM plunges
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ),
      last_plunge AS (
        SELECT DISTINCT ON (user_id)
          user_id,
          temperature::float AS last_plunge_temp,
          duration::int      AS last_plunge_duration_sec,
          score::float       AS last_plunge_score
        FROM plunges
        WHERE user_id IS NOT NULL
        ORDER BY user_id, created_at DESC
      ),
      visit_stats AS (
        SELECT
          user_id,
          MAX(last_seen_at)        AS last_api_seen_at,
          SUM(visit_count)::int    AS total_api_visits,
          STRING_AGG(DISTINCT platform, ', ') AS platforms
        FROM client_visits
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      )
      SELECT
        u.id, u.email, u.username, u.display_name, u.email_verified, u.is_admin,
        u.timezone, u.country, u.region,
        u.created_at AS signed_up_at,
        (pu.email IS NOT NULL) AS is_pro,
        COALESCE(ps.total_plunges, 0)         AS total_plunges,
        COALESCE(ps.unique_days, 0)           AS unique_days,
        ps.first_plunge_at, ps.last_plunge_at,
        COALESCE(ps.plunges_this_month, 0) AS plunges_this_month,
        ps.best_score_lifetime, ps.best_score_this_month,
        ps.plunge_days,
        lp.last_plunge_temp, lp.last_plunge_duration_sec, lp.last_plunge_score,
        vs.last_api_seen_at, COALESCE(vs.total_api_visits, 0) AS total_api_visits, vs.platforms
      FROM users u
      LEFT JOIN plunge_stats ps ON ps.user_id = u.id
      LEFT JOIN last_plunge  lp ON lp.user_id = u.id
      LEFT JOIN visit_stats  vs ON vs.user_id = u.id
      LEFT JOIN pro_users    pu ON LOWER(pu.email) = LOWER(u.email)
      ORDER BY u.created_at DESC
    `);
    const rows = (((_uaResult as any)?.rows ?? _uaResult ?? []) as Array<any>);

    const dayKey = (d: Date | string) => {
      const dt = typeof d === "string" ? new Date(d) : d;
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    };
    const todayKey = dayKey(new Date());
    const yesterdayKey = dayKey(new Date(Date.now() - 86400000));

    return rows.map((r) => {
      const days: string[] = Array.isArray(r.plunge_days)
        ? r.plunge_days.map((d: any) => dayKey(d))
        : [];
      // unique + sorted desc
      const uniqDesc = Array.from(new Set(days)).sort((a, b) => (a < b ? 1 : -1));
      // current streak — must include today or yesterday to count
      let currentStreak = 0;
      if (uniqDesc[0] === todayKey || uniqDesc[0] === yesterdayKey) {
        currentStreak = 1;
        for (let i = 1; i < uniqDesc.length; i++) {
          const prev = new Date(uniqDesc[i - 1] + "T00:00:00Z").getTime();
          const cur  = new Date(uniqDesc[i]     + "T00:00:00Z").getTime();
          if (prev - cur === 86400000) currentStreak += 1; else break;
        }
      }
      // longest streak across all-time
      const uniqAsc = [...uniqDesc].reverse();
      let longestStreak = 0, run = 0, lastTs = -Infinity;
      for (const k of uniqAsc) {
        const ts = new Date(k + "T00:00:00Z").getTime();
        run = (ts - lastTs === 86400000) ? run + 1 : 1;
        if (run > longestStreak) longestStreak = run;
        lastTs = ts;
      }

      const sc = shareCounts.get(r.id);
      return {
        id: r.id,
        email: r.email,
        username: r.username ?? null,
        displayName: r.display_name ?? null,
        emailVerified: !!r.email_verified,
        isAdmin: !!r.is_admin,
        isPro: !!r.is_pro,
        signedUpAt: r.signed_up_at,
        totalPlunges: Number(r.total_plunges) || 0,
        uniqueDays: Number(r.unique_days) || 0,
        currentStreak,
        longestStreak,
        firstPlungeAt: r.first_plunge_at ?? null,
        lastPlungeAt: r.last_plunge_at ?? null,
        plungesThisMonth: Number(r.plunges_this_month) || 0,
        lastPlungeTemp: r.last_plunge_temp ?? null,
        lastPlungeDurationSec: r.last_plunge_duration_sec ?? null,
        lastPlungeScore: r.last_plunge_score ?? null,
        bestScoreThisMonth: r.best_score_this_month ?? null,
        bestScoreLifetime: r.best_score_lifetime ?? null,
        lastApiSeenAt: r.last_api_seen_at ?? null,
        totalApiVisits: Number(r.total_api_visits) || 0,
        platforms: r.platforms ?? null,
        timezone: r.timezone ?? null,
        country: r.country ?? null,
        region: r.region ?? null,
        totalShares: sc?.total ?? 0,
        sharesByKind: sc?.byKind ?? { plunge: 0, profile: 0, event: 0 },
        lastShareAt: sc?.lastAt ?? null,
      };
    });
  }

  async getClientVisitStats() {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int                                                                 AS "totalClients",
        COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '24 hours')::int    AS "newClients24h",
        COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '7 days')::int      AS "newClients7d",
        COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '30 days')::int     AS "newClients30d",
        COUNT(*) FILTER (WHERE last_seen_at  >= NOW() - INTERVAL '24 hours')::int    AS "activeClients24h",
        COUNT(*) FILTER (WHERE last_seen_at  >= NOW() - INTERVAL '7 days')::int      AS "activeClients7d"
      FROM client_visits
    `);
    const rows = (((result as any)?.rows ?? result ?? []) as Array<{
      totalClients: number; newClients24h: number; newClients7d: number; newClients30d: number;
      activeClients24h: number; activeClients7d: number;
    }>);
    const row = rows[0];
    return row ?? { totalClients: 0, newClients24h: 0, newClients7d: 0, newClients30d: 0, activeClients24h: 0, activeClients7d: 0 };
  }
}

export const storage = new DatabaseStorage();

// Streak freezes (Pro feature) — standalone helpers (not part of IStorage to keep
// the interface lean; called directly from routes.ts).
export async function getStreakFreezes(userId: number): Promise<StreakFreeze[]> {
  return await db.select().from(streakFreezes).where(eq(streakFreezes.userId, userId)).orderBy(desc(streakFreezes.freezeDate));
}
export async function createStreakFreeze(userId: number, freezeDate: string): Promise<StreakFreeze> {
  const [row] = await db.insert(streakFreezes).values({ userId, freezeDate }).returning();
  return row;
}

// Spotify accounts — per-user OAuth tokens (standalone helpers; not part of IStorage)
export async function getSpotifyAccount(userId: number): Promise<SpotifyAccount | undefined> {
  const [row] = await db.select().from(spotifyAccounts).where(eq(spotifyAccounts.userId, userId));
  return row;
}
export async function upsertSpotifyAccount(values: {
  userId: number;
  spotifyUserId: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string | null;
}): Promise<SpotifyAccount> {
  // Atomic INSERT ... ON CONFLICT (user_id) DO UPDATE — avoids race where two
  // concurrent OAuth callbacks for the same user both see "no existing row"
  // and then collide on the unique index.
  const [row] = await db.insert(spotifyAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: spotifyAccounts.userId,
      set: {
        spotifyUserId: values.spotifyUserId,
        displayName: values.displayName,
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        expiresAt: values.expiresAt,
        scope: values.scope,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}
export async function updateSpotifyTokens(userId: number, accessToken: string, expiresAt: Date, refreshToken?: string): Promise<void> {
  await db.update(spotifyAccounts)
    .set({ accessToken, expiresAt, ...(refreshToken ? { refreshToken } : {}), updatedAt: new Date() })
    .where(eq(spotifyAccounts.userId, userId));
}
export async function deleteSpotifyAccount(userId: number): Promise<void> {
  await db.delete(spotifyAccounts).where(eq(spotifyAccounts.userId, userId));
}
