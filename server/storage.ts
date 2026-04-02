import { db } from "./db";
import {
  plunges, leaderboardEntries, proUsers, promoCodes, userLocations, businessListings, users, badgeProfiles, pushSubscriptions,
  events, eventParticipants, eventCoordinators, eventBans, supportMessages,
  type InsertPlunge, type UpdatePlunge, type Plunge,
  type InsertLeaderboardEntry, type LeaderboardEntry, type ProUser,
  type PromoCode, type UserLocation, type InsertUserLocation, type User, type BadgeProfile, type PushSubscription,
  type BusinessListing, type Event, type EventParticipant, type EventCoordinator, type EventBan,
  type SupportMessage, type InsertSupportMessage,
} from "@shared/schema";
import { desc, eq, sql, or, isNull, and, not, lt } from "drizzle-orm";

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
  createUser(email: string, passwordHash: string): Promise<User>;
  upsertAdminAccount(email: string, passwordHash: string, opts?: { username?: string }): Promise<void>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  deleteUser(id: number): Promise<void>;
  setResetToken(email: string, token: string, expiry: Date): Promise<boolean>;
  getUserByResetToken(token: string): Promise<User | null>;
  clearResetToken(id: number): Promise<void>;
  updatePassword(id: number, passwordHash: string): Promise<void>;
  setVerifyToken(userId: number, token: string): Promise<void>;
  verifyEmailToken(token: string): Promise<User | null>;
  updateUserProfile(id: number, patch: { displayName?: string; bodyWeight?: number }): Promise<User>;
  getUserCount(): Promise<number>;

  upsertBadgeProfile(data: { username: string; featuredBadges: string; plungeCount: number; uniqueDays: number; coldestTemp: number | null; foundingPlunger?: boolean; avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void>;
  updateBadgeProfileMeta(username: string, data: { avatarUrl?: string | null; bio?: string | null; socialLinks?: string }): Promise<void>;
  getBadgeProfile(username: string): Promise<BadgeProfile | null>;
  getFoundingPlungerBatch(displayNames: string[]): Promise<Record<string, boolean>>;

  // Business listings
  createBusinessListing(data: { locationId: number; email: string; stripeSessionId?: string; stripeSubscriptionId?: string; expiresAt?: Date }): Promise<BusinessListing>;
  getBusinessListingBySubscriptionId(subscriptionId: string): Promise<BusinessListing | null>;
  markLocationBusinessVerified(locationId: number, verified: boolean): Promise<void>;
  updateBusinessListingSubscription(subscriptionId: string, expiresAt: Date): Promise<void>;
  deactivateBusinessListingBySubscriptionId(subscriptionId: string): Promise<void>;
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
  createEvent(data: { name: string; description?: string; eventDate: Date; endDate?: Date; locationName?: string; locationId?: string; plungeLat?: number; plungeLng?: number; accessLat?: number; accessLng?: number; contactName?: string; contactPhone?: string; contactEmail?: string; createdBy?: number; createdByUsername?: string; shareCode: string; maxAttendees?: number | null }): Promise<Event>;
  updateEvent(id: number, data: { name?: string; description?: string; eventDate?: Date; endDate?: Date | null; locationName?: string; plungeLat?: number | null; plungeLng?: number | null; accessLat?: number | null; accessLng?: number | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; maxAttendees?: number | null }): Promise<Event>;
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
  // User lookup for coordinator assignment
  getUserByDisplayName(displayName: string): Promise<User | null>;
  getUserByEmailPrefix(prefix: string): Promise<User | null>;
  // Support messages
  createSupportMessage(msg: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessages(): Promise<SupportMessage[]>;
  getSupportMessageById(id: number): Promise<SupportMessage | null>;
  resolveSupportMessage(id: number): Promise<void>;
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

  async createUser(email: string, passwordHash: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash })
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
      await db.update(users).set({
        isAdmin: true,
        isDisabled: false,
        passwordHash,
        ...(opts?.username ? { username: opts.username } : {}),
      }).where(eq(users.email, e));
      console.log(`[seed] Admin account confirmed: ${e}`);
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

  async updateUserProfile(id: number, patch: { displayName?: string; bodyWeight?: number }): Promise<User> {
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

  async createBusinessListing(data: { locationId: number; email: string; stripeSessionId?: string; stripeSubscriptionId?: string; expiresAt?: Date }): Promise<BusinessListing> {
    const [listing] = await db.insert(businessListings).values({
      locationId: data.locationId,
      email: data.email,
      stripeSessionId: data.stripeSessionId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      expiresAt: data.expiresAt ?? null,
      active: true,
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

  async createEvent(data: { name: string; description?: string; eventDate: Date; endDate?: Date; locationName?: string; locationId?: string; plungeLat?: number; plungeLng?: number; accessLat?: number; accessLng?: number; contactName?: string; contactPhone?: string; contactEmail?: string; createdBy?: number; createdByUsername?: string; shareCode: string; maxAttendees?: number | null }): Promise<Event> {
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
      maxAttendees: data.maxAttendees ?? null,
    }).returning();
    return evt;
  }

  async updateEvent(id: number, data: { name?: string; description?: string; eventDate?: Date; endDate?: Date | null; locationName?: string; plungeLat?: number | null; plungeLng?: number | null; accessLat?: number | null; accessLng?: number | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; maxAttendees?: number | null }): Promise<Event> {
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
      .where(sql`lower(${users.displayName}) = lower(${displayName})`);
    return user ?? null;
  }

  async getUserByEmailPrefix(prefix: string): Promise<User | null> {
    // Matches users whose email starts with prefix@ (case-insensitive)
    const [user] = await db.select().from(users)
      .where(sql`lower(split_part(${users.email}, '@', 1)) = lower(${prefix})`);
    return user ?? null;
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
}

export const storage = new DatabaseStorage();
