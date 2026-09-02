/**
 * Task 135 — +Finish button precision
 *
 * Tests the exported production utilities that power the "+Finish [emoji]"
 * button in Home.tsx:
 *
 *   getMidSegmentIdx(totalElapsed, thresholds)
 *     → the segment index currently in progress, or -1 when all done
 *
 *   getSecsToFinish(totalElapsed, thresholds, midIdx)
 *     → exact seconds needed to reach the next benefit threshold
 *
 * Home.tsx wires them together as:
 *   const midIdx = getMidSegmentIdx(totalElapsedForBenefits, benefitThresholds);
 *   const secsToFinish = allDone ? 0 : getSecsToFinish(totalElapsed, thresholds, midIdx);
 *   handleAddTime(allDone ? 60 : secsToFinish);   // 60 = +1:00 fallback
 */

import { describe, it, expect } from "vitest";
import {
  computeThresholds,
  computeBenefitFills,
  computeEarnedSegments,
  getMidSegmentIdx,
  getSecsToFinish,
  getCompositionFactorForScore,
  SEGMENTS,
} from "@/lib/benefitSegments";

// ── Reference scenario: 50 °F, default body metrics ──────────────────────────
// getTempFactor(50) = 1.0 exactly.
// Each benefit progresses independently from zero.
// Default 150 lb / 175 cm BMI is ~22.21, so its factor is ~1.01.
// Actual thresholds: [61, 121, 182, 303]
const TEMP_50F = 50;
const T = computeThresholds(TEMP_50F); // [61, 121, 182, 303]

describe("computeThresholds at 50 °F / default metrics", () => {
  it("returns 4 independent integer thresholds", () => {
    expect(T).toHaveLength(4);
    T.forEach((threshold) => expect(Number.isInteger(threshold)).toBe(true));
  });

  it("matches the four per-benefit peak durations", () => {
    expect(T).toEqual([61, 121, 182, 303]);
  });

  it("adjusts thresholds for the individual's BMI when body fat is unavailable", () => {
    const lowerBmi = computeThresholds(TEMP_50F, 120, 175);
    const higherBmi = computeThresholds(TEMP_50F, 220, 175);

    expect(lowerBmi[3]).toBeLessThan(T[3]);
    expect(higherBmi[3]).toBeGreaterThan(T[3]);
  });

  it("uses BMI rather than body fat for Benefit Bar timing", () => {
    const withoutBodyFat = computeThresholds(44, 150, 175);
    const withBodyFat = computeThresholds(44, 150, 175, 10);

    expect(withBodyFat).toEqual(withoutBodyFat);
  });

  it("uses BMI rather than body fat for scoring personalization", () => {
    const withoutBodyFat = getCompositionFactorForScore(null, 150, 175);
    const withBodyFat = getCompositionFactorForScore(10, 150, 175);

    expect(withBodyFat).toBe(withoutBodyFat);
  });

  it("fills every benefit simultaneously from the beginning", () => {
    const fills = computeBenefitFills(30, T);
    expect(fills[0]).toBeCloseTo(49.18, 2);
    expect(fills[1]).toBeCloseTo(24.79, 2);
    expect(fills[2]).toBeCloseTo(16.48, 2);
    expect(fills[3]).toBeCloseTo(9.90, 2);
  });

  it("earns benefits independently at their own thresholds", () => {
    expect(computeEarnedSegments(60, TEMP_50F)).toEqual([]);
    expect(computeEarnedSegments(121, TEMP_50F)).toEqual(["energy", "mood"]);
    expect(computeEarnedSegments(182, TEMP_50F)).toEqual(["energy", "mood", "metabolism"]);
    expect(computeEarnedSegments(303, TEMP_50F)).toEqual(["energy", "mood", "metabolism", "recovery"]);
  });
});

describe("getMidSegmentIdx", () => {
  it("returns 0 (Energy) at the very start (0 s elapsed)", () => {
    expect(getMidSegmentIdx(0, T)).toBe(0);
  });

  it("returns 0 (Energy) while inside the Energy segment", () => {
    expect(getMidSegmentIdx(30, T)).toBe(0);
    expect(getMidSegmentIdx(59, T)).toBe(0);
  });

  it("returns 1 (Mood) after the Energy peak", () => {
    expect(getMidSegmentIdx(61, T)).toBe(1);
    expect(getMidSegmentIdx(100, T)).toBe(1);
  });

  it("moves to Metabolism after Mood and Recovery after Metabolism", () => {
    expect(getMidSegmentIdx(121, T)).toBe(2);
    expect(getMidSegmentIdx(150, T)).toBe(2);
    expect(getMidSegmentIdx(182, T)).toBe(3);
  });

  it("returns -1 (all done) at and beyond the Recovery threshold", () => {
    expect(getMidSegmentIdx(303, T)).toBe(-1);
    expect(getMidSegmentIdx(600, T)).toBe(-1);
  });

  it("returns -1 at extreme values", () => {
    expect(getMidSegmentIdx(9999, T)).toBe(-1);
  });

  it("segment emoji at each midIdx matches expected", () => {
    const emojiMap: Record<number, string> = {
      0: "⚡",  // Energy
      1: "😊",  // Mood
      2: "🔥",  // Metabolism
      3: "💪",  // Recovery
    };
    for (const [idx, emoji] of Object.entries(emojiMap)) {
      expect(SEGMENTS[Number(idx)].emoji).toBe(emoji);
    }
  });

  it("button switches to Metabolism (🔥) immediately after Mood threshold", () => {
    const atMood = T[1]; // 121
    const idx = getMidSegmentIdx(atMood, T);
    expect(idx).toBe(2);
    expect(SEGMENTS[idx].emoji).toBe("🔥");
  });
});

