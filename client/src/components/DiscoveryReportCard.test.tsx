/**
 * Tests for DiscoveryReportCard and the underlying reportAnalysis logic.
 *
 * Covers:
 *  - analysePatterns / computeStats (pure logic, no DOM)
 *  - DiscoveryReportCard rendering for all data-quantity edge cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscoveryReportCard } from "./DiscoveryReportCard";
import { analysePatterns, computeStats, type ReportRow } from "@shared/reportAnalysis";
import { type Plunge } from "@shared/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Plunge object with sane defaults. */
function makePlunge(overrides: Partial<Plunge> = {}): Plunge {
  return {
    id: 1,
    userId: null,
    clientId: "test-client",
    duration: 180,          // 3 min
    temperature: 50,        // 50 °F
    score: "1.5",
    mood: null,
    moodEnergy: null,
    moodFocus: null,
    notes: null,
    locationName: null,
    locationLat: null,
    locationLng: null,
    photoUrl: null,
    createdAt: new Date().toISOString() as unknown as Date,
    ...overrides,
  } as Plunge;
}

/**
 * Build a ReportRow with the given hour-of-day (UTC) so we can control
 * morning-advantage detection.
 */
function makeRow(
  mood: number,
  utcHour: number,
  extra: Partial<ReportRow> = {},
): ReportRow {
  const d = new Date("2025-01-15T00:00:00Z");
  d.setUTCHours(utcHour);
  return {
    duration: 240,
    temperature: 48,
    mood,
    moodEnergy: null,
    moodFocus: null,
    score: "2.0",
    createdAt: d,
    ...extra,
  };
}

// ── localStorage stub ─────────────────────────────────────────────────────────

// jsdom provides localStorage but we reset it between tests so collapsed/period
// state does not bleed across tests.
beforeEach(() => {
  localStorage.clear();
});

// ── Pure-logic tests: analysePatterns ─────────────────────────────────────────

describe("analysePatterns", () => {
  it("returns sampleSize 0 and all-null insight for empty rows", () => {
    const result = analysePatterns([]);
    expect(result.sampleSize).toBe(0);
    expect(result.tempLabel).toBeNull();
    expect(result.durLabel).toBeNull();
    expect(result.morningBest).toBeNull();
    expect(result.diminishing).toBeNull();
  });

  it("returns nulls when fewer than 3 rated rows", () => {
    const rows = [makeRow(4, 9), makeRow(5, 9)];
    const result = analysePatterns(rows);
    expect(result.sampleSize).toBe(2);
    expect(result.tempLabel).toBeNull();
    expect(result.durLabel).toBeNull();
  });

  it("computes a tempLabel and durLabel with ≥3 rated rows", () => {
    const rows = [
      makeRow(5, 12, { temperature: 48, duration: 240 }),
      makeRow(5, 13, { temperature: 48, duration: 240 }),
      makeRow(5, 14, { temperature: 48, duration: 240 }),
    ];
    const result = analysePatterns(rows);
    expect(result.sampleSize).toBe(3);
    // All sessions are 45–50 °F, 3–6 min band
    expect(result.tempLabel).toBe("45–50°F");
    expect(result.durLabel).toBe("3–6 min");
  });

  it("detects morning advantage when pre-10am mood > later by >0.25", () => {
    // 2 morning sessions with mood 5, 2 afternoon sessions with mood 2
    const rows = [
      makeRow(5, 7),   // morning
      makeRow(5, 8),   // morning
      makeRow(2, 14),  // afternoon
      makeRow(2, 15),  // afternoon
    ];
    const result = analysePatterns(rows);
    expect(result.morningBest).toBe(true);
  });

  it("does NOT flag morning advantage when difference ≤ 0.25", () => {
    const rows = [
      makeRow(4, 7),
      makeRow(4, 8),
      makeRow(4, 14),
      makeRow(4, 15),
    ];
    const result = analysePatterns(rows);
    expect(result.morningBest).toBe(false);
  });

  it("flags diminishing returns when 6+ min mood is lower than 3-6 min by >0.3", () => {
    // 2 rows in 3-6 min band (180-360 s) with mood 5
    // 2 rows in 6+ min band (>360 s) with mood 2
    const rows: ReportRow[] = [
      { ...makeRow(5, 12), duration: 200 },
      { ...makeRow(5, 13), duration: 250 },
      { ...makeRow(2, 14), duration: 400 },
      { ...makeRow(2, 15), duration: 450 },
    ];
    const result = analysePatterns(rows);
    expect(result.diminishing).toBe("6+ min");
  });

  it("does NOT flag diminishing returns when 6+ min mood is similar to 3-6 min", () => {
    const rows: ReportRow[] = [
      { ...makeRow(4, 12), duration: 200 },
      { ...makeRow(4, 13), duration: 250 },
      { ...makeRow(4, 14), duration: 400 },
      { ...makeRow(4, 15), duration: 450 },
    ];
    const result = analysePatterns(rows);
    expect(result.diminishing).toBeNull();
  });
});

