/**
 * Tests for deriveNudgeForPush in server/nudge.ts.
 *
 * Covers each branch of the nudge decision tree:
 *   1. Fewer than 10 plunges → null
 *   2. Trending-up  (month-over-month composite delta > 0.05)
 *   3. Trending-down (delta < -0.05)
 *   4. Holding-steady (|delta| ≤ 0.05)
 *   5. Sweet-spot fallback (only one calendar month of data → bestBucket)
 */

import { describe, it, expect } from "vitest";
import { deriveNudgeForPush } from "./nudge";
import type { Plunge } from "@shared/schema";

// ── Fixture helpers ───────────────────────────────────────────────────────────

let _id = 1;

function makePlunge(
  overrides: Partial<Omit<Plunge, "createdAt">> & { createdAt: Date },
): Plunge {
  return {
    id: _id++,
    clientId: null,
    userId: null,
    duration: 180,
    temperature: 50,
    score: "50.00",
    hrAvg: null,
    spo2Avg: null,
    photoData: null,
    locationName: null,
    locationId: null,
    timerUsed: false,
    calories: null,
    timezone: null,
    mood: null,
    moodEnergy: null,
    moodFocus: null,
    moodPromptedAt: null,
    ...overrides,
  };
}

/** Return a Date that is `daysAgo` days before now. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Build `count` plunges all stamped on the same date with the same mood values.
 * The most-recent plunge in every fixture set is 1 day ago so daysSince < 7.
 */
function monthPlunges(
  date: Date,
  count: number,
  moodOverrides: Partial<Plunge>,
): Plunge[] {
  return Array.from({ length: count }, () =>
    makePlunge({ createdAt: date, ...moodOverrides }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deriveNudgeForPush", () => {
  it("returns null when fewer than 10 plunges exist", () => {
    const plunges = Array.from({ length: 9 }, () =>
      makePlunge({ createdAt: daysAgo(1), mood: 3 }),
    );
    expect(deriveNudgeForPush(plunges)).toBeNull();
  });

  it("returns the trending-up nudge when the composite score improved month-over-month", () => {
    // Old month: worst possible mood scores → composite = 0
    const oldMonth = monthPlunges(daysAgo(60), 5, {
      mood: 1,
      moodEnergy: 1,
      moodFocus: 1,
    });
    // Recent month (within 7 days): best possible scores → composite = 1
    const recentMonth = monthPlunges(daysAgo(1), 5, {
      mood: 5,
      moodEnergy: 3,
      moodFocus: 3,
    });

    const result = deriveNudgeForPush([...oldMonth, ...recentMonth]);
    expect(result).toEqual({
      title: "📈 Ready for a challenge",
      body: "Your check-in scores are trending up — consider dropping 2–3°F or adding 30 seconds to your next session and see how you feel.",
    });
  });

  it("returns the trending-down nudge when the composite score declined month-over-month", () => {
    // Old month: best scores → composite = 1
    const oldMonth = monthPlunges(daysAgo(60), 5, {
      mood: 5,
      moodEnergy: 3,
      moodFocus: 3,
    });
    // Recent month: worst scores → composite = 0; delta = 0 - 1 = -1 < -0.05
    const recentMonth = monthPlunges(daysAgo(1), 5, {
      mood: 1,
      moodEnergy: 1,
      moodFocus: 1,
    });

    const result = deriveNudgeForPush([...oldMonth, ...recentMonth]);
    expect(result).toEqual({
      title: "🌡️ Listen to your body",
      body: "Your recent check-in ratings have dipped a little. Try dialling back slightly — a warmer temperature or shorter duration can help you stay consistent without burning out.",
    });
  });

  it("returns the holding-steady nudge when scores are flat across two months", () => {
    // Both months: mid-range scores → same composite; delta ≈ 0
    const oldMonth = monthPlunges(daysAgo(60), 5, {
      mood: 3,
      moodEnergy: 2,
      moodFocus: 2,
    });
    const recentMonth = monthPlunges(daysAgo(1), 5, {
      mood: 3,
      moodEnergy: 2,
      moodFocus: 2,
    });

    const result = deriveNudgeForPush([...oldMonth, ...recentMonth]);
    expect(result).toEqual({
      title: "🎯 Stay the course",
      body: "Your ratings have been consistent — you're in a solid rhythm. Commit to your current temperature and duration for another few sessions before experimenting.",
    });
  });

  it("returns the sweet-spot nudge when all plunges are in a single calendar month", () => {
    // All in one month → computeMonthTrendDelta returns null (only 1 month bucket).
    // Put 5 plunges in the winning bucket: temp=49 (→ "45–50°F"), dur=179s (→ "1.5–3 min"),
    // high mood so the bucket scores well.
    const bestBucket = Array.from({ length: 5 }, () =>
      makePlunge({
        createdAt: daysAgo(1),
        temperature: 49,
        duration: 179,
        mood: 5,
        moodEnergy: 3,
        moodFocus: 3,
      }),
    );
    // 5 more plunges in a different bucket with lower mood scores (so bestBucket wins).
    const otherBucket = Array.from({ length: 5 }, () =>
      makePlunge({
        createdAt: daysAgo(3),
        temperature: 55,
        duration: 300,
        mood: 2,
        moodEnergy: 1,
        moodFocus: 1,
      }),
    );

    const result = deriveNudgeForPush([...bestBucket, ...otherBucket]);
    expect(result).toEqual({
      title: "⭐ Hit your sweet spot",
      body: "Your sweet spot so far is 45–50°F for 1.5–3 min — try to hit it in your next 3 plunges and keep the momentum going.",
    });
  });
});
