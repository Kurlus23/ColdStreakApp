import { db } from "./db";
import {
  plunges, leaderboardEntries, proUsers, promoCodes, userLocations, users, badgeProfiles, pushSubscriptions,
  type InsertPlunge, type UpdatePlunge, type Plunge,
  type InsertLeaderboardEntry, type LeaderboardEntry, type ProUser,
  type PromoCode, type UserLocation, type InsertUserLocation, type User, type BadgeProfile, type PushSubscription,
} from "@shared/schema";
import { desc, eq, sql, or, isNull, and } from "drizzle-orm";

export interface IStorage {
  // Plunges
  getPlunges(clientId?: string, userId?: number): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
  updatePlunge(id: number, patch: UpdatePlunge): Promise<Plunge>;
  deletePlunge(id: number): Promise<void>;
  claimPlunges(clientId: string, userId: number): Promise<void>;
  // Leaderboard
  getLeaderboard(locationId: string, limit?: number): Promise<LeaderboardEntry[]>;
  addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
  deleteLeaderboardEntry(id: number): Promise<void>;
  // Pro users
  getProUser(email: string): Promise<ProUser | null>;
  createProUser(email: string, stripeSessionId: string): Promise<ProUser>;
  // Promo codes
  getPromoCode(code: string): Promise<PromoCode | null>;
  redeemPromoCode(code: string): Promise<PromoCode | null>;
  // Community locations
  getUserLocations(country?: string): Promise<UserLocation[]>;
  createUserLocation(loc: InsertUserLocation): Promise<UserLocation>;
  nominateUserLocation(id: number): Promise<UserLocation | null>;
  // Auth users
  createUser(email: string, passwordHash: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
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

  upsertBadgeProfile(data: { username: string; featuredBadges: string; plungeCount: number; uniqueDays: number; coldestTemp: number | null }): Promise<void>;
  getBadgeProfile(username: string): Promise<BadgeProfile | null>;

  // Push notifications
  upsertPushSubscription(data: { userId?: number; clientId?: string; endpoint: string; p256dh: string; auth: string }): Promise<PushSubscription>;
  getPushSubscription(endpoint: string): Promise<PushSubscription | null>;
  getPushSubscriptionsByUser(userId: number): Promise<PushSubscription[]>;
  getPushSubscriptionsByClient(clientId: string): Promise<PushSubscription[]>;
  updatePushSubscriptionSentAt(endpoint: string): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
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

  async getLeaderboard(locationId: string, limit = 10): Promise<LeaderboardEntry[]> {
    return await db
      .select()
      .from(leaderboardEntries)
      .where(eq(leaderboardEntries.locationId, locationId))
      .orderBy(desc(leaderboardEntries.score))
      .limit(limit);
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

  async createProUser(email: string, stripeSessionId: string): Promise<ProUser> {
    const [user] = await db
      .insert(proUsers)
      .values({ email: email.toLowerCase(), stripeSessionId })
      .onConflictDoUpdate({ target: proUsers.email, set: { stripeSessionId, active: true } })
      .returning();
    return user;
  }

  async getPromoCode(code: string): Promise<PromoCode | null> {
    const [row] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase().trim()));
    return row ?? null;
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

  async getUserLocations(country?: string): Promise<UserLocation[]> {
    const query = db.select().from(userLocations).orderBy(desc(userLocations.nominationCount));
    if (country && country !== "All") {
      return await db.select().from(userLocations)
        .where(eq(userLocations.country, country))
        .orderBy(desc(userLocations.nominationCount));
    }
    return await query;
  }

  async createUserLocation(loc: InsertUserLocation): Promise<UserLocation> {
    const [created] = await db.insert(userLocations).values(loc).returning();
    return created;
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

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
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

  async upsertBadgeProfile(data: { username: string; featuredBadges: string; plungeCount: number; uniqueDays: number; coldestTemp: number | null }): Promise<void> {
    await db.insert(badgeProfiles)
      .values({ username: data.username, featuredBadges: data.featuredBadges, plungeCount: data.plungeCount, uniqueDays: data.uniqueDays, coldestTemp: data.coldestTemp, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: badgeProfiles.username,
        set: { featuredBadges: data.featuredBadges, plungeCount: data.plungeCount, uniqueDays: data.uniqueDays, coldestTemp: data.coldestTemp, updatedAt: new Date() },
      });
  }

  async getBadgeProfile(username: string): Promise<BadgeProfile | null> {
    const [profile] = await db.select().from(badgeProfiles).where(eq(badgeProfiles.username, username));
    return profile ?? null;
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
}

export const storage = new DatabaseStorage();
