/**
 * brain-freeze-seeder.test.ts
 *
 * Verifies that ensureSeeded() — called internally by getQuestion() — correctly
 * detects missing questions and upserts them on every cold start.
 *
 * The seeder compares the JSON's externalIds against DB matches using a
 * membership-count query (WHERE external_id IN (...)):
 *
 *   • count == questions.length  → all present, skip upsert, set _seeded = true
 *   • count <  questions.length  → missing entries, upsert all, set _seeded = true
 *
 * This covers three important scenarios:
 *   A. Normal "already seeded" cold start   → no upsert
 *   B. New questions added to JSON          → upsert fires
 *   C. Same total row count, but a question ID was replaced  → upsert fires
 *
 * All tests use a sequenced DB mock so no real database is touched.
 *
 * DB call sequence inside getQuestion(userId, false) when _seeded is false
 * and the user has no answer history (seenIds=[], lastCategory=null):
 *
 *   call 1  — ensureSeeded() membership count          → [{count: N}]
 *   call 1b — (only when upsert needed) insert chunks  — via db.insert mock
 *   call 2  — recentAnswers                            → []
 *   call 3  — lastAnswerRow (inner-join)               → []
 *   call 4  — unseen + diff-category (skipped: no lastCategory, no seenIds)
 *   call 4  — final fallback: all questions             → [GENERAL_QUESTION]
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GENERAL_QUESTION = {
  id:          1,
  externalId:  "q001",
  category:    "Human Body & Biology",
  difficulty:  "easy",
  question:    "How many bones are in the adult human body?",
  correct:     "206",
  wrong:       ["196", "216", "186"],
  explanation: "The adult skeleton has 206 bones.",
};

// ── DB mock ───────────────────────────────────────────────────────────────────

const responseQueue: any[][] = [];
const insertMock = vi.fn();

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
      values:             () => ({
        onConflictDoUpdate: () => {
          insertMock();
          return Promise.resolve([]);
        },
      }),
    })),
  },
}));

// ── Reset _seeded flag between tests ─────────────────────────────────────────
//
// The module caches _seeded across calls. We reset it by re-importing with a
// fresh module cache via vi.resetModules() before each test.

let getQuestion: typeof import("../brain-freeze").getQuestion;

beforeEach(async () => {
  vi.resetModules();
  responseQueue.length = 0;
  insertMock.mockClear();
  // Re-import so _seeded resets to false
  const mod = await import("../brain-freeze");
  getQuestion = mod.getQuestion;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ensureSeeded() — membership-count gate", () => {
  it("A. skips upsert when DB already contains all JSON questions (count >= json.length)", async () => {
    // count=99999 means every JSON externalId is present → no upsert needed
    responseQueue.push(
      [{ count: 99999 }],  // call 1: membership count — fully seeded
      [],                  // call 2: recentAnswers
      [],                  // call 3: lastAnswerRow
      [GENERAL_QUESTION],  // call 4: final fallback
    );

    const q = await getQuestion(1, false);

    expect(insertMock).not.toHaveBeenCalled();
    expect(q).not.toBeNull();
    expect(q!.id).toBe(GENERAL_QUESTION.id);
  });

  it("B. upserts when DB has fewer matching externalIds than the JSON (new questions added)", async () => {
    // count=0 means the DB has none of the JSON's externalIds → upsert required
    responseQueue.push(
      [{ count: 0 }],      // call 1: membership count — needs seeding
      [],                  // call 2: recentAnswers (post-upsert)
      [],                  // call 3: lastAnswerRow
      [GENERAL_QUESTION],  // call 4: final fallback
    );

    const q = await getQuestion(1, false);

    // insert must have been called (at least once per chunk)
    expect(insertMock).toHaveBeenCalled();
    expect(q).not.toBeNull();
  });

  it("C. upserts when DB count equals JSON length but a question ID was replaced (membership check catches it)", async () => {
    // Simulates: DB has 330 rows total but one externalId was replaced in the JSON.
    // The membership count therefore returns 329 (one is absent) even though total row count is 330.
    // A naive total-row-count check would have falsely skipped the upsert.
    responseQueue.push(
      [{ count: 5 }],      // call 1: only 5 of the JSON ids match — upsert required
      [],                  // call 2: recentAnswers
      [],                  // call 3: lastAnswerRow
      [GENERAL_QUESTION],  // call 4: final fallback
    );

    await getQuestion(1, false);

    expect(insertMock).toHaveBeenCalled();
  });

  it("D. does not upsert a second time within the same process lifetime (_seeded flag)", async () => {
    // First call seeds
    responseQueue.push(
      [{ count: 99999 }],  // call 1: already seeded
      [],                  // call 2: recentAnswers
      [],                  // call 3: lastAnswerRow
      [GENERAL_QUESTION],  // call 4: final fallback
    );
    await getQuestion(1, false);

    insertMock.mockClear();

    // Second call — _seeded is true, ensureSeeded returns immediately
    responseQueue.push(
      [],                  // call 1: recentAnswers (no seed check this time)
      [],                  // call 2: lastAnswerRow
      [GENERAL_QUESTION],  // call 3: final fallback
    );
    await getQuestion(1, false);

    // No insert should have run on the second call
    expect(insertMock).not.toHaveBeenCalled();
  });
});
