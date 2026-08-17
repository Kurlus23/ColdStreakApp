/**
 * brain-freeze-cleanup.test.ts
 *
 * Integration tests for deleteExpiredBrainFreezeChallenges().
 * Covers two cases the reviewer identified as must-pass:
 *   1. Expired challenge with NO answers (fully unanswered)
 *   2. Expired challenge with answers from one player (partially played, status="challenger_done")
 *
 * In both cases the cleanup must delete the stale challenge rows without
 * failing due to FK constraints. The brain_freeze_answers.challenge_id FK
 * is declared SET NULL so the parent delete simply nullifies the reference.
 *
 * A batch containing both answered and unanswered stale rows is also tested
 * to ensure a single answered row doesn't block deletion of the others.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  users,
  brainFreezeQuestions,
  brainFreezeAnswers,
  brainFreezeChallenges,
} from "@shared/schema";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { storage } from "../storage";
import { deleteExpiredBrainFreezeChallenges } from "../brain-freeze";

// ── Test users ────────────────────────────────────────────────────────────────

const USER_A_EMAIL = "bf-cleanup-usera@coldstreak.test";
const USER_B_EMAIL = "bf-cleanup-userb@coldstreak.test";

let userAId: number;
let userBId: number;
let questionId: number; // a real question row for answer FK

// Track rows created in each test so afterAll can clean them up even on failure.
const createdChallengeIds: number[] = [];
const createdAnswerIds:    number[] = [];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const hash = "placeholder-not-used";

  let a = await storage.getUserByEmail(USER_A_EMAIL);
  if (!a) a = await storage.createUser(USER_A_EMAIL, hash);
  let b = await storage.getUserByEmail(USER_B_EMAIL);
  if (!b) b = await storage.createUser(USER_B_EMAIL, hash);

  userAId = a.id;
  userBId = b.id;

  // Grab any one question to satisfy the FK when inserting answers.
  const [q] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);

  if (!q) throw new Error("No brain_freeze_questions rows — run the seeder first");
  questionId = q.id;
});

// ── Teardown ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Remove any rows that survived (test failures, partial cleanup, etc.)
  if (createdAnswerIds.length) {
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.id, createdAnswerIds));
  }
  if (createdChallengeIds.length) {
    await db
      .delete(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, createdChallengeIds));
  }
  if (userAId) await storage.deleteUser(userAId);
  if (userBId) await storage.deleteUser(userBId);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Insert a challenge row that is already expired (expiresAt 1 ms in the past). */
async function insertExpiredChallenge(
  status: "pending" | "challenger_done" | "challengee_done" = "pending",
): Promise<number> {
  const expired = new Date(Date.now() - 1);
  const [row] = await db
    .insert(brainFreezeChallenges)
    .values({
      challengerId: userAId,
      challengeeId: userBId,
      questionIds:  [questionId],
      expiresAt:    expired,
      status,
    })
    .returning({ id: brainFreezeChallenges.id });
  createdChallengeIds.push(row.id);
  return row.id;
}

/** Insert one answer row associated with the given challengeId. */
async function insertAnswer(challengeId: number): Promise<number> {
  const [row] = await db
    .insert(brainFreezeAnswers)
    .values({
      userId:         userAId,
      questionId,
      isCorrect:      true,
      responseTimeMs: 3000,
      pointsEarned:   125,
      inPlunge:       false,
      challengeId,
    })
    .returning({ id: brainFreezeAnswers.id });
  createdAnswerIds.push(row.id);
  return row.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deleteExpiredBrainFreezeChallenges()", () => {
  it("deletes an expired challenge that has no answers", async () => {
    const challengeId = await insertExpiredChallenge("pending");

    const deleted = await deleteExpiredBrainFreezeChallenges();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const [remaining] = await db
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(remaining).toBeUndefined();
  });

  it("deletes an expired partially-answered challenge (status=challenger_done) and NULLs child answer's challengeId", async () => {
    const challengeId = await insertExpiredChallenge("challenger_done");
    const answerId    = await insertAnswer(challengeId);

    // Should not throw despite the FK — SET NULL handles the reference.
    const deleted = await deleteExpiredBrainFreezeChallenges();
    expect(deleted).toBeGreaterThanOrEqual(1);

    // Parent row must be gone.
    const [remainingChallenge] = await db
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, challengeId));
    expect(remainingChallenge).toBeUndefined();

    // Child answer must still exist but with challenge_id set to NULL.
    const [answer] = await db
      .select({ id: brainFreezeAnswers.id, challengeId: brainFreezeAnswers.challengeId })
      .from(brainFreezeAnswers)
      .where(eq(brainFreezeAnswers.id, answerId));
    expect(answer).toBeDefined();
    expect(answer.challengeId).toBeNull();

    // Cleanup the orphaned answer so afterAll tracker stays in sync.
    await db.delete(brainFreezeAnswers).where(eq(brainFreezeAnswers.id, answerId));
  });

  it("deletes multiple stale rows in one call including both answered and unanswered challenges", async () => {
    // 1 unanswered
    const c1 = await insertExpiredChallenge("pending");
    // 1 partially answered
    const c2 = await insertExpiredChallenge("challenger_done");
    await insertAnswer(c2);

    const deleted = await deleteExpiredBrainFreezeChallenges();
    expect(deleted).toBeGreaterThanOrEqual(2);

    const remaining = await db
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(inArray(brainFreezeChallenges.id, [c1, c2]));
    expect(remaining).toHaveLength(0);

    // Cleanup orphaned answers.
    await db
      .delete(brainFreezeAnswers)
      .where(
        and(
          eq(brainFreezeAnswers.userId, userAId),
          isNull(brainFreezeAnswers.challengeId),
        ),
      );
  });

  it("does NOT delete a complete challenge even if expiresAt is in the past", async () => {
    // Manually insert a complete+expired row.
    const expired = new Date(Date.now() - 1);
    const [row] = await db
      .insert(brainFreezeChallenges)
      .values({
        challengerId:    userAId,
        challengeeId:    userBId,
        questionIds:     [questionId],
        expiresAt:       expired,
        status:          "complete",
        challengerScore: 500,
        challengeeScore: 400,
        winnerId:        userAId,
      })
      .returning({ id: brainFreezeChallenges.id });
    createdChallengeIds.push(row.id);

    await deleteExpiredBrainFreezeChallenges();

    const [still] = await db
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(eq(brainFreezeChallenges.id, row.id));
    expect(still).toBeDefined();

    // Manual cleanup
    await db.delete(brainFreezeChallenges).where(eq(brainFreezeChallenges.id, row.id));
  });
});
