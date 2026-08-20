/**
 * Brain Freeze answers are account-owned data, so a caller may only attach
 * them to a saved plunge that belongs to that same account.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { brainFreezeQuestions, plunges } from "@shared/schema";

const suffix = `${process.pid}-${Date.now()}`;
const USER_A_EMAIL = `bf-plunge-owner-a-${suffix}@coldstreak.test`;
const USER_B_EMAIL = `bf-plunge-owner-b-${suffix}@coldstreak.test`;
const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";

let app: express.Express;
let userAId: number;
let userBId: number;
let questionId: number;
let tokenA: string;
const createdPlungeIds: number[] = [];

beforeAll(async () => {
  const server = express();
  server.use(express.json({ limit: "1mb" }));
  await registerRoutes(createServer(server), server);
  app = server;

  const userA = await storage.createUser(USER_A_EMAIL, "placeholder-hash");
  const userB = await storage.createUser(USER_B_EMAIL, "placeholder-hash");
  userAId = userA.id;
  userBId = userB.id;
  tokenA = jwt.sign({ userId: userAId, email: USER_A_EMAIL }, JWT_SECRET, { expiresIn: "1h" });

  const [question] = await db.select({ id: brainFreezeQuestions.id }).from(brainFreezeQuestions).limit(1);
  if (!question) throw new Error("No Brain Freeze questions are available for the ownership test");
  questionId = question.id;
});

afterAll(async () => {
  if (createdPlungeIds.length) {
    await db.delete(plunges).where(inArray(plunges.id, createdPlungeIds));
  }
  if (userAId) await storage.deleteUser(userAId);
  if (userBId) await storage.deleteUser(userBId);
});

async function createPlunge(userId: number | null) {
  const [plunge] = await db.insert(plunges).values({
    userId,
    duration: 90,
    temperature: 45,
    score: "100.00",
  }).returning({ id: plunges.id });
  createdPlungeIds.push(plunge.id);
  return plunge.id;
}

describe("Brain Freeze plunge ownership", () => {
  it("rejects both a legacy plunge and another user's plunge", async () => {
    const legacyPlungeId = await createPlunge(null);
    const otherUsersPlungeId = await createPlunge(userBId);

    for (const plungeId of [legacyPlungeId, otherUsersPlungeId]) {
      const answer = await request(app)
        .post("/api/brain-freeze/answer")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          questionId,
          isCorrect: true,
          responseTimeMs: 3_000,
          inPlunge: true,
          plungeId,
        });
      expect(answer.status).toBe(403);

      const link = await request(app)
        .post("/api/brain-freeze/link-plunge")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ plungeId, since: new Date().toISOString() });
      expect(link.status).toBe(403);
    }
  });
});