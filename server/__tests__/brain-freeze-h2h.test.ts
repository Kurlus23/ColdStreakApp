/**
 * brain-freeze-h2h.test.ts
 *
 * Verifies that the Brain Freeze head-to-head W/L/T record is attributed
 * correctly after real challenge completion (through the answer endpoint and
 * the production finalization path), that ties (winnerId = null) count for
 * both players, that null is returned when no completed challenges exist, and
 * that pending/in-progress challenges are NOT counted.
 *
 * Also exercises GET /api/brain-freeze/head-to-head/:friendId to confirm
 * auth, friendship gating, and exact JSON values.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { db } from "../db";
import {
  brainFreezeQuestions,
  brainFreezeAnswers,
  brainFreezeChallenges,
  friendships,
} from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { getBrainFreezeHeadToHead, createBrainFreezeChallenge } from "../brain-freeze";

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const USER_A_EMAIL = "bf-h2h-a@coldstreak.test";
const USER_B_EMAIL = "bf-h2h-b@coldstreak.test";
const USER_C_EMAIL = "bf-h2h-c@coldstreak.test"; // stranger — no friendship with A

// ── Shared state ──────────────────────────────────────────────────────────────

let app: express.Express;
let userAId: number;
let userBId: number;
let userCId: number;
let tokenA: string;
let tokenB: string;
let tokenC: string;
let questionId: number;
let friendshipId: number;

/** All challenge IDs created by this suite — cleaned up in afterAll. */
const createdChallengeIds: number[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Creates a fresh challenge via createBrainFreezeChallenge and registers its id
 * for teardown.  Returns { challengeId, questionIds }.
 */
async function makeChallenge(
  challengerId: number,
  challengeeId: number,
): Promise<{ challengeId: number; questionIds: number[] }> {
  const { challenge, questions } = await createBrainFreezeChallenge(
    challengerId,
    challengeeId,
  );
  createdChallengeIds.push(challenge.id);
  return { challengeId: challenge.id, questionIds: questions.map((q) => q.id) };
}

/**
 * Posts all answers for one player through the real HTTP endpoint.
 * Returns the last answer's response body (which carries challengeStatus).
 */
async function playAllAnswers(
  token: string,
  challengeId: number,
  questionIds: number[],
  opts: { isCorrect: boolean; responseTimeMs: number },
): Promise<Record<string, unknown>> {
  let lastBody: Record<string, unknown> = {};
  for (const qId of questionIds) {
    const res = await request(app)
      .post("/api/brain-freeze/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId:     qId,
        isCorrect:      opts.isCorrect,
        responseTimeMs: opts.responseTimeMs,
        inPlunge:       false,
        challengeId,
      });
    expect(res.status, `answer endpoint failed: ${JSON.stringify(res.body)}`).toBe(200);
    lastBody = res.body;
  }
  return lastBody;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const a = express();
  a.use(express.json({ limit: "1mb" }));
  const srv = createServer(a);
  await registerRoutes(srv, a);
  a.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? err.status ?? 500).json({ message: err.message ?? "error" });
  });
  app = a;

  const hash = "placeholder-hash";
  let a_ = await storage.getUserByEmail(USER_A_EMAIL);
  if (!a_) a_ = await storage.createUser(USER_A_EMAIL, hash);
  let b_ = await storage.getUserByEmail(USER_B_EMAIL);
  if (!b_) b_ = await storage.createUser(USER_B_EMAIL, hash);
  let c_ = await storage.getUserByEmail(USER_C_EMAIL);
  if (!c_) c_ = await storage.createUser(USER_C_EMAIL, hash);

  userAId = a_.id;
  userBId = b_.id;
  userCId = c_.id;

  tokenA = makeToken(userAId, USER_A_EMAIL);
  tokenB = makeToken(userBId, USER_B_EMAIL);
  tokenC = makeToken(userCId, USER_C_EMAIL);

  // Any real question row works for FK references.
  const [q] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);
  if (!q) throw new Error("No brain_freeze_questions rows — run the seeder first");
  questionId = q.id;

  // Accepted friendship between A and B (required by the route).
  const existing = await storage.getFriendship(userAId, userBId);
  if (existing) {
    friendshipId = existing.id;
    if (existing.status !== "accepted") {
      await db
        .update(friendships)
        .set({ status: "accepted" })
        .where(eq(friendships.id, existing.id));
    }
  } else {
    const [ins] = await db
      .insert(friendships)
      .values({ requesterId: userAId, addresseeId: userBId, status: "accepted" })
      .returning({ id: friendships.id });
    friendshipId = ins.id;
  }

  // Clean up any stale challenge rows between these test users from a previous
  // aborted run so each run starts with a known-empty history.
  const stale = await db
    .select({ id: brainFreezeChallenges.id })
    .from(brainFreezeChallenges)
    .where(
      and(
        inArray(brainFreezeChallenges.challengerId, [userAId, userBId]),
        inArray(brainFreezeChallenges.challengeeId, [userAId, userBId]),
      ),
    );
  if (stale.length) {
    const ids = stale.map((r) => r.id);
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.challengeId, ids));
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, ids));
  }
});

