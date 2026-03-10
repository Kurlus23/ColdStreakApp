import { db } from "./db";
import { plunges, type InsertPlunge, type Plunge } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getPlunges(): Promise<Plunge[]>;
  createPlunge(plunge: InsertPlunge): Promise<Plunge>;
  deletePlunge(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getPlunges(): Promise<Plunge[]> {
    return await db.select().from(plunges).orderBy(desc(plunges.createdAt));
  }

  async createPlunge(plunge: InsertPlunge): Promise<Plunge> {
    const [newPlunge] = await db.insert(plunges).values(plunge).returning();
    return newPlunge;
  }

  async deletePlunge(id: number): Promise<void> {
    await db.delete(plunges).where(eq(plunges.id, id));
  }
}

export const storage = new DatabaseStorage();
