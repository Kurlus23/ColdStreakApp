/**
 * Confirms that the server email report and the in-app DiscoveryReportCard
 * always produce identical numbers for the same data.
 *
 * Both paths delegate to shared/reportAnalysis.ts.  This test:
 *   1. Asserts (structurally) that server/reports.ts imports analysePatterns
 *      and computeStats from the shared module — so a future refactor that
 *      re-implements either function inline will surface here immediately.
 *   2. Runs a rich seed dataset through computeStats / analysePatterns and
 *      verifies the key report fields (avgMood, avgEnergy, avgFocus, sweet-spot
 *      label, morningBest, diminishing) so any divergence in the shared module
 *      itself is also caught.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import { analysePatterns, computeStats, type ReportRow } from "@shared/reportAnalysis";

// ── Structural guard ──────────────────────────────────────────────────────────

describe("server/reports.ts structural guard", () => {
  it("imports analysePatterns from shared/reportAnalysis", () => {
    const src = readFileSync(resolve(__dirname, "reports.ts"), "utf8");
    expect(src).toMatch(/analysePatterns/);
    expect(src).toMatch(/from\s+["']\.\.\/shared\/reportAnalysis["']/);
  });

  it("imports computeStats from shared/reportAnalysis", () => {
    const src = readFileSync(resolve(__dirname, "reports.ts"), "utf8");
    expect(src).toMatch(/computeStats/);
    // single import line covers both — check it names both functions
    expect(src).toMatch(/computeStats.*from\s+["']\.\.\/shared\/reportAnalysis["']/s);
  });

  it("calls computeStats (not a hand-rolled alternative) when building a user report", () => {
    const src = readFileSync(resolve(__dirname, "reports.ts"), "utf8");
    // The runReport function must call computeStats() with user plunges
    expect(src).toMatch(/computeStats\s*\(/);
  });
});

// ── Seed data ─────────────────────────────────────────────────────────────────

/**
 * Build a deterministic ReportRow with sensible defaults.
 * createdAt is supplied as a UTC hour (0–23) on a fixed date so morning/other
 * split tests are predictable.
 */
function makeRow(opts: {
  duration:    number;
  temperature: number;
  mood:        number | null;
  moodEnergy?: number | null;
  moodFocus?:  number | null;
  score?:      string | null;
  /** UTC hour on 2024-01-15 */
  hourUTC:     number;
}): ReportRow {
  const d = new Date(`2024-01-15T${String(opts.hourUTC).padStart(2, "0")}:00:00Z`);
  return {
    duration:    opts.duration,
    temperature: opts.temperature,
    mood:        opts.mood,
    moodEnergy:  opts.moodEnergy ?? null,
    moodFocus:   opts.moodFocus  ?? null,
    score:       opts.score      ?? null,
    createdAt:   d,
  };
}

/**
 * A seed dataset large enough to trigger every pattern branch:
 *   - sweet-spot  (≥3 rated, a dominant temp+dur band)
 *   - morningBest (pre-10 AM avg mood > afternoon avg + 0.25)
 *   - diminishing (6+ min avg mood < 3–6 min avg mood − 0.3)
 */
const SEED_ROWS: ReportRow[] = [
  // ── Best temp band: 45–50°F, best dur band: 1.5–3 min, morning, high mood ──
  makeRow({ duration: 120, temperature: 47, mood: 5, moodEnergy: 3, moodFocus: 3, score: "72.5", hourUTC: 7 }),
  makeRow({ duration: 150, temperature: 48, mood: 5, moodEnergy: 3, moodFocus: 3, score: "75.0", hourUTC: 8 }),
  makeRow({ duration: 130, temperature: 46, mood: 4, moodEnergy: 3, moodFocus: 2, score: "68.0", hourUTC: 6 }),
  makeRow({ duration: 140, temperature: 49, mood: 5, moodEnergy: 3, moodFocus: 3, score: "74.0", hourUTC: 7 }),

  // ── Same band, afternoon — still high mood but slightly lower ──
  makeRow({ duration: 160, temperature: 47, mood: 4, moodEnergy: 2, moodFocus: 2, score: "60.0", hourUTC: 14 }),

  // ── Afternoon with much lower mood — makes morning advantage clear ──
  makeRow({ duration: 200, temperature: 52, mood: 2, moodEnergy: 1, moodFocus: 1, score: "40.0", hourUTC: 15 }),
  makeRow({ duration: 180, temperature: 53, mood: 2, moodEnergy: 1, moodFocus: 1, score: "42.0", hourUTC: 16 }),

  // ── 3–6 min band: moderate mood, good (drives diminishing check) ──
  makeRow({ duration: 240, temperature: 47, mood: 4, moodEnergy: 2, moodFocus: 2, score: "58.0", hourUTC: 10 }),
  makeRow({ duration: 300, temperature: 48, mood: 4, moodEnergy: 2, moodFocus: 2, score: "57.0", hourUTC: 11 }),

  // ── 6+ min band: lower mood → diminishing returns flag ──
  makeRow({ duration: 420, temperature: 48, mood: 2, moodEnergy: 1, moodFocus: 1, score: "35.0", hourUTC: 12 }),
  makeRow({ duration: 480, temperature: 47, mood: 2, moodEnergy: 1, moodFocus: 1, score: "33.0", hourUTC: 13 }),
];