// ── Pure-logic tests: computeStats ────────────────────────────────────────────

describe("computeStats", () => {
  it("computes avgMood correctly across multiple rows", () => {
    const rows: ReportRow[] = [
      makeRow(4, 12),
      makeRow(5, 13),
      makeRow(3, 14),
    ];
    const stats = computeStats(rows);
    expect(stats.moodResponded).toBe(3);
    expect(stats.avgMood).toBe(4.0); // (4+5+3)/3
  });

  it("counts moodCounts correctly", () => {
    const rows: ReportRow[] = [
      makeRow(5, 12),
      makeRow(5, 13),
      makeRow(3, 14),
    ];
    const stats = computeStats(rows);
    expect(stats.moodCounts[5]).toBe(2);
    expect(stats.moodCounts[3]).toBe(1);
    expect(stats.moodCounts[4]).toBe(0);
  });

  it("tracks energy and focus when present", () => {
    const rows: ReportRow[] = [
      { ...makeRow(4, 12), moodEnergy: 3, moodFocus: 3 },
      { ...makeRow(4, 13), moodEnergy: 2, moodFocus: 2 },
    ];
    const stats = computeStats(rows);
    expect(stats.avgEnergy).toBe(2.5);
    expect(stats.avgFocus).toBe(2.5);
    expect(stats.energyCounts[3]).toBe(1);
    expect(stats.energyCounts[2]).toBe(1);
  });

  it("returns avgMood null when no rows have mood", () => {
    const rows: ReportRow[] = [
      { ...makeRow(4, 12), mood: null },
    ];
    const stats = computeStats(rows);
    expect(stats.avgMood).toBeNull();
    expect(stats.moodResponded).toBe(0);
  });
});

// ── Component tests: DiscoveryReportCard ──────────────────────────────────────

