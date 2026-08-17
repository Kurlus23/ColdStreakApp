/**
 * brain-freeze-challenge-result.test.ts
 *
 * Route-level integration tests for the Brain Freeze challenge result screen.
 * Answers are submitted through the real POST /api/brain-freeze/answer endpoint
 * (supertest → Express → DB) so the full server-side path is exercised, including
 * logAnswer(), computePoints(), and checkAndFinalizeChallengeAnswer().
 *
 * Covers the four result-screen states from the task spec:
 *   1. Challenger finishes first  → response contains challengeStatus="waiting"
 *   2. Challengee finishes second → both get the correct result (won/lost/tie)
 *   3. Challenger finishes second → gets an immediate result (no "waiting" flash)
 *   4. Equal scores               → both sides receive challengeStatus="tie"
 *
 * All test data (users, questions, challenges, answers) is fully cleaned up in afterAll.
 */

import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import express from "express";
import { createServer } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import { db } from "../db";
import {
  users,
  brainFreezeQuestions,
  brainFreezeAnswers,
  brainFreezeChallenges,
} from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { createBrainFreezeChallenge } from "../brain-freeze";

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

// ── Test accounts ─────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const CHALLENGER_EMAIL = "bf-result-challenger@coldstreak.test";
const CHALLENGEE_EMAIL = "bf-result-challengee@coldstreak.test";

function makeToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "1h" });
}

// Resolved in beforeAll
let challengerDbId: number;
let challengeeDbId: number;
let challengerToken: string;
let challengeeToken: string;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await buildApp();

  // Upsert the two test users (reuse if a previous run left them).
  const hash = "placeholder-hash"; // not used for JWT-based auth in tests
  let c = await storage.getUserByEmail(CHALLENGER_EMAIL);
  if (!c) c = await storage.createUser(CHALLENGER_EMAIL, hash);
  let e = await storage.getUserByEmail(CHALLENGEE_EMAIL);
  if (!e) e = await storage.createUser(CHALLENGEE_EMAIL, hash);

  challengerDbId = c.id;
  challengeeDbId = e.id;
  challengerToken = makeToken(challengerDbId, CHALLENGER_EMAIL);
  challengeeToken  = makeToken(challengeeDbId, CHALLENGEE_EMAIL);
});

// ── Teardown ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Remove answers → challenges → users in dependency order.
  const challengeRows = await db
    .select({ id: brainFreezeChallenges.id })
    .from(brainFreezeChallenges)
    .where(inArray(brainFreezeChallenges.challengerId, [challengerDbId, challengeeDbId]));

  if (challengeRows.length) {
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.challengeId, challengeRows.map((r) => r.id)));
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, challengeRows.map((r) => r.id)));
  }

  // Also delete any stray answers belonging to the test users.
  await db.delete(brainFreezeAnswers).where(
    inArray(brainFreezeAnswers.userId, [challengerDbId, challengeeDbId]),
  );

  if (challengerDbId) await storage.deleteUser(challengerDbId);
  if (challengeeDbId) await storage.deleteUser(challengeeDbId);
});