describe("getSecsToFinish", () => {
  it("returns exact seconds to reach Energy threshold from 20 s", () => {
    const elapsed = 20;
    const midIdx = getMidSegmentIdx(elapsed, T); // 0
    expect(getSecsToFinish(elapsed, T, midIdx)).toBe(T[0] - elapsed); // 40
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[0]);
  });

  it("returns exact seconds to reach Mood threshold from 90 s", () => {
    const elapsed = 90;
    const midIdx = getMidSegmentIdx(elapsed, T); // 1
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[1]); // 120
  });

  it("returns exact seconds to reach Recovery threshold from 200 s", () => {
    const elapsed = 200;
    const midIdx = getMidSegmentIdx(elapsed, T); // 3
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[3]); // 300
  });

  it("keeps more than two minutes on the Recovery timer after 1:40 at 43 °F", () => {
    const thresholds43 = computeThresholds(43);
    const elapsed = 100;
    const recoveryRemaining = thresholds43[3] - elapsed;
    expect(thresholds43[3]).toBe(228);
    expect(recoveryRemaining).toBe(128);
    expect(recoveryRemaining).toBeGreaterThan(120);
  });

  it("is always >= 1 (never 0) for every in-segment position", () => {
    const last = T[T.length - 1];
    for (let t = 0; t < last; t++) {
      const idx = getMidSegmentIdx(t, T);
      if (idx === -1) break;
      expect(getSecsToFinish(t, T, idx)).toBeGreaterThanOrEqual(1);
    }
  });

  it("Math.max(1,...) guard never inflates the result (raw diff always >= 1)", () => {
    // midSegmentIdx guarantees totalElapsed < threshold[i], so diff >= 1 always.
    const last = T[T.length - 1];
    for (let t = 0; t < last; t++) {
      const idx = getMidSegmentIdx(t, T);
      if (idx === -1) break;
      const rawDiff = T[idx] - t;
      expect(rawDiff).toBeGreaterThanOrEqual(1);
      expect(getSecsToFinish(t, T, idx)).toBe(rawDiff);
    }
  });

  it("precision invariant: elapsed + secsToFinish === threshold for every integer second", () => {
    const last = T[T.length - 1];
    for (let t = 0; t < last; t++) {
      const idx = getMidSegmentIdx(t, T);
      if (idx === -1) break;
      expect(t + getSecsToFinish(t, T, idx)).toBe(T[idx]);
    }
  });
});

describe("+Finish click handler argument (Home.tsx wiring)", () => {
  it("passes 60 when all segments are done (allDone === true)", () => {
    // Mirrors: handleAddTime(allDone ? 60 : secsToFinish)
    const elapsed = 303; // all done
    const midIdx = getMidSegmentIdx(elapsed, T);
    const allDone = midIdx === -1;
    const secsToFinish = allDone ? 0 : getSecsToFinish(elapsed, T, midIdx);
    const handlerArg = allDone ? 60 : secsToFinish;
    expect(allDone).toBe(true);
    expect(handlerArg).toBe(60);
  });

  it("passes secsToFinish when in-progress (allDone === false)", () => {
    const todayLogged = 0;
    const sessionElapsed = 90; // Mood and Metabolism are still building
    const totalElapsed = todayLogged + sessionElapsed;
    const midIdx = getMidSegmentIdx(totalElapsed, T);
    const allDone = midIdx === -1;
    const secsToFinish = allDone ? 0 : getSecsToFinish(totalElapsed, T, midIdx);
    const handlerArg = allDone ? 60 : secsToFinish;
    expect(allDone).toBe(false);
    expect(handlerArg).toBeGreaterThanOrEqual(1);
    expect(totalElapsed + handlerArg).toBe(T[midIdx]); // lands exactly on threshold
  });

  it("todayTotalSec offset is included: prior session + current elapsed reach threshold exactly", () => {
    // User logged 60 s in an interrupted session, then resumes.
    const todayLogged = T[0]; // Energy maximized
    const sessionElapsed = 10;
    const totalElapsed = todayLogged + sessionElapsed; // 70
    const midIdx = getMidSegmentIdx(totalElapsed, T); // 1 = Mood
    expect(midIdx).toBe(1);
    const secsToFinish = getSecsToFinish(totalElapsed, T, midIdx);
    expect(totalElapsed + secsToFinish).toBe(T[1]); // 120
  });
});

describe("getSecsToFinish across temperatures", () => {
  it("35 °F — colder water gives shorter thresholds; precision still exact", () => {
    const T35 = computeThresholds(35);
    T35.forEach((t, i) => expect(t).toBeLessThan(T[i]));
    const elapsed = 10;
    const idx = getMidSegmentIdx(elapsed, T35);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(elapsed + getSecsToFinish(elapsed, T35, idx)).toBe(T35[idx]);
  });

  it("60 °F — warmer water gives longer thresholds; precision still exact", () => {
    const T60 = computeThresholds(60);
    T60.forEach((t, i) => expect(t).toBeGreaterThan(T[i]));
    const elapsed = 50;
    const idx = getMidSegmentIdx(elapsed, T60);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(elapsed + getSecsToFinish(elapsed, T60, idx)).toBe(T60[idx]);
  });
});