describe("DiscoveryReportCard — visibility rules", () => {
  it("renders nothing when zero plunges have mood ratings (all-time)", () => {
    const plunges = [makePlunge(), makePlunge({ id: 2 })];
    const { container } = render(<DiscoveryReportCard plunges={plunges} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the card header when at least one plunge has a mood rating", () => {
    const plunges = [makePlunge({ mood: 4 })];
    render(<DiscoveryReportCard plunges={plunges} />);
    expect(screen.getByTestId("discovery-report-card")).toBeInTheDocument();
    expect(screen.getByText("Your Last Report")).toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — fewer than 3 rated check-ins in window", () => {
  /** Plunges created today, all within the 7-day window. */
  function recentPlunge(id: number, mood: number | null = null): Plunge {
    return makePlunge({ id, mood, createdAt: new Date().toISOString() as unknown as Date });
  }

  it("shows 'Need at least 3 rated check-ins' when window has 1 rated plunge", () => {
    // 1 rated + 1 unrated
    const plunges = [recentPlunge(1, 4), recentPlunge(2, null)];
    render(<DiscoveryReportCard plunges={plunges} />);
    expect(
      screen.getByText(/Need at least 3 rated check-ins/i),
    ).toBeInTheDocument();
  });

  it("shows 'Need at least 3 rated check-ins' when window has exactly 2 rated plunges", () => {
    const plunges = [recentPlunge(1, 4), recentPlunge(2, 3)];
    render(<DiscoveryReportCard plunges={plunges} />);
    expect(
      screen.getByText(/Need at least 3 rated check-ins/i),
    ).toBeInTheDocument();
  });

  it("shows 'No plunges with check-ins' message when window has 0 rated plunges", () => {
    // mood-rated plunge is old (outside 7-day window)
    const old = makePlunge({
      id: 1,
      mood: 5,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date,
    });
    render(<DiscoveryReportCard plunges={[old]} />);
    // Card renders (there IS an all-time rated plunge) but shows the "no check-ins" copy
    expect(screen.getByTestId("discovery-report-card")).toBeInTheDocument();
    expect(screen.getByText(/No plunges with check-ins/i)).toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — building-data state (3–4 rated check-ins, sampleSize < 5)", () => {
  /**
   * Seed 3 rated plunges all in the same temp/duration band so they trigger
   * band detection, but sampleSize (3) < 5 means the full sweet spot is suppressed.
   */
  function buildingDataPlunges(): Plunge[] {
    const base = Date.now();
    return [3, 4, 5].map((id) =>
      makePlunge({
        id,
        mood: 4,
        moodEnergy: 3,
        duration: 200,
        temperature: 48,
        createdAt: new Date(base - id * 60_000).toISOString() as unknown as Date,
      }),
    );
  }

  it("shows the Sweet Spot — Building Data card for 3 rated sessions", () => {
    render(<DiscoveryReportCard plunges={buildingDataPlunges()} />);
    expect(screen.getByText(/Sweet Spot — Building Data/i)).toBeInTheDocument();
  });

  it("includes the correct check-in count in the building-data message", () => {
    render(<DiscoveryReportCard plunges={buildingDataPlunges()} />);
    expect(screen.getByText(/3 check-ins in this window/i)).toBeInTheDocument();
  });

  it("does NOT show the full sweet-spot grid for 3 sessions", () => {
    render(<DiscoveryReportCard plunges={buildingDataPlunges()} />);
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — full sweet spot (≥5 rated check-ins, same band)", () => {
  /**
   * Seed 5 rated plunges all in the same temp/duration band.
   * 5 sessions with mood ≥ 4 in 45-50°F / 3-6 min → sweet spot shows.
   */
  function fullDataPlunges(): Plunge[] {
    const base = Date.now();
    return [1, 2, 3, 4, 5].map((id) =>
      makePlunge({
        id,
        mood: 5,
        moodEnergy: 3,
        duration: 240,
        temperature: 48,
        createdAt: new Date(base - id * 60_000).toISOString() as unknown as Date,
      }),
    );
  }

  it("shows the full sweet-spot card heading", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();
  });

  it("shows the correct temperature label in the sweet-spot grid", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText("45–50°F")).toBeInTheDocument();
  });

  it("shows the correct duration label in the sweet-spot grid", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText("3–6 min")).toBeInTheDocument();
  });

  it("shows the How You Felt section with correct avg mood", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText(/How You Felt After Plunging/i)).toBeInTheDocument();
    // avgMood for five 5s = 5.0 shown as "5/5"
    expect(screen.getByText(/5\/5/)).toBeInTheDocument();
  });

  it("shows mood distribution bars", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText(/Mood breakdown/i)).toBeInTheDocument();
    expect(screen.getByText("😄 Great")).toBeInTheDocument();
  });

  it("shows energy distribution bars when moodEnergy is present", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText(/Energy breakdown/i)).toBeInTheDocument();
    expect(screen.getByText("🔋 Energised")).toBeInTheDocument();
  });

  it("shows the sample-size count in the subtitle", () => {
    render(<DiscoveryReportCard plunges={fullDataPlunges()} />);
    expect(screen.getByText(/5 check-ins/i)).toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — pattern flags", () => {
  it("shows Morning Timing Advantage flag when morning sessions score higher", () => {
    // Use dates within the last 7 days but with specific UTC hours so the
    // morning-advantage heuristic (UTC 5–10) fires correctly.
    function recentAtHour(dayOffset: number, utcHour: number): string {
      const d = new Date(Date.now() - dayOffset * 24 * 3600_000);
      d.setUTCHours(utcHour, 0, 0, 0);
      return d.toISOString();
    }
    // 3 morning (07:00 UTC) sessions with mood 5
    // 2 afternoon (14:00 UTC) sessions with mood 2  → avg diff > 0.25
    const plunges: Plunge[] = [
      makePlunge({ id: 1, mood: 5, duration: 240, temperature: 48, createdAt: recentAtHour(1, 7) as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 240, temperature: 48, createdAt: recentAtHour(2, 8) as unknown as Date }),
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48, createdAt: recentAtHour(3, 9) as unknown as Date }),
      makePlunge({ id: 4, mood: 2, duration: 240, temperature: 48, createdAt: recentAtHour(4, 14) as unknown as Date }),
      makePlunge({ id: 5, mood: 2, duration: 240, temperature: 48, createdAt: recentAtHour(5, 15) as unknown as Date }),
    ];
    render(<DiscoveryReportCard plunges={plunges} />);
    expect(screen.getByText(/Morning Timing Advantage/i)).toBeInTheDocument();
  });

  it("shows Diminishing Returns flag when 6+ min sessions score lower", () => {
    const base = Date.now();
    // 2 sessions in 3-6 min band, mood 5
    // 3 sessions in 6+ min band, mood 1
    const plunges: Plunge[] = [
      makePlunge({ id: 1, mood: 5, duration: 200, temperature: 48, createdAt: new Date(base - 1 * 60_000).toISOString() as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 250, temperature: 48, createdAt: new Date(base - 2 * 60_000).toISOString() as unknown as Date }),
      makePlunge({ id: 3, mood: 1, duration: 400, temperature: 48, createdAt: new Date(base - 3 * 60_000).toISOString() as unknown as Date }),
      makePlunge({ id: 4, mood: 1, duration: 420, temperature: 48, createdAt: new Date(base - 4 * 60_000).toISOString() as unknown as Date }),
      makePlunge({ id: 5, mood: 1, duration: 450, temperature: 48, createdAt: new Date(base - 5 * 60_000).toISOString() as unknown as Date }),
    ];
    render(<DiscoveryReportCard plunges={plunges} />);
    expect(screen.getByText(/Diminishing Returns/i)).toBeInTheDocument();
  });
});
