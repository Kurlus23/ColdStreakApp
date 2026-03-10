import { db } from "./db";
import { plunges, type InsertPlunge, type Plunge } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getPlunges(): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
}

export class DatabaseStorage implements IStorage {
  async getPlunges(): Promise<Plunge[]> {
    return await db.select().from(plunges).orderBy(desc(plunges.createdAt));
  }

  async createPlunge(plunge: InsertPlunge): Promise<Plunge> {
    const [newPlunge] = await db.insert(plunges).values(plunge).returning();
    return newPlunge;
  }
}

export const storage = new DatabaseStorage();
