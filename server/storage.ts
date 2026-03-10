import { db } from "./db";
import {
  plunges, leaderboardEntries,
  type InsertPlunge, type UpdatePlunge, type Plunge,
  type InsertLeaderboardEntry, type LeaderboardEntry,
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getPlunges(): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
  updatePlunge(id: number, patch: UpdatePlunge): Promise<Plunge>;
  deletePlunge(id: number): Promise<void>;
  getLeaderboard(locationId: string, limit?: number): Promise<LeaderboardEntry[]>;
  addLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
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
}

export const storage = new DatabaseStorage();
