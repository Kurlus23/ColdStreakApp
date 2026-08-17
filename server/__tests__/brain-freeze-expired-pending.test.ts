/**
 * brain-freeze-expired-pending.test.ts
 *
 * Route-level integration test: confirms that GET /api/brain-freeze/challenge/pending
 * (a) never returns an expired challenge in its JSON response, and
 * (b) triggers the fire-and-forget cleanup that actually deletes the expired row
 *     from brain_freeze_challenges.
 *
 * Task reference: Confirm expired Brain Freeze challenges are deleted and never
 * shown to users (Task 249's inline-cleanup added to every pending-list fetch).
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { db } from "../db";
import {
  brainFreezeQuestions,
  brainFreezeChallenges,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { registerRoutes } from "../routes";
import { storage } from "../storage";

// ── App fixture ───────────────────────────────────────────────────────────────

let app: express.Express;

async function buildApp(): Promise<express.Express> {
  const a = express();
  a.use(express.json({ limit: "1mb" }));
  const srv = createServer(a);
  await registerRoutes(srv, a);
  a.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? err.status ?? 500).json({ message: err.message ?? "error" });
  });
  return a;
}

// ── Test users ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const CHALLENGER_EMAIL = "bf-exp-pending-challenger@coldstreak.test";
const CHALLENGEE_EMAIL = "bf-exp-pending-challengee@coldstreak.test";

function makeToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

let challengerDbId: number;
let challengeeDbId: number;
let challengeeToken: string;
let questionId: number;

// Track IDs for afterAll cleanup (guards against test failures leaving debris).
const createdChallengeIds: number[] = [];

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp();

  const hash = "placeholder-hash-not-used-in-jwt-auth";
  let c = await storage.getUserByEmail(CHALLENGER_EMAIL);
  if (!c) c = await storage.createUser(CHALLENGER_EMAIL, hash);
  let e = await storage.getUserByEmail(CHALLENGEE_EMAIL);
  if (!e) e = await storage.createUser(CHALLENGEE_EMAIL, hash);

  challengerDbId = c.id;
  challengeeDbId = e.id;
  challengeeToken = makeToken(challengeeDbId, CHALLENGEE_EMAIL);

  // Grab any question row — needed only to satisfy the NOT NULL questionIds column.
  const [q] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);
  if (!q) throw new Error("No brain_freeze_questions rows — run the seeder first");
  questionId = q.id;
});

afterAll(async () => {
  // Remove any challenge rows that survived (e.g. from a test failure).
  if (createdChallengeIds.length) {
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, createdChallengeIds));
  }
  await storage.deleteUser(challengerDbId).catch(() => {});
  await storage.deleteUser(challengeeDbId).catch(() => {});
});

// ── Helper ────────────────────────────────────────────────────────────────────

/** Insert a challenge that is already expired (expiresAt 10 s in the past). */
async function insertExpiredPendingChallenge(): Promise<number> {
  const expiredAt = new Date(Date.now() - 10_000); // 10 seconds ago
  const [row] = await db
    .insert(brainFreezeChallenges)
    .values({
      challengerId: challengerDbId,
      challengeeId: challengeeDbId,
      questionIds:  [questionId],
      expiresAt:    expiredAt,
      status:       "pending",
    })
    .returning({ id: brainFreezeChallenges.id });
  createdChallengeIds.push(row.id);
  return row.id;
}

/** Insert a valid (non-expired) pending challenge. */
async function insertActivePendingChallenge(): Promise<number> {
  const futureAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h from now
  const [row] = await db
    .insert(brainFreezeChallenges)
    .values({
      challengerId: challengerDbId,
      challengeeId: challengeeDbId,
      questionIds:  [questionId],
      expiresAt:    futureAt,
      status:       "pending",
    })
    .returning({ id: brainFreezeChallenges.id });
  createdChallengeIds.push(row.id);
  return row.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/brain-freeze/challenge/pending — expired-challenge cleanup", () => {
  it("does not return an expired pending challenge in the response", async () => {
    const expiredId = await insertExpiredPendingChallenge();

    const res = await request(app)
      .get("/api/brain-freeze/challenge/pending")
      .set("Authorization", `Bearer ${challengeeToken}`)
      .expect(200);

    const returnedIds: number[] = res.body.challenges.map((c: { challengeId: number }) => c.challengeId);
    expect(returnedIds).not.toContain(expiredId);
  });

  it("deletes the expired row from the DB after the request completes", async () => {
    const expiredId = await insertExpiredPendingChallenge();

    await request(app)
      .get("/api/brain-freeze/challenge/pending")
      .set("Authorization", `Bearer ${challengeeToken}`)
      .expect(200);

    // The cleanup is fire-and-forget inside the route handler; give the
    // Promise microtask queue a chance to flush before we query.
    await new Promise(r => setTimeout(r, 200));

    const [remaining] = await db
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, expiredId));

    expect(remaining).toBeUndefined();
  });

  it("still returns non-expired challenges while cleaning up expired ones", async () => {
    const expiredId = await insertExpiredPendingChallenge();
    const activeId  = await insertActivePendingChallenge();

    const res = await request(app)
      .get("/api/brain-freeze/challenge/pending")
      .set("Authorization", `Bearer ${challengeeToken}`)
      .expect(200);

    const returnedIds: number[] = res.body.challenges.map((c: { challengeId: number }) => c.challengeId);

    // Active challenge must appear; expired must not.
    expect(returnedIds).toContain(activeId);
    expect(returnedIds).not.toContain(expiredId);

    // Cleanup active row manually (it won't be deleted by the route).
    await db.delete(brainFreezeChallenges).where(eq(brainFreezeChallenges.id, activeId));
  });
});