// Remove only challenge+answer rows between tests (not users).
beforeEach(async () => {
  const challengeRows = await db
    .select({ id: brainFreezeChallenges.id })
    .from(brainFreezeChallenges)
    .where(inArray(brainFreezeChallenges.challengerId, [challengerDbId, challengeeDbId]));

  if (challengeRows.length) {
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.challengeId, challengeRows.map((r) => r.id)));
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, challengeRows.map((r) => r.id)));
  }
  await db.delete(brainFreezeAnswers).where(
    inArray(brainFreezeAnswers.userId, [challengerDbId, challengeeDbId]),
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Post all 10 answers for one player through the real endpoint.
 *  Returns the response body of the LAST (10th) answer — the one that may
 *  contain challengeStatus and opponentScore. */
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

/** Create a fresh challenge between the two test users.
 *  Returns { challengeId, questionIds } */
async function makeChallenge(): Promise<{ challengeId: number; questionIds: number[] }> {
  const { challenge, questions } = await createBrainFreezeChallenge(
    challengerDbId,
    challengeeDbId,
  );
  return {
    challengeId:  challenge.id,
    questionIds:  questions.map((q) => q.id),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Brain Freeze challenge result screen — end-to-end via POST /api/brain-freeze/answer", () => {

  // ── 1. Challenger finishes first → sees "waiting" ─────────────────────────
  it("challenger gets challengeStatus='waiting' when they finish all 10 and the challengee hasn't started", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Challenger submits all 10 correct answers at moderate speed.
    const last = await playAllAnswers(challengerToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 5_000,
    });

    expect(last.challengeStatus).toBe("waiting");
    expect(last.opponentScore).toBeUndefined(); // opponent hasn't played
    expect(typeof last.points).toBe("number");
    expect((last.points as number)).toBeGreaterThan(0);
  });

  // ── 2a. Challengee finishes second — challenger wins ──────────────────────
  it("challengee gets challengeStatus='lost' when their score is lower than the challenger's", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Challenger: all correct, fast (high score)
    const challengerLast = await playAllAnswers(challengerToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 1_000, // max speed → ~148 pts/q = 1480 total
    });
    expect(challengerLast.challengeStatus).toBe("waiting");

    // Challengee: all incorrect (score = 0)
    const challengeeLast = await playAllAnswers(challengeeToken, challengeId, questionIds, {
      isCorrect: false,
      responseTimeMs: 5_000,
    });

    expect(challengeeLast.challengeStatus).toBe("lost");
    expect(challengeeLast.opponentScore).toBeGreaterThan(0); // challenger's score returned
    expect(challengeeLast.ok).toBe(true);

    // Verify the DB row is finalized correctly.
    const [row] = await db
      .select()
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(row.status).toBe("complete");
    expect(row.winnerId).toBe(challengerDbId);
  });

  // ── 2b. Challengee finishes second — challengee wins ─────────────────────
  it("challengee gets challengeStatus='won' when their score is higher than the challenger's", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Challenger: correct but slow (60 pts/q at 19 s → 600 total)
    await playAllAnswers(challengerToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 19_000,
    });

    // Challengee: correct and fast (125 pts/q at 1 s → 1250 total)
    const challengeeLast = await playAllAnswers(challengeeToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 1_000,
    });

    expect(challengeeLast.challengeStatus).toBe("won");
    // opponentScore is the challenger's total — lower than the challengee's
    expect(typeof challengeeLast.opponentScore).toBe("number");
    expect((challengeeLast.opponentScore as number)).toBeGreaterThan(0);
    expect(challengeeLast.ok).toBe(true);

    const [row] = await db
      .select()
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(row.winnerId).toBe(challengeeDbId);
  });

  // ── 3. Challenger plays second → no "waiting" flash ───────────────────────
  it("challenger gets an immediate result (not 'waiting') when they play after the challengee", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Challengee finishes first (slow speed)
    const challengeeFirst = await playAllAnswers(challengeeToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 15_000, // low speed → ~112 pts/q = 1120 total
    });
    expect(challengeeFirst.challengeStatus).toBe("waiting");

    // Challenger plays second (fast speed — should win)
    const challengerLast = await playAllAnswers(challengerToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 1_000, // high speed → ~148 pts/q = 1480 total
    });

    // Must get a definitive result, NOT "waiting"
    expect(challengerLast.challengeStatus).toBe("won");
    expect(challengerLast.opponentScore).toBeGreaterThan(0); // challengee's score
    expect(challengerLast.ok).toBe(true);
  });

  // ── 4. Tie — equal scores on both sides ───────────────────────────────────
  it("both players receive challengeStatus='tie' when their scores are identical", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Challenger: 10 correct at 5000 ms → consistent score
    const challengerLast = await playAllAnswers(challengerToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 5_000,
    });
    expect(challengerLast.challengeStatus).toBe("waiting");

    // Challengee: exact same settings → same score per question
    const challengeeLast = await playAllAnswers(challengeeToken, challengeId, questionIds, {
      isCorrect: true,
      responseTimeMs: 5_000,
    });

    expect(challengeeLast.challengeStatus).toBe("tie");
    expect(challengeeLast.opponentScore).toBeGreaterThan(0);
    // opponentScore == challengee's own score (it's a tie)
    expect(challengeeLast.opponentScore).toBe(challengerLast.points as number * questionIds.length);

    // DB: winnerId must be null for a tie
    const [row] = await db
      .select()
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(row.status).toBe("complete");
    expect(row.winnerId).toBeNull();
  });

  // ── 5. challengeStatus absent before 10th answer ─────────────────────────
  it("intermediate answers (fewer than 10) do not include challengeStatus in the response", async () => {
    const { challengeId, questionIds } = await makeChallenge();

    // Submit only the first 5 answers
    for (const qId of questionIds.slice(0, 5)) {
      const res = await request(app)
        .post("/api/brain-freeze/answer")
        .set("Authorization", `Bearer ${challengerToken}`)
        .send({
          questionId:     qId,
          isCorrect:      true,
          responseTimeMs: 5_000,
          inPlunge:       false,
          challengeId,
        });
      expect(res.status).toBe(200);
      // challengeStatus must be absent until the 10th answer
      expect(res.body.challengeStatus).toBeUndefined();
    }
  });
});
