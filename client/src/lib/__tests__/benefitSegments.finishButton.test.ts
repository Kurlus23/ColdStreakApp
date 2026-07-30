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
  getMidSegmentIdx,
  getSecsToFinish,
  SEGMENTS,
} from "@/lib/benefitSegments";

// ── Reference scenario: 50 °F, default body metrics ──────────────────────────
// getTempFactor(50) = 1.0 exactly.
// getBmiFactor(150 lb, 175 cm): BMI = (150/2.205) / (1.75)^2 ≈ 22.22 → factor ≈ 1.010
// Actual thresholds (verified): [61, 182, 303, 485]
const TEMP_50F = 50;
const T = computeThresholds(TEMP_50F); // [61, 182, 303, 485]

describe("computeThresholds at 50 °F / default metrics", () => {
  it("returns 4 strictly ascending integer thresholds", () => {
    expect(T).toHaveLength(4);
    for (let i = 1; i < T.length; i++) {
      expect(T[i]).toBeGreaterThan(T[i - 1]);
    }
  });

  it("matches verified values [61, 182, 303, 485]", () => {
    expect(T).toEqual([61, 182, 303, 485]);
  });
});

describe("getMidSegmentIdx", () => {
  it("returns 0 (Energy) at the very start (0 s elapsed)", () => {
    expect(getMidSegmentIdx(0, T)).toBe(0);
  });

  it("returns 0 (Energy) while inside the Energy segment", () => {
    expect(getMidSegmentIdx(30, T)).toBe(0);
    expect(getMidSegmentIdx(60, T)).toBe(0); // 60 < 61
  });

  it("returns 1 (Mood) right after the Energy threshold", () => {
    expect(getMidSegmentIdx(61, T)).toBe(1);
    expect(getMidSegmentIdx(100, T)).toBe(1);
  });

  it("returns 2 (Metabolism) right after the Mood threshold", () => {
    expect(getMidSegmentIdx(182, T)).toBe(2);
    expect(getMidSegmentIdx(250, T)).toBe(2);
  });

  it("returns 3 (Recovery) right after the Metabolism threshold", () => {
    expect(getMidSegmentIdx(303, T)).toBe(3);
    expect(getMidSegmentIdx(400, T)).toBe(3);
  });

  it("returns -1 (all done) at and beyond the Recovery threshold", () => {
    expect(getMidSegmentIdx(485, T)).toBe(-1);
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
    const atMood = T[1]; // 182
    const idx = getMidSegmentIdx(atMood, T);
    expect(idx).toBe(2);
    expect(SEGMENTS[idx].emoji).toBe("🔥");
  });
});

describe("getSecsToFinish", () => {
  it("returns exact seconds to reach Energy threshold from 20 s", () => {
    const elapsed = 20;
    const midIdx = getMidSegmentIdx(elapsed, T); // 0
    expect(getSecsToFinish(elapsed, T, midIdx)).toBe(T[0] - elapsed); // 41
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[0]);
  });

  it("returns exact seconds to reach Mood threshold from 90 s", () => {
    const elapsed = 90;
    const midIdx = getMidSegmentIdx(elapsed, T); // 1
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[1]); // 182
  });

  it("returns exact seconds to reach Metabolism threshold from 200 s", () => {
    const elapsed = 200;
    const midIdx = getMidSegmentIdx(elapsed, T); // 2
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[2]); // 303
  });

  it("returns exact seconds to reach Recovery threshold from 400 s", () => {
    const elapsed = 400;
    const midIdx = getMidSegmentIdx(elapsed, T); // 3
    expect(elapsed + getSecsToFinish(elapsed, T, midIdx)).toBe(T[3]); // 485
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
    const elapsed = 485; // all done
    const midIdx = getMidSegmentIdx(elapsed, T);
    const allDone = midIdx === -1;
    const secsToFinish = allDone ? 0 : getSecsToFinish(elapsed, T, midIdx);
    const handlerArg = allDone ? 60 : secsToFinish;
    expect(allDone).toBe(true);
    expect(handlerArg).toBe(60);
  });

  it("passes secsToFinish when in-progress (allDone === false)", () => {
    const todayLogged = 0;
    const sessionElapsed = 90; // inside Mood segment
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
    // User logged 61 s today (Energy done), now 10 s into next session
    const todayLogged = T[0]; // 61 — Energy complete
    const sessionElapsed = 10;
    const totalElapsed = todayLogged + sessionElapsed; // 71
    const midIdx = getMidSegmentIdx(totalElapsed, T); // 1 = Mood
    expect(midIdx).toBe(1);
    const secsToFinish = getSecsToFinish(totalElapsed, T, midIdx);
    expect(totalElapsed + secsToFinish).toBe(T[1]); // 182
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
