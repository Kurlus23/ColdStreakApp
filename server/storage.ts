import { db } from "./db";
import {
  plunges, leaderboardEntries, proUsers, userLocations,
  type InsertPlunge, type UpdatePlunge, type Plunge,
  type InsertLeaderboardEntry, type LeaderboardEntry, type ProUser,
  type UserLocation, type InsertUserLocation,
} from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  getPlunges(): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
  updatePlunge(id: number, patch: UpdatePlunge): Promise<Plunge>;
  deletePlunge(id: number): Promise<void>;
  getLeaderboard(locationId: string, limit?: number): Promise<LeaderboardEntry[]>;
  addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
  getProUser(email: string): Promise<ProUser | null>;
  createProUser(email: string, stripeSessionId: string): Promise<ProUser>;
  getUserLocations(country?: string): Promise<UserLocation[]>;
  createUserLocation(loc: InsertUserLocation): Promise<UserLocation>;
  nominateUserLocation(id: number): Promise<UserLocation | null>;
}

export class DatabaseStorage implements IStorage {
  async getPlunges(): Promise<Plunge[]> {
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

  async getLeaderboard(locationId: string, limit = 10): Promise<LeaderboardEntry[]> {
    return await db
      .select()
      .from(leaderboardEntries)
      .where(eq(leaderboardEntries.locationId, locationId))
      .orderBy(desc(leaderboardEntries.score))
      .limit(limit);
  }

  async addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const [newEntry] = await db.insert(leaderboardEntries).values({
      ...entry,
      score: String(entry.score),
    }).returning();
    return newEntry;
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
}

export const storage = new DatabaseStorage();
