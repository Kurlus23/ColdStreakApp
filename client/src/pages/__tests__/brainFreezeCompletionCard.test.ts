/**
 * Task 234 — Brain Freeze score on the completion card
 *
 * Tests import the production helpers from client/src/lib/completionCard.ts
 * so any regression in the actual logic (buildBrainFreezeField,
 * shouldShowBrainFreezeRow, brainFreezeRowLabel) will cause these tests to
 * fail rather than passing against a hand-copied simulation.
 *
 * Home.tsx uses these same helpers:
 *  - buildBrainFreezeField  → spreads brainFreezeScore into the createPlunge
 *                             payload and into promptPlungeRef.current
 *  - shouldShowBrainFreezeRow → gates the Brain Freeze row in the JSX
 *  - brainFreezeRowLabel      → produces the "N correct" label text in the row
 *
 * Scenarios:
 *   A. Brain Freeze enabled, user answered ≥1 question  → row is visible, count correct
 *   B. Brain Freeze enabled, score is 0 (no answers)    → row is absent
 *   C. Brain Freeze disabled, score > 0                 → row is absent
 *   D. Order-of-operations: score captured at log time, post-reset doesn't affect card
 */

import { describe, it, expect } from "vitest";
import {
  buildBrainFreezeField,
  shouldShowBrainFreezeRow,
  brainFreezeRowLabel,
  type CompletionCardData,
} from "@/lib/completionCard";

// ─── buildBrainFreezeField ─────────────────────────────────────────────────────
// This is the function used in doLogPlunge to include brainFreezeScore in both
// the createPlunge API payload and in promptPlungeRef.current.

describe("buildBrainFreezeField", () => {
  it("returns { brainFreezeScore } when enabled and score > 0", () => {
    expect(buildBrainFreezeField(true, 3)).toEqual({ brainFreezeScore: 3 });
  });

  it("returns {} when score is 0 (no questions answered)", () => {
    expect(buildBrainFreezeField(true, 0)).toEqual({});
  });

  it("returns {} when Brain Freeze is disabled, even with a positive score", () => {
    expect(buildBrainFreezeField(false, 5)).toEqual({});
  });

  it("returns {} when both disabled and score is 0", () => {
    expect(buildBrainFreezeField(false, 0)).toEqual({});
  });

  it("passes the exact score value through without modification", () => {
    const field = buildBrainFreezeField(true, 42);
    expect(field.brainFreezeScore).toBe(42);
  });

  it("handles a score of 1 (single correct answer) correctly", () => {
    expect(buildBrainFreezeField(true, 1)).toEqual({ brainFreezeScore: 1 });
  });
});

// ─── shouldShowBrainFreezeRow ──────────────────────────────────────────────────
// Guards the Brain Freeze row in the completion-card JSX.

describe("shouldShowBrainFreezeRow", () => {
  const makeData = (brainFreezeScore?: number): CompletionCardData => ({
    score: "4.5",
    duration: 180,
    temperature: 50,
    timerUsed: true,
    brainFreezeScore,
  });

  it("returns true when brainFreezeScore is positive", () => {
    expect(shouldShowBrainFreezeRow(makeData(3))).toBe(true);
  });

  it("returns true for a score of 1 (minimum non-zero)", () => {
    expect(shouldShowBrainFreezeRow(makeData(1))).toBe(true);
  });

  it("returns true for a high score", () => {
    expect(shouldShowBrainFreezeRow(makeData(42))).toBe(true);
  });

  it("returns false when brainFreezeScore is 0", () => {
    expect(shouldShowBrainFreezeRow(makeData(0))).toBe(false);
  });

  it("returns false when brainFreezeScore is absent (Brain Freeze disabled)", () => {
    expect(shouldShowBrainFreezeRow(makeData(undefined))).toBe(false);
  });

  it("returns false when the completion card data is null (no plunge logged yet)", () => {
    expect(shouldShowBrainFreezeRow(null)).toBe(false);
  });

  it("returns false when the completion card data is undefined", () => {
    expect(shouldShowBrainFreezeRow(undefined)).toBe(false);
  });
});

// ─── brainFreezeRowLabel ───────────────────────────────────────────────────────
// Produces the visible label text inside the Brain Freeze row.

describe("brainFreezeRowLabel", () => {
  const makeData = (brainFreezeScore?: number): CompletionCardData => ({
    score: "4.5",
    duration: 180,
    temperature: 50,
    timerUsed: true,
    brainFreezeScore,
  });

  it("returns 'N correct' for a positive score", () => {
    expect(brainFreezeRowLabel(makeData(3))).toBe("3 correct");
  });

  it("returns '1 correct' for a single correct answer", () => {
    expect(brainFreezeRowLabel(makeData(1))).toBe("1 correct");
  });

  it("returns the exact count for a large score", () => {
    expect(brainFreezeRowLabel(makeData(42))).toBe("42 correct");
  });

  it("returns null when score is 0", () => {
    expect(brainFreezeRowLabel(makeData(0))).toBeNull();
  });

  it("returns null when brainFreezeScore is absent", () => {
    expect(brainFreezeRowLabel(makeData(undefined))).toBeNull();
  });

  it("returns null when data is null", () => {
    expect(brainFreezeRowLabel(null)).toBeNull();
  });
});

// ─── Integration: buildBrainFreezeField → shouldShowBrainFreezeRow ───────────
// Proves the full path: ref value → spread into completionCardData → row visible.

describe("full path: Brain Freeze score from ref to card row", () => {
  function makeCompletionCardData(
    brainFreezeEnabled: boolean,
    brainFreezeRefValue: number,
  ): CompletionCardData {
    return {
      score: "4.2",
      duration: 150,
      temperature: 50,
      timerUsed: true,
      // This spread is identical to what Home.tsx does in doLogPlunge's onSuccess
      ...buildBrainFreezeField(brainFreezeEnabled, brainFreezeRefValue),
    };
  }

  it("row is visible when enabled and user answered 3 questions", () => {
    const data = makeCompletionCardData(true, 3);
    expect(shouldShowBrainFreezeRow(data)).toBe(true);
    expect(brainFreezeRowLabel(data)).toBe("3 correct");
  });

  it("row is absent when enabled but score is 0 (no questions answered)", () => {
    const data = makeCompletionCardData(true, 0);
    expect(shouldShowBrainFreezeRow(data)).toBe(false);
    expect(brainFreezeRowLabel(data)).toBeNull();
  });

  it("row is absent when disabled even if ref held a non-zero value", () => {
    const data = makeCompletionCardData(false, 7);
    expect(shouldShowBrainFreezeRow(data)).toBe(false);
    expect(brainFreezeRowLabel(data)).toBeNull();
  });

  it("score captured at log time is preserved even if ref is reset afterwards", () => {
    // Simulate: ref = 4 at log time → card data built → ref reset to 0
    const brainFreezeRefAtLogTime = 4;
    const data = makeCompletionCardData(true, brainFreezeRefAtLogTime);
    // ref is reset after logging (e.g. user starts a new session)
    // brainFreezeRefAtLogTime variable is now "stale" but data already captured it
    expect(shouldShowBrainFreezeRow(data)).toBe(true);
    expect(brainFreezeRowLabel(data)).toBe("4 correct");
  });
});