// ── Teardown ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  if (createdChallengeIds.length) {
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.challengeId, createdChallengeIds));
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, createdChallengeIds));
  }
  if (friendshipId) {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }
  if (userAId) await storage.deleteUser(userAId);
  if (userBId) await storage.deleteUser(userBId);
  if (userCId) await storage.deleteUser(userCId);
});

// ─── Unit-level tests for getBrainFreezeHeadToHead() ─────────────────────────

describe("getBrainFreezeHeadToHead() — via real challenge completion", () => {

  it("returns null before any completed challenge exists", async () => {
    const result = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(result).toBeNull();
  });

  it("returns exactly 1W 0L 0T for A and 0W 1L 0T for B after A wins", async () => {
    const { challengeId, questionIds } = await makeChallenge(userAId, userBId);

    // A: all correct, very fast  → high score (~148 pts/q)
    await playAllAnswers(tokenA, challengeId, questionIds, {
      isCorrect: true, responseTimeMs: 1_000,
    });
    // B: all incorrect, slow → very low score
    await playAllAnswers(tokenB, challengeId, questionIds, {
      isCorrect: false, responseTimeMs: 19_000,
    });

    const fromA = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(fromA).toEqual({ wins: 1, losses: 0, ties: 0 });

    const fromB = await getBrainFreezeHeadToHead(userBId, userAId);
    expect(fromB).toEqual({ wins: 0, losses: 1, ties: 0 });
  });

  it("returns exactly 0W 1L 0T for A and 1W 0L 0T for B after B wins a new challenge", async () => {
    // Capture state from the previous test: A has 1W.
    const before = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(before).toEqual({ wins: 1, losses: 0, ties: 0 });

    const { challengeId, questionIds } = await makeChallenge(userAId, userBId);

    // B plays first with a very high score
    await playAllAnswers(tokenB, challengeId, questionIds, {
      isCorrect: true, responseTimeMs: 1_000,
    });
    // A plays second with a very low score
    await playAllAnswers(tokenA, challengeId, questionIds, {
      isCorrect: false, responseTimeMs: 19_000,
    });

    const fromA = await getBrainFreezeHeadToHead(userAId, userBId);
    // Now A has 1W 1L 0T (the win from the previous test + this loss)
    expect(fromA).toEqual({ wins: 1, losses: 1, ties: 0 });

    const fromB = await getBrainFreezeHeadToHead(userBId, userAId);
    expect(fromB).toEqual({ wins: 1, losses: 1, ties: 0 });
  });

  it("returns exactly 0W 0L 1T for both players after a tied challenge (winnerId = null)", async () => {
    // Capture state: A is at 1W 1L 0T.
    const before = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(before).toEqual({ wins: 1, losses: 1, ties: 0 });

    const { challengeId, questionIds } = await makeChallenge(userAId, userBId);

    // Both play with exactly the same settings → tie.
    await playAllAnswers(tokenA, challengeId, questionIds, {
      isCorrect: true, responseTimeMs: 5_000,
    });
    await playAllAnswers(tokenB, challengeId, questionIds, {
      isCorrect: true, responseTimeMs: 5_000,
    });

    // Verify the DB finalized this as a tie (winnerId = null).
    const [row] = await db
      .select({ winnerId: brainFreezeChallenges.winnerId, status: brainFreezeChallenges.status })
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(row.status).toBe("complete");
    expect(row.winnerId).toBeNull();

    // Both players should now show 1W 1L 1T.
    const fromA = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(fromA).toEqual({ wins: 1, losses: 1, ties: 1 });

    const fromB = await getBrainFreezeHeadToHead(userBId, userAId);
    expect(fromB).toEqual({ wins: 1, losses: 1, ties: 1 });
  });

  it("does NOT count a pending challenge — record is unchanged after one is inserted", async () => {
    // Snapshot current record (1W 1L 1T from tests above).
    const before = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(before).not.toBeNull();
    const snapshot = { ...before! };

    // Insert a pending (not-yet-played) challenge.
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const [pending] = await db
      .insert(brainFreezeChallenges)
      .values({
        challengerId: userAId,
        challengeeId: userBId,
        questionIds: [questionId],
        status: "pending",
        expiresAt: future,
      })
      .returning({ id: brainFreezeChallenges.id });
    createdChallengeIds.push(pending.id);

    // Record must be exactly the same — pending row must not be counted.
    const after = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(after).toEqual(snapshot);
  });

  it("does NOT count a challenger_done (in-progress) challenge", async () => {
    const before = await getBrainFreezeHeadToHead(userAId, userBId);
    const snapshot = { ...before! };

    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const [inProgress] = await db
      .insert(brainFreezeChallenges)
      .values({
        challengerId: userAId,
        challengeeId: userBId,
        questionIds: [questionId],
        status: "challenger_done",
        challengerScore: 999,
        expiresAt: future,
      })
      .returning({ id: brainFreezeChallenges.id });
    createdChallengeIds.push(inProgress.id);

    const after = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(after).toEqual(snapshot);
  });

  it("reflects a new win immediately after a fourth challenge completes", async () => {
    // Baseline: 1W 1L 1T
    const before = await getBrainFreezeHeadToHead(userAId, userBId);
    expect(before!.wins).toBe(1);

    const { challengeId, questionIds } = await makeChallenge(userAId, userBId);

    await playAllAnswers(tokenA, challengeId, questionIds, {
      isCorrect: true, responseTimeMs: 1_000, // A wins
    });
    await playAllAnswers(tokenB, challengeId, questionIds, {
      isCorrect: false, responseTimeMs: 19_000,
    });

    const after = await getBrainFreezeHeadToHead(userAId, userBId);
    // A now has 2W 1L 1T
    expect(after).toEqual({ wins: 2, losses: 1, ties: 1 });
  });
});

