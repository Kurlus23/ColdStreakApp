/**
 * brain-freeze-category-rotation.test.ts
 *
 * Verifies that `pickFromPool` — the pure helper used by getQuestion() —
 * never serves the same category twice in a row when the pool contains
 * questions from other categories, and that all 8 production categories
 * appear across a realistic sequence of consecutive picks.
 */

import { describe, it, expect } from "vitest";
import { pickFromPool } from "../brain-freeze";

// ── Fixture ───────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "Human Body & Biology",
  "Science & Technology",
  "History & Famous Firsts",
  "Sports & World Records",
  "Brain & Psychology",
  "Food & Geography",
  "Nature & Animals",
  "Pop Culture & Arts",
] as const;

/** Build a minimal pool: `count` questions per category. */
function makePool(questionsPerCategory = 5) {
  return ALL_CATEGORIES.flatMap((cat, ci) =>
    Array.from({ length: questionsPerCategory }, (_, qi) => ({
      id: ci * questionsPerCategory + qi + 1,
      category: cat,
    }))
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pickFromPool – category rotation", () => {
  it("returns null for an empty pool", () => {
    expect(pickFromPool([], null)).toBeNull();
    expect(pickFromPool([], "Science & Technology")).toBeNull();
  });

  it("returns a question when lastCategory is null (first question ever)", () => {
    const pool = makePool();
    const pick = pickFromPool(pool, null);
    expect(pick).not.toBeNull();
    expect(ALL_CATEGORIES).toContain(pick!.category);
  });

  it("never picks the same category as lastCategory when alternatives exist", () => {
    const pool = makePool(10);
    for (const lastCat of ALL_CATEGORIES) {
      // Run many trials to surface any probability-based slip
      for (let i = 0; i < 50; i++) {
        const pick = pickFromPool(pool, lastCat);
        expect(pick).not.toBeNull();
        expect(pick!.category).not.toBe(lastCat);
      }
    }
  });

  it("falls back to the same category when the pool contains only that category", () => {
    const pool = [
      { id: 1, category: "Science & Technology" },
      { id: 2, category: "Science & Technology" },
    ];
    for (let i = 0; i < 20; i++) {
      const pick = pickFromPool(pool, "Science & Technology");
      expect(pick).not.toBeNull();
      expect(pick!.category).toBe("Science & Technology");
    }
  });

  it("covers all 8 categories across consecutive simulated picks", () => {
    const pool = makePool(5); // 40 questions, 5 per category
    const seen = new Set<string>();
    let lastCategory: string | null = null;

    // 40 picks — enough to visit every category multiple times
    for (let i = 0; i < 40; i++) {
      const pick = pickFromPool(pool, lastCategory);
      expect(pick).not.toBeNull();
      seen.add(pick!.category);
      lastCategory = pick!.category;
    }

    // Every category should appear at least once in 40 picks
    for (const cat of ALL_CATEGORIES) {
      expect(seen.has(cat)).toBe(true);
    }
  });

  it("never produces two consecutive picks from the same category (over 200 trials)", () => {
    const pool = makePool(10); // 80 questions
    let lastCategory: string | null = null;
    let prevCategory: string | null = null;

    for (let i = 0; i < 200; i++) {
      const pick = pickFromPool(pool, lastCategory);
      expect(pick).not.toBeNull();

      if (prevCategory !== null) {
        expect(pick!.category).not.toBe(prevCategory);
      }

      prevCategory = pick!.category;
      lastCategory = pick!.category;
    }
  });

  it("works correctly with a single-question pool", () => {
    const pool = [{ id: 42, category: "Nature & Animals" }];
    // When there's only one question, it must be returned even if it matches lastCategory
    const pick = pickFromPool(pool, "Nature & Animals");
    expect(pick).not.toBeNull();
    expect(pick!.category).toBe("Nature & Animals");
  });

  it("rotates away from lastCategory even with a 2-category pool", () => {
    const pool = [
      { id: 1, category: "Science & Technology" },
      { id: 2, category: "Sports & World Records" },
      { id: 3, category: "Science & Technology" },
      { id: 4, category: "Sports & World Records" },
    ];

    for (let i = 0; i < 30; i++) {
      const first = pickFromPool(pool, null)!;
      const second = pickFromPool(pool, first.category)!;
      expect(second.category).not.toBe(first.category);
    }
  });
});
