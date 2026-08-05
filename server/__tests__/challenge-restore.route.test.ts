/**
 * challenge-restore.route.test.ts
 *
 * End-to-end route integration tests for the challenge-restore feature.
 * Uses a real Express app (registerRoutes), real DB, and real JWT tokens to
 * exercise the complete POST /api/plunges → DELETE /api/plunges/:id flow.
 *
 * Verifies:
 *  1. A forged challengeResultSent=true in the POST body is silently discarded
 *     and the plunge is created with challengeResultSent=false (server-only).
 *  2. Discarding a challenge plunge (DELETE) when no result push was sent
 *     restores the pending_challenges row.
 *  3. A plunge where the result push fired (challengeResultSent=true) is NOT
 *     restored on discard.
 */

import { describe, it, expect, afterAll, beforeEach } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users, plunges, pendingChallenges } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { registerRoutes } from "../routes";
import { storage } from "../storage";

// ── App fixture ───────────────────────────────────────────────────────────────

// Build a minimal Express app (no Vite, no static files) with routes registered.
// Shared across all tests in this file; torn down after the suite.
let app: express.Express;

async function buildApp(): Promise<express.Express> {
  const a = express();
  a.use(express.json({ limit: "1mb" }));
  const srv = createServer(a);
  await registerRoutes(srv, a);
  // Generic error handler
  a.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? err.status ?? 500).json({ message: err.message ?? "error" });
  });
  return a;
}

// ── Synthetic test accounts ───────────────────────────────────────────────────

const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";

// High-range emails that will never collide with real accounts.
const CHALLENGED_EMAIL    = "test-restore-challenged@coldstreak.test";
const CHALLENGER_EMAIL    = "test-restore-challenger@coldstreak.test";
const CHALLENGED_USERNAME = "TestRestoreChallenged";
const CHALLENGER_USERNAME = "TestRestoreChallenger";

function makeToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

async function ensureTestUsers(): Promise<{ challengedId: number; challengerId: number }> {
  const hash = await bcrypt.hash("test-password-123", 1); // low cost for tests

  let challenged = await storage.getUserByEmail(CHALLENGED_EMAIL);
  if (!challenged) {
    challenged = await storage.createUser(CHALLENGED_EMAIL, hash, { username: CHALLENGED_USERNAME });
  }

  let challenger = await storage.getUserByEmail(CHALLENGER_EMAIL);
  if (!challenger) {
    challenger = await storage.createUser(CHALLENGER_EMAIL, hash, { username: CHALLENGER_USERNAME });
  }

  return { challengedId: challenged.id, challengerId: challenger.id };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

afterAll(async () => {
  const challenged = await storage.getUserByEmail(CHALLENGED_EMAIL);
  const challenger = await storage.getUserByEmail(CHALLENGER_EMAIL);
  if (challenged) {
    await db.delete(plunges).where(eq(plunges.userId, challenged.id));
    await db.delete(pendingChallenges).where(eq(pendingChallenges.toUserId, challenged.id));
    await storage.deleteUser(challenged.id);
  }
  if (challenger) await storage.deleteUser(challenger.id);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/plunges → DELETE: challenge restore", () => {
  // Clean pending challenges and any leftover test plunges before each test so
  // state from a previous test case doesn't bleed into the next one.
  beforeEach(async () => {
    const challenged = await storage.getUserByEmail(CHALLENGED_EMAIL);
    if (challenged) {
      await db.delete(pendingChallenges).where(eq(pendingChallenges.toUserId, challenged.id));
      await db.delete(plunges).where(eq(plunges.userId, challenged.id));
    }
  });

  it("discarding a challenge plunge (no push sent) restores the pending challenge", async () => {
    app = app ?? await buildApp();
    const { challengedId, challengerId } = await ensureTestUsers();

    // Seed a pending challenge from challenger → challenged
    await storage.upsertPendingChallenge(challengerId, challengedId);

    const token = makeToken(challengedId, CHALLENGED_EMAIL);

    // POST: log a challenge plunge
    const postRes = await request(app)
      .post("/api/plunges")
      .set("Authorization", `Bearer ${token}`)
      .send({
        duration:        90,
        temperature:     50,
        score:           "8.50",
        timerUsed:       false,
        challengerUserId: challengerId,
        challengerScore:  "7.00",
        // Forged field — server must ignore it
        challengeResultSent: true,
      });

    expect(postRes.status).toBe(201);
    const plungeId = postRes.body.id;
    expect(plungeId).toBeGreaterThan(0);

    // Server must have stored challengerUserId and forced challengeResultSent=false
    // (no push subscription exists for the challenger in this test environment)
    const created = await storage.getPlungeById(plungeId);
    expect(created?.challengerUserId).toBe(challengerId);
    expect(created?.challengeResultSent).toBe(false);

    // Pending challenge should have been consumed by the POST handler
    expect(await storage.getPendingChallenge(challengedId)).toBeNull();

    // DELETE: discard the plunge
    const delRes = await request(app)
      .delete(`/api/plunges/${plungeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(delRes.status).toBe(204);

    // Pending challenge must be restored
    const restored = await storage.getPendingChallenge(challengedId);
    expect(restored?.fromUserId).toBe(challengerId);
  });

  it("discarding a plunge with challengeResultSent=true does NOT restore the challenge", async () => {
    app = app ?? await buildApp();
    const { challengedId, challengerId } = await ensureTestUsers();

    // Insert a plunge directly with challengeResultSent=true
    const [plunge] = await db.insert(plunges).values({
      userId:              challengedId,
      duration:            60,
      temperature:         50,
      score:               "5.00",
      timerUsed:           false,
      challengerUserId:    challengerId,
      challengeResultSent: true,
    }).returning();

    const token = makeToken(challengedId, CHALLENGED_EMAIL);

    // DELETE: discard
    const delRes = await request(app)
      .delete(`/api/plunges/${plunge.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(delRes.status).toBe(204);

    // No restoration should have occurred
    expect(await storage.getPendingChallenge(challengedId)).toBeNull();
  });
});
