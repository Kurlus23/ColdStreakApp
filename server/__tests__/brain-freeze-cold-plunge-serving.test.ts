/**
 * brain-freeze-cold-plunge-serving.test.ts
 *
 * Confirms that cold-plunge question slots are served correctly for active
 * users who have exhausted the question bank within the last 30 days.
 *
 * Background
 * ----------
 * Previously, getQuestion() applied the same 30-day exclusion window to
 * cold-plunge questions as to general questions.  A user who had answered
 * all 65 cold-plunge questions in the last 30 days received 0 cold-plunge
 * questions because the filtered pool was empty.
 *
 * The fix removed the exclusion window entirely for the cold-plunge slot:
 * when preferColdPlunge=true the server now picks randomly from the full
 * "Cold Plunge & Ice Bath" pool, ignoring recent-answer history.
 *
 * Tests
 * -----
 * 1. When preferColdPlunge=true the returned question is always in the
 *    "Cold Plunge & Ice Bath" category — even after the user has answered
 *    every cold-plunge question in the past 30 days.
 * 2. When preferColdPlunge=false a general (non-cold-plunge) question is
 *    returned, confirming the branch is taken only at the designated slots.
 * 3. The fallback to a general question fires when there are no
 *    "Cold Plunge & Ice Bath" rows in the database (covers the edge case
 *    where seeding has not yet run or all cold-plunge rows were deleted).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  users,
  brainFreezeQuestions,
  brainFreezeAnswers,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { storage } from "../storage";
import { getQuestion } from "../brain-freeze";

// ── Test user ─────────────────────────────────────────────────────────────────

const TEST_USER_EMAIL = "bf-cold-plunge-serving@coldstreak.test";
let testUserId: number;

// Track rows created here so afterAll can clean up even on failure.
const createdAnswerIds: number[] = [];

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  let u = await storage.getUserByEmail(TEST_USER_EMAIL);
  if (!u) u = await storage.createUser(TEST_USER_EMAIL, "placeholder-hash");
  testUserId = u.id;
});

afterAll(async () => {
  if (createdAnswerIds.length) {
    await db
      .delete(brainFreezeAnswers)
      .where(inArray(brainFreezeAnswers.id, createdAnswerIds));
  }
  if (testUserId) await storage.deleteUser(testUserId);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLD_PLUNGE_CATEGORY = "Cold Plunge & Ice Bath";

/** Fetch all cold-plunge question IDs from the DB. */
async function getColdPlungeQuestionIds(): Promise<number[]> {
  const rows = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .where(eq(brainFreezeQuestions.category, COLD_PLUNGE_CATEGORY));
  return rows.map((r) => r.id);
}

/**
 * Insert answer rows marking every given question as answered within the
 * last 30 days for testUserId.  Returns the created answer IDs for cleanup.
 */
async function markQuestionsAnsweredRecently(
  questionIds: number[],
): Promise<number[]> {
  if (questionIds.length === 0) return [];
  const rows = await db
    .insert(brainFreezeAnswers)
    .values(
      questionIds.map((qid) => ({
        userId:         testUserId,
        questionId:     qid,
        isCorrect:      true,
        responseTimeMs: 3000,
        pointsEarned:   90,
        inPlunge:       true,
        // answeredAt defaults to NOW() — well within the 30-day window
      })),
    )
    .returning({ id: brainFreezeAnswers.id });
  return rows.map((r) => r.id);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getQuestion() – cold-plunge slot serving", () => {
  it("returns a Cold Plunge & Ice Bath question when preferColdPlunge=true", async () => {
    const q = await getQuestion(testUserId, true);
    expect(q).not.toBeNull();
    expect(q!.category).toBe(COLD_PLUNGE_CATEGORY);
  });

  it(
    "still returns a Cold Plunge & Ice Bath question even after the user has answered " +
      "every cold-plunge question in the last 30 days",
    async () => {
      // Simulate an active user who has exhausted the full cold-plunge bank recently.
      const cpIds = await getColdPlungeQuestionIds();
      expect(cpIds.length).toBeGreaterThan(0);

      const answerIds = await markQuestionsAnsweredRecently(cpIds);
      createdAnswerIds.push(...answerIds);

      // Cold-plunge slot must still be served — no exclusion window applies here.
      const q = await getQuestion(testUserId, true);
      expect(q).not.toBeNull();
      expect(q!.category).toBe(COLD_PLUNGE_CATEGORY);
    },
  );

  it("does NOT exclusively serve cold-plunge questions when preferColdPlunge=false", async () => {
    // Run enough trials to get at least one non-cold-plunge result.
    // (Cold-plunge questions are ~65 of ~325 total, so the chance of 20
    // consecutive cold-plunge draws at random is negligible.)
    const categories = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const q = await getQuestion(testUserId, false);
      expect(q).not.toBeNull();
      categories.add(q!.category);
    }
    // At least one question must come from outside the cold-plunge category
    const hasNonCold = [...categories].some((c) => c !== COLD_PLUNGE_CATEGORY);
    expect(hasNonCold).toBe(true);
  });
});

// The fallback to general questions when the cold-plunge pool is empty is
// tested in isolation via DB mocking in:
//   server/__tests__/brain-freeze-cold-plunge-fallback.test.ts