// ─── Route tests for GET /api/brain-freeze/head-to-head/:friendId ─────────────

describe("GET /api/brain-freeze/head-to-head/:friendId — route integration", () => {

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(app).get(`/api/brain-freeze/head-to-head/${userBId}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-integer friendId", async () => {
    const res = await request(app)
      .get("/api/brain-freeze/head-to-head/abc")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 when friendId equals the caller's own userId", async () => {
    const res = await request(app)
      .get(`/api/brain-freeze/head-to-head/${userAId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 when the two users are not friends (C is a stranger)", async () => {
    const res = await request(app)
      .get(`/api/brain-freeze/head-to-head/${userCId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
  });

  it("returns the exact W/L/T record from A's perspective (2W 1L 1T after unit suite)", async () => {
    const res = await request(app)
      .get(`/api/brain-freeze/head-to-head/${userBId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // The unit-level tests above completed four challenges leaving A at 2W 1L 1T.
    expect(res.body.record).toEqual({ wins: 2, losses: 1, ties: 1 });
  });

  it("B's record is the exact mirror of A's record (1W 2L 1T)", async () => {
    const res = await request(app)
      .get(`/api/brain-freeze/head-to-head/${userAId}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.record).toEqual({ wins: 1, losses: 2, ties: 1 });
  });
});