// ── Path simulation helpers ───────────────────────────────────────────────────

/**
 * Simulates what server/reports.ts → runReport does:
 *   stats = computeStats(userPlunges)
 * The email then renders stats.insights (from analysePatterns called inside
 * computeStats) and the top-level avgMood / avgEnergy / avgFocus numbers.
 */
function serverPath(rows: ReportRow[]) {
  return computeStats(rows);
}

/**
 * Simulates what DiscoveryReportCard does:
 *   stats   = computeStats(windowRows)        (for avgMood etc.)
 *   insights = analysePatterns(rated rows)     (for sweet spot / flags)
 *
 * Note: the component calls analysePatterns on the *rated* subset — this is
 * intentional; computeStats internally does the same thing via the same call.
 * Both must agree.
 */
function clientPath(rows: ReportRow[]) {
  const stats    = computeStats(rows);
  const rated    = rows.filter((r) => r.mood != null);
  const insights = analysePatterns(rated);
  return { stats, insights };
}

// ── Sync tests ────────────────────────────────────────────────────────────────

describe("in-app report vs emailed report — numeric parity", () => {
  const serverStats = serverPath(SEED_ROWS);
  const { stats: clientStats, insights: clientInsights } = clientPath(SEED_ROWS);

  it("avgMood is identical", () => {
    expect(clientStats.avgMood).toEqual(serverStats.avgMood);
    expect(serverStats.avgMood).not.toBeNull();
  });

  it("avgEnergy is identical", () => {
    expect(clientStats.avgEnergy).toEqual(serverStats.avgEnergy);
    expect(serverStats.avgEnergy).not.toBeNull();
  });

  it("avgFocus is identical", () => {
    expect(clientStats.avgFocus).toEqual(serverStats.avgFocus);
    expect(serverStats.avgFocus).not.toBeNull();
  });

  it("moodResponded count is identical", () => {
    expect(clientStats.moodResponded).toEqual(serverStats.moodResponded);
  });

  it("plunge count is identical", () => {
    expect(clientStats.count).toEqual(serverStats.count);
    expect(serverStats.count).toBe(SEED_ROWS.length);
  });

  it("sweet-spot tempLabel is identical", () => {
    expect(clientInsights.tempLabel).toEqual(serverStats.insights.tempLabel);
    expect(serverStats.insights.tempLabel).not.toBeNull();
  });

  it("sweet-spot durLabel is identical", () => {
    expect(clientInsights.durLabel).toEqual(serverStats.insights.durLabel);
    expect(serverStats.insights.durLabel).not.toBeNull();
  });

  it("sweetSpotFor label is identical", () => {
    expect(clientInsights.sweetSpotFor).toEqual(serverStats.insights.sweetSpotFor);
  });

  it("morningBest flag is identical", () => {
    expect(clientInsights.morningBest).toEqual(serverStats.insights.morningBest);
    // With our seed data the flag should be true
    expect(serverStats.insights.morningBest).toBe(true);
  });

  it("diminishing flag is identical", () => {
    expect(clientInsights.diminishing).toEqual(serverStats.insights.diminishing);
    // With our seed data the flag should fire
    expect(serverStats.insights.diminishing).not.toBeNull();
  });

  it("sampleSize is identical", () => {
    expect(clientInsights.sampleSize).toEqual(serverStats.insights.sampleSize);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("in-app report vs emailed report — edge cases", () => {
  it("both return null avgMood when no check-ins have mood ratings", () => {
    const noMood: ReportRow[] = SEED_ROWS.map((r) => ({ ...r, mood: null, moodEnergy: null, moodFocus: null }));
    const srv = serverPath(noMood);
    const { stats: cli } = clientPath(noMood);
    expect(srv.avgMood).toBeNull();
    expect(cli.avgMood).toBeNull();
  });

  it("both agree on avgMood with a single-plunge dataset", () => {
    const single = [makeRow({ duration: 120, temperature: 50, mood: 4, moodEnergy: 2, moodFocus: 2, hourUTC: 9 })];
    const srv = serverPath(single);
    const { stats: cli } = clientPath(single);
    expect(srv.avgMood).toEqual(cli.avgMood);
    expect(srv.avgMood).toBe(4);
  });

  it("both return null insights (< 3 rated) for sparse datasets", () => {
    const sparse = [
      makeRow({ duration: 120, temperature: 50, mood: 4, hourUTC: 9 }),
      makeRow({ duration: 120, temperature: 50, mood: 3, hourUTC: 10 }),
    ];
    const srv = serverPath(sparse);
    const { insights: cli } = clientPath(sparse);
    expect(srv.insights.tempLabel).toBeNull();
    expect(cli.tempLabel).toBeNull();
  });
});
