/**
 * brain-freeze-cold-plunge-fallback.test.ts
 *
 * Isolated test for the cold-plunge fallback path in getQuestion().
 *
 * When preferColdPlunge=true but the "Cold Plunge & Ice Bath" pool is
 * empty (e.g. seeder has not run, or all rows were removed), the code
 * must fall through and return a question from the general pool rather
 * than returning null and blocking the session.
 *
 * The relevant code path (server/brain-freeze.ts ~line 179):
 *
 *   if (preferColdPlunge) {
 *     const [cpQ] = await db.select()…COLD_PLUNGE_CATEGORY…limit(1);
 *     if (cpQ) return cpQ;
 *     // No cold-plunge questions seeded yet — fall through to general pool
 *   }
 *   …
 *   // ── 3. Final fallback: all questions ──────────────────────────────
 *   if (!q) {
 *     [q] = await db.select()…brainFreezeQuestions…limit(1);
 *   }
 *   return q ?? null;
 *
 * This test uses a sequenced mock of the db module so no real database
 * rows are touched and no seed data is modified.
 *
 * DB call sequence inside getQuestion(userId, true) with seenIds=[] and
 * lastCategory=null (new user, no answer history):
 *
 *   call 1 — ensureSeeded() membership count        → [{count: 99999}]  (≥ json length → skip upsert)
 *   call 2 — recentAnswers (no .limit())            → []
 *   call 3 — cold-plunge pool (preferColdPlunge)    → []   ← empty pool triggers fallback
 *   call 4 — lastAnswerRow (inner-join)             → []
 *   call 5 — final fallback: all questions          → [generalQuestion]
 */

import { vi, describe, it, expect, beforeAll } from "vitest";

// ── Fixture ───────────────────────────────────────────────────────────────────

const GENERAL_QUESTION = {
  id:          999,
  externalId:  "mock-general-q",
  category:    "Human Body & Biology",
  difficulty:  "easy",
  question:    "How many bones are in the adult human body?",
  correct:     "206",
  wrong:       ["196", "216", "186"],
  explanation: "The adult skeleton has 206 bones.",
};

// ── DB mock ───────────────────────────────────────────────────────────────────
//
// Each call to db.select() pops the next pre-programmed response from the queue.
// The returned chain is awaitable (has .then / .catch) so queries without
// .limit() still resolve; .limit() also returns the same resolved Promise.

const responseQueue: any[][] = [];

function makeChain(result: any[]): any {
  const p = Promise.resolve(result);
  const chain: any = {
    from:      () => chain,
    where:     () => chain,
    innerJoin: () => chain,
    orderBy:   () => chain,
    limit:     () => p,
    // thenable — allows `await db.select(…).from(…).where(…)` without .limit()
    then:    p.then.bind(p),
    catch:   p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => makeChain(responseQueue.shift() ?? [])),
    insert: vi.fn(() => ({
      values:              vi.fn().mockReturnThis(),
      onConflictDoUpdate:  vi.fn().mockReturnThis(),
      then:                (_: any, __: any) => Promise.resolve([]),
    })),
  },
}));

// ── Import after mock is in place ─────────────────────────────────────────────

import { getQuestion } from "../brain-freeze";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getQuestion() – fallback when cold-plunge pool is empty (DB mocked)", () => {
  it("returns a general question instead of null when preferColdPlunge=true but no Cold Plunge & Ice Bath rows exist", async () => {
    // Prime the response queue for the five sequential DB calls that
    // getQuestion(userId, true) makes for a user with no answer history.
    responseQueue.push(
      [{ count: 99999 }],    // call 1: ensureSeeded membership count — already seeded (count ≥ json length)
      [],                    // call 2: recentAnswers — none
      [],                    // call 3: cold-plunge pool — EMPTY (fallback trigger)
      [],                    // call 4: lastAnswerRow — none
      [GENERAL_QUESTION],    // call 5: final fallback — general question
    );

    const q = await getQuestion(1 /* userId */, true /* preferColdPlunge */);

    expect(q).not.toBeNull();
    expect(q!.category).not.toBe("Cold Plunge & Ice Bath");
    expect(q!.id).toBe(GENERAL_QUESTION.id);
  });

  it("returns null when preferColdPlunge=true and both the cold-plunge pool and the general pool are empty", async () => {
    responseQueue.push(
      [{ count: 99999 }],    // call 1: ensureSeeded membership count — already seeded
      [],                    // call 2: recentAnswers
      [],                    // call 3: cold-plunge pool — empty
      [],                    // call 4: lastAnswerRow
      [],                    // call 5: final fallback — also empty
    );

    const q = await getQuestion(1, true);
    expect(q).toBeNull();
  });
});
