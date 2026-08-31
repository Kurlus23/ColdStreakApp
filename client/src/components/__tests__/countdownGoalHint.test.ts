/**
 * Task 136 — CountdownGoalHint: goal-satisfied suppression
 *
 * Tests `computeCountdownNeededSecs`, the pure helper that drives
 * CountdownGoalHint's visibility logic:
 *
 *   - Returns 0 (hint hidden) when today's plunges already cover the goal
 *   - Returns the *residual* gap (not the full threshold) when partially covered
 *   - The returned value decomposes into the correct minutes:seconds for "Set it"
 *   - Decay model: benefits that faded since they were earned push neededSecs back up
 */

import { describe, it, expect } from "vitest";
import { computeCountdownNeededSecs } from "@/components/PlungeBenefitCoach";
import { computeThresholds } from "@/lib/benefitSegments";

// ── Reference scenario ────────────────────────────────────────────────────────
// 50 °F, default body metrics (150 lb / 175 cm, no body-fat)
// Independent thresholds: [60, 120, 120, 180]
// primaryBenefit = "mood" → full goal = 120 s
const TEMP = 50;
const T = computeThresholds(TEMP); // [60, 120, 120, 180]

// Fixed base timestamp so tests are deterministic and nowMs can be pinned to
// the exact plunge-end (0 ms elapsed ⟹ no decay artefacts from Math.ceil).
const BASE_MS = 1_700_000_000_000; // arbitrary fixed epoch

/**
 * Build a plunge that ends at BASE_MS + offsetMs.
 * createdAt is set so the plunge ends at that moment.
 */
function buildPlunge(durationSec: number, endOffsetMs = 0) {
  const endMs = BASE_MS + endOffsetMs;
  const createdAt = new Date(endMs - durationSec * 1000);
  return { duration: durationSec, createdAt, endMs };
}

// nowMs = exact moment the plunge ended → 0 ms elapsed → no decay
function nowAtEnd(p: { endMs: number }) {
  return p.endMs;
}

describe("computeCountdownNeededSecs — no plunges today", () => {
  it("returns the full mood threshold (120 s) when nothing has been logged", () => {
    const needed = computeCountdownNeededSecs("mood", TEMP, [], Date.now());
    expect(needed).toBe(T[1]); // 182
  });

  it("returns the full energy threshold (60 s) for the energy goal", () => {
    const needed = computeCountdownNeededSecs("energy", TEMP, [], Date.now());
    expect(needed).toBe(T[0]); // 61
  });
});

describe("computeCountdownNeededSecs — goal already satisfied (hint must be hidden)", () => {
  it("returns 0 when today logged exactly equals the mood threshold", () => {
    const p = buildPlunge(T[1]);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(0);
  });

  it("returns 0 when today logged exceeds the mood threshold", () => {
    // Two plunges totalling 240 s (well above 120).
    // Both plunges end at the same BASE_MS so every segmentEarnedAt = nowMs
    // (0 ms elapsed on every segment → no Math.ceil decay artefacts).
    const p1 = buildPlunge(120, 0);
    const p2 = buildPlunge(120, 0);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p1, p2], p1.endMs);
    expect(needed).toBe(0);
  });

  it("returns 0 for the energy goal when energy duration is covered", () => {
    const p = buildPlunge(T[0]);
    const needed = computeCountdownNeededSecs("energy", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(0);
  });

  it("returns 0 when two separate plunges together cover the goal", () => {
    // 90 s + 100 s = 190 s > 120 s mood threshold.
    // Both plunges end at the same BASE_MS so every segmentEarnedAt = nowMs
    // (0 ms elapsed → no Math.ceil decay artefacts).
    const p1 = buildPlunge(90, 0);
    const p2 = buildPlunge(100, 0);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p1, p2], p1.endMs);
    expect(needed).toBe(0);
  });
});

