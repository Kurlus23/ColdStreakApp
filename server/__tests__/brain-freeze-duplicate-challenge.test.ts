/**
 * brain-freeze-duplicate-challenge.test.ts
 *
 * Route-level integration tests for the duplicate-challenge guard added to
 * POST /api/brain-freeze/challenge/:userId.
 *
 * Covers:
 *   1. A second challenge from the same challenger to the same challengee is
 *      rejected with HTTP 409 while the first challenge is still active.
 *   2. After the rejection, GET /api/brain-freeze/challenge/pending returns
 *      exactly one pending challenge (not two).
 *   3. A new challenge CAN be sent after the existing one has expired.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { brainFreezeQuestions, brainFreezeChallenges, friendships } from "@shared/schema";
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
const CHALLENGER_EMAIL = "bf-dup-challenger@coldstreak.test";
const CHALLENGEE_EMAIL = "bf-dup-challengee@coldstreak.test";

function makeToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

let challengerDbId: number;
let challengeeDbId: number;
let challengerToken: string;
let challengeeToken: string;
let questionId: number;

// Track created rows for cleanup.
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
  challengerToken = makeToken(challengerDbId, CHALLENGER_EMAIL);
  challengeeToken = makeToken(challengeeDbId, CHALLENGEE_EMAIL);

  // Ensure the two users are friends (accepted) so the route doesn't 403.
  const existing = await storage.getFriendship(challengerDbId, challengeeDbId);
  if (existing) {
    if (existing.status !== "accepted") {
      await db
        .update(friendships)
        .set({ status: "accepted" })
        .where(eq(friendships.id, existing.id));
    }
  } else {
    await db
      .insert(friendships)
      .values({ requesterId: challengerDbId, addresseeId: challengeeDbId, status: "accepted" });
  }

  // Grab any question row to satisfy the NOT NULL questionIds column.
  const [q] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);
  if (!q) throw new Error("No brain_freeze_questions rows — run the seeder first");
  questionId = q.id;
});

afterAll(async () => {
  if (createdChallengeIds.length) {
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, createdChallengeIds));
  }
  // Remove friendship and users.
  try { await storage.removeFriend(challengerDbId, challengeeDbId); } catch { /* ok */ }
  await storage.deleteUser(challengerDbId).catch(() => {});
  await storage.deleteUser(challengeeDbId).catch(() => {});
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Insert an active (non-expired) pending challenge directly into the DB. */
async function insertActiveChallenge(): Promise<number> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  const [row] = await db
    .insert(brainFreezeChallenges)
    .values({
      challengerId: challengerDbId,
      challengeeId: challengeeDbId,
      questionIds:  [questionId],
      expiresAt,
      status:       "pending",
    })
    .returning({ id: brainFreezeChallenges.id });
  createdChallengeIds.push(row.id);
  return row.id;
}

/** Insert an already-expired challenge directly into the DB. */
async function insertExpiredChallenge(): Promise<number> {
  const expiresAt = new Date(Date.now() - 1); // 1 ms in the past
  const [row] = await db
    .insert(brainFreezeChallenges)
    .values({
      challengerId: challengerDbId,
      challengeeId: challengeeDbId,
      questionIds:  [questionId],
      expiresAt,
      status:       "pending",
    })
    .returning({ id: brainFreezeChallenges.id });
  createdChallengeIds.push(row.id);
  return row.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/brain-freeze/challenge/:userId — duplicate-challenge guard", () => {
  it("returns 409 when the challenger already has an active challenge against the same challengee", async () => {
    const firstId = await insertActiveChallenge();

    const res = await request(app)
      .post(`/api/brain-freeze/challenge/${challengeeDbId}`)
      .set("Authorization", `Bearer ${challengerToken}`)
      .expect(409);

    expect(res.body.message).toMatch(/active challenge/i);

    // Cleanup the inserted challenge.
    await db.delete(brainFreezeChallenges).where(eq(brainFreezeChallenges.id, firstId));
    createdChallengeIds.splice(createdChallengeIds.indexOf(firstId), 1);
  });

  it("after a 409 rejection, only one challenge appears in GET /api/brain-freeze/challenge/pending", async () => {
    const firstId = await insertActiveChallenge();

    // Attempt duplicate — should be rejected.
    await request(app)
      .post(`/api/brain-freeze/challenge/${challengeeDbId}`)
      .set("Authorization", `Bearer ${challengerToken}`)
      .expect(409);

    // Fetch pending challenges as the challengee.
    const res = await request(app)
      .get("/api/brain-freeze/challenge/pending")
      .set("Authorization", `Bearer ${challengeeToken}`)
      .expect(200);

    const returnedIds: number[] = res.body.challenges.map(
      (c: { challengeId: number }) => c.challengeId,
    );

    // The original challenge must appear exactly once.
    expect(returnedIds.filter(id => id === firstId)).toHaveLength(1);

    // Cleanup.
    await db.delete(brainFreezeChallenges).where(eq(brainFreezeChallenges.id, firstId));
    createdChallengeIds.splice(createdChallengeIds.indexOf(firstId), 1);
  });

  it("concurrent duplicate requests: exactly one succeeds and one is rejected with 409", async () => {
    // Fire two POST requests simultaneously — the advisory lock inside
    // createBrainFreezeChallenge ensures only one can pass the duplicate check.
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/brain-freeze/challenge/${challengeeDbId}`)
        .set("Authorization", `Bearer ${challengerToken}`),
      request(app)
        .post(`/api/brain-freeze/challenge/${challengeeDbId}`)
        .set("Authorization", `Bearer ${challengerToken}`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Identify the winner and track its challenge for cleanup.
    const winner = res1.status === 200 ? res1 : res2;
    const createdId: number = winner.body.challengeId;
    createdChallengeIds.push(createdId);

    // The pending list must show exactly one challenge from this pair.
    const pendingRes = await request(app)
      .get("/api/brain-freeze/challenge/pending")
      .set("Authorization", `Bearer ${challengeeToken}`)
      .expect(200);

    const returnedIds: number[] = pendingRes.body.challenges.map(
      (c: { challengeId: number }) => c.challengeId,
    );
    expect(returnedIds.filter(id => id === createdId)).toHaveLength(1);

    // Cleanup.
    await db.delete(brainFreezeChallenges).where(eq(brainFreezeChallenges.id, createdId));
    createdChallengeIds.splice(createdChallengeIds.indexOf(createdId), 1);
  });

  it("allows a new challenge after the previous one has expired", async () => {
    // Insert an expired challenge — the guard must NOT block a new send.
    const expiredId = await insertExpiredChallenge();

    const res = await request(app)
      .post(`/api/brain-freeze/challenge/${challengeeDbId}`)
      .set("Authorization", `Bearer ${challengerToken}`)
      .expect(200);

    expect(res.body.challengeId).toBeDefined();
    createdChallengeIds.push(res.body.challengeId);

    // Cleanup both rows.
    await db.delete(brainFreezeChallenges).where(
      inArray(brainFreezeChallenges.id, [expiredId, res.body.challengeId]),
    );
    for (const id of [expiredId, res.body.challengeId]) {
      const idx = createdChallengeIds.indexOf(id);
      if (idx !== -1) createdChallengeIds.splice(idx, 1);
    }
  });
});