describe("computeCountdownNeededSecs — partial coverage (hint shows residual)", () => {
  it("returns the selected goal's residual gap", () => {
    const p = buildPlunge(100);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(20);
    expect(needed).toBeLessThan(T[1]); // strictly less than full threshold
  });

  it("residual decreases as more time is logged", () => {
    const p80 = buildPlunge(80);
    const p120 = buildPlunge(120);
    const needed80 = computeCountdownNeededSecs("mood", TEMP, [p80], nowAtEnd(p80));
    const needed120 = computeCountdownNeededSecs("mood", TEMP, [p120], nowAtEnd(p120));
    expect(needed120).toBeLessThan(needed80);
  });

  it("partial exposure advances mood immediately", () => {
    const p = buildPlunge(30);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(90);
    expect(needed).toBeGreaterThan(0);
    expect(needed).toBeLessThan(T[1]); // residual, not the full 182
  });
});

describe("computeCountdownNeededSecs — 'Set it' decomposition", () => {
  it("the 20-second residual decomposes correctly", () => {
    const p = buildPlunge(100);
    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(20);
    const recMins = Math.floor(needed / 60);
    const recSecs = needed % 60;
    expect(recMins).toBe(0);
    expect(recSecs).toBe(20);
  });

  it("full 120-second goal decomposes to 2 minutes", () => {
    const needed = computeCountdownNeededSecs("mood", TEMP, [], Date.now());
    expect(needed).toBe(120);
    expect(Math.floor(needed / 60)).toBe(2);
    expect(needed % 60).toBe(0);
  });

  it("applied minutes + seconds always reconstruct the exact neededSecs", () => {
    const cases = [0, 30, 60, 100, 120, 180, 200];
    for (const logged of cases) {
      const p = logged > 0 ? buildPlunge(logged) : undefined;
      const plunges = p ? [p] : [];
      const nowMs = p ? nowAtEnd(p) : Date.now();
      const needed = computeCountdownNeededSecs("mood", TEMP, plunges, nowMs);
      if (needed > 0) {
        expect(Math.floor(needed / 60) * 60 + needed % 60).toBe(needed);
      }
    }
  });
});

describe("computeCountdownNeededSecs — benefit decay", () => {
  it("neededSecs goes back up after benefits earned today begin to decay", () => {
    // Plunge fully covered the mood goal, logged at nowMs.
    // Simulate 4 hours passing (energy halfLife = 3 h → fully decayed;
    // mood halfLife = 5 h → 20 % remaining).
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const plungeCreatedAt = new Date(Date.now() - T[1] * 1000 - FOUR_HOURS_MS);
    const p = { duration: T[1], createdAt: plungeCreatedAt };
    const plungeEndMs = plungeCreatedAt.getTime() + T[1] * 1000;
    const nowMs = plungeEndMs + FOUR_HOURS_MS;

    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowMs);
    // Mood retains 20%, so 80% of its independent 120 s peak is needed.
    expect(needed).toBe(96);
    expect(needed).toBeGreaterThan(0);
  });

  it("neededSecs is 0 immediately after logging (no decay elapsed)", () => {
    const p = buildPlunge(T[1]); // covers full mood goal
    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowAtEnd(p));
    expect(needed).toBe(0);
  });

  it("partial decay: hint shows more than just the raw logged gap", () => {
    // After 2.5 h, energy halfLife (3 h) → 100*(1-2.5/3) ≈ 16.7 % remaining
    const TWO_HALF_HOURS_MS = 2.5 * 60 * 60 * 1000;
    const plungeCreatedAt = new Date(Date.now() - T[1] * 1000 - TWO_HALF_HOURS_MS);
    const p = { duration: T[1], createdAt: plungeCreatedAt };
    const plungeEndMs = plungeCreatedAt.getTime() + T[1] * 1000;
    const nowMs = plungeEndMs + TWO_HALF_HOURS_MS;

    const needed = computeCountdownNeededSecs("mood", TEMP, [p], nowMs);
    // Some decay has occurred so neededSecs > 0
    expect(needed).toBeGreaterThan(0);
  });
});
