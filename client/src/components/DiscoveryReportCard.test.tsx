/**
 * Tests for DiscoveryReportCard and the underlying reportAnalysis logic.
 *
 * Covers:
 *  - analysePatterns / computeStats (pure logic, no DOM)
 *  - DiscoveryReportCard rendering for all data-quantity edge cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

// ── 30-day tab tests ──────────────────────────────────────────────────────────
//
// All suites below freeze time at 2025-01-15T12:00:00Z so "days ago" offsets
// always land on deterministic calendar dates and reliably span two months
// (December 2024 and January 2025) regardless of when the test runs.

const FROZEN_NOW = new Date("2025-01-15T12:00:00Z");

/** ISO timestamp N days before the frozen "now". */
function daysAgoISO(n: number): string {
  return new Date(FROZEN_NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("DiscoveryReportCard — 30-day tab with sessions spanning two calendar months", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 5 rated plunges spread across January and December 2024 —
   * all outside the 7-day window, all inside the 30-day window.
   *
   * With FROZEN_NOW = 2025-01-15:
   *   8 days ago  → 2025-01-07  (January)
   *   12 days ago → 2025-01-03  (January)
   *   18 days ago → 2024-12-28  (December ← cross-month)
   *   23 days ago → 2024-12-23  (December)
   *   28 days ago → 2024-12-18  (December)
   */
  function crossMonthPlunges(): Plunge[] {
    return [
      makePlunge({ id: 1, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(8)  as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(12) as unknown as Date }),
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(18) as unknown as Date }),
      makePlunge({ id: 4, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(23) as unknown as Date }),
      makePlunge({ id: 5, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(28) as unknown as Date }),
    ];
  }

  it("7-day tab is blank when all 5 sessions are older than 7 days (outside window)", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);
    expect(screen.getByText(/No plunges with check-ins in the last 7 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });

  it("30-day tab shows the full sweet-spot card for sessions spanning December and January", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();
  });

  it("30-day tab shows the correct temperature label for cross-month data", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText("45–50°F")).toBeInTheDocument();
  });

  it("30-day tab shows the correct duration label for cross-month data", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText("3–6 min")).toBeInTheDocument();
  });

  it("30-day tab shows 'How You Felt' section with 5 check-ins for cross-month data", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText(/How You Felt After Plunging/i)).toBeInTheDocument();
    expect(screen.getByText(/5 check-ins/i)).toBeInTheDocument();
  });

  it("switching back from 30-day to 7-day tab returns to the blank state", () => {
    render(<DiscoveryReportCard plunges={crossMonthPlunges()} />);

    // Switch to 30 days → sweet spot visible
    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));
    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();

    // Switch back to 7 days → blank again
    fireEvent.click(screen.getByRole("button", { name: /7 days/i }));
    expect(screen.getByText(/No plunges with check-ins in the last 7 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — switching periods updates rendered insights (cross-month)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Mixed dataset with FROZEN_NOW = 2025-01-15:
   *   2 recent plunges within 7 days  → 2025-01-14 and 2025-01-12 (January)
   *   3 older plunges 9–19 days ago   → 2025-01-06 (Jan) and 2024-12-27/17 (Dec)
   *
   * 7-day tab: only 2 rated → shows "Need at least 3"
   * 30-day tab: all 5 rated → shows full sweet-spot card
   */
  function mixedCrossMonthPlunges(): Plunge[] {
    return [
      // Within 7-day window (January 2025)
      makePlunge({ id: 1, mood: 4, duration: 240, temperature: 48, createdAt: daysAgoISO(1) as unknown as Date }),
      makePlunge({ id: 2, mood: 4, duration: 240, temperature: 48, createdAt: daysAgoISO(3) as unknown as Date }),
      // Outside 7-day window; span January and December 2024
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(9)  as unknown as Date }), // 2025-01-06
      makePlunge({ id: 4, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(19) as unknown as Date }), // 2024-12-27
      makePlunge({ id: 5, mood: 5, duration: 240, temperature: 48, createdAt: daysAgoISO(29) as unknown as Date }), // 2024-12-17
    ];
  }

  it("7-day tab shows 'Need at least 3' with only 2 recent rated sessions", () => {
    render(<DiscoveryReportCard plunges={mixedCrossMonthPlunges()} />);
    expect(screen.getByText(/Need at least 3 rated check-ins/i)).toBeInTheDocument();
  });

  it("30-day tab shows the full sweet-spot card when the window spans December and January", () => {
    render(<DiscoveryReportCard plunges={mixedCrossMonthPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();
  });

  it("switching back from 30-day to 7-day tab reverts to the insufficient-data message", () => {
    render(<DiscoveryReportCard plunges={mixedCrossMonthPlunges()} />);

    // Switch to 30 days — shows sweet spot for cross-month data
    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));
    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();

    // Switch back to 7 days — only 2 recent sessions, back to insufficient message
    fireEvent.click(screen.getByRole("button", { name: /7 days/i }));
    expect(screen.getByText(/Need at least 3 rated check-ins/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });
});

// ── All-time tab tests ────────────────────────────────────────────────────────
//
// All suites below freeze time at 2025-06-15T12:00:00Z so sessions placed
// 60–400+ days in the past span multiple calendar years and are definitively
// outside both the 7-day and 30-day rolling windows.

const FROZEN_ALL_TIME_NOW = new Date("2025-06-15T12:00:00Z");

/** ISO timestamp N days before the all-time frozen "now". */
function daysBeforeAllTimeISO(n: number): string {
  return new Date(FROZEN_ALL_TIME_NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("DiscoveryReportCard — All-time tab with plunges spanning multiple years", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_ALL_TIME_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 5 rated plunges spread across three different years:
   *   60 days ago  → Apr 16, 2025  (this year, outside 30-day window)
   *   120 days ago → Feb 15, 2025  (this year, well outside 30-day window)
   *   200 days ago → Nov 27, 2024  (last year)
   *   300 days ago → Aug 19, 2024  (last year)
   *   400 days ago → May 11, 2024  (last year)
   *
   * None are in the 7-day or 30-day windows; all are in All-time.
   */
  function multiYearPlunges(): Plunge[] {
    return [
      makePlunge({ id: 1, mood: 5, duration: 240, temperature: 48, createdAt: daysBeforeAllTimeISO(60)  as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 240, temperature: 48, createdAt: daysBeforeAllTimeISO(120) as unknown as Date }),
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48, createdAt: daysBeforeAllTimeISO(200) as unknown as Date }),
      makePlunge({ id: 4, mood: 5, duration: 240, temperature: 48, createdAt: daysBeforeAllTimeISO(300) as unknown as Date }),
      makePlunge({ id: 5, mood: 5, duration: 240, temperature: 48, createdAt: daysBeforeAllTimeISO(400) as unknown as Date }),
    ];
  }

  it("7-day tab is blank when all sessions are older than 7 days", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);
    expect(screen.getByText(/No plunges with check-ins in the last 7 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });

  it("30-day tab is blank when all sessions are older than 30 days", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));

    expect(screen.getByText(/No plunges with check-ins in the last 30 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });

  it("All-time tab shows the full sweet-spot card for sessions spread across years", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();
  });

  it("All-time tab shows the correct temperature label for multi-year data", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText("45–50°F")).toBeInTheDocument();
  });

  it("All-time tab shows the correct duration label for multi-year data", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText("3–6 min")).toBeInTheDocument();
  });

  it("All-time tab shows 'How You Felt' with 5 check-ins across years", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText(/How You Felt After Plunging/i)).toBeInTheDocument();
    expect(screen.getByText(/5 check-ins/i)).toBeInTheDocument();
  });

  it("All-time tab does NOT show the 'No plunges with check-ins yet' empty state when rated sessions exist", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.queryByText(/No plunges with check-ins yet/i)).not.toBeInTheDocument();
  });

  it("switching from All-time back to 7-day tab returns to blank state", () => {
    render(<DiscoveryReportCard plunges={multiYearPlunges()} />);

    // Switch to All time → sweet spot visible
    fireEvent.click(screen.getByRole("button", { name: /All time/i }));
    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();

    // Switch back to 7 days → blank again
    fireEvent.click(screen.getByRole("button", { name: /7 days/i }));
    expect(screen.getByText(/No plunges with check-ins in the last 7 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Current Sweet Spot/i)).not.toBeInTheDocument();
  });
});

// ── Midnight-boundary test ─────────────────────────────────────────────────────
//
// The `dateRangeLabel` helper calls `new Date()` inline in JSX on every render,
// so the label always reflects the clock at the time of the latest render.
// If the component re-renders after midnight (e.g. a prop update, period switch,
// or any state change) the "today" end of the label will be up-to-date.
//
// Known limitation: if the component stays mounted with NO re-render across a
// midnight boundary (e.g. the user leaves the app open overnight and never
// interacts), the label will remain stale until the next render. Because the
// label is purely cosmetic and every interaction (tab switch, collapse toggle,
// new plunge data) triggers a re-render, this is accepted as an extremely low
// impact edge case and no interval timer is used to avoid unnecessary overhead.

describe("DiscoveryReportCard — date range label refreshes after midnight on re-render", () => {
  // Freeze just before midnight on Jan 15 so we start with "Jan 15" as "today"
  const BEFORE_MIDNIGHT = new Date("2025-01-15T23:59:59Z");
  const AFTER_MIDNIGHT  = new Date("2025-01-16T00:00:01Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_MIDNIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** One plunge well inside both rolling windows so the card renders fully. */
  function singleRecentPlunge(): Plunge {
    return makePlunge({
      id: 1,
      mood: 5,
      duration: 240,
      temperature: 48,
      // 1 day ago — safely inside the 7-day window
      createdAt: new Date(BEFORE_MIDNIGHT.getTime() - 24 * 60 * 60 * 1000).toISOString() as unknown as Date,
    });
  }

  it("shows the pre-midnight date in the label before midnight", () => {
    render(<DiscoveryReportCard plunges={[singleRecentPlunge()]} />);
    // The 7-day label ends with today's date; before midnight that is Jan 15
    const label = screen.getByText(/Jan 15/);
    expect(label).toBeInTheDocument();
  });

  it("updates the label to the new date when the component re-renders after midnight", () => {
    const { rerender } = render(<DiscoveryReportCard plunges={[singleRecentPlunge()]} />);

    // Confirm the label says Jan 15 before midnight
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();

    // Advance the clock past midnight
    vi.setSystemTime(AFTER_MIDNIGHT);

    // Trigger a re-render (simulates any prop update, e.g. a new plunge arriving)
    rerender(<DiscoveryReportCard plunges={[singleRecentPlunge()]} />);

    // The label must now end with Jan 16 (the new "today")
    expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
    // And Jan 15 must no longer appear as today's end date in the label
    // (it may still appear as the cutoff start, so we check the full label text)
    const labelEl = screen.getByText(/Jan 9 – Jan 16/);
    expect(labelEl).toBeInTheDocument();
  });

  it("label end date advances by one day after midnight re-render on the 30-day tab", () => {
    const { rerender } = render(<DiscoveryReportCard plunges={[singleRecentPlunge()]} />);

    // Switch to 30-day tab before midnight
    fireEvent.click(screen.getByRole("button", { name: /30 days/i }));
    // Label ends with Jan 15
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();

    // Advance past midnight and re-render
    vi.setSystemTime(AFTER_MIDNIGHT);
    rerender(<DiscoveryReportCard plunges={[singleRecentPlunge()]} />);

    // The 30-day label should now end with Jan 16
    expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — All-time tab never goes blank with many check-ins across years", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_ALL_TIME_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * A more realistic dataset: 12 rated plunges spread irregularly across
   * two full years, simulating a long-term user with monthly cadence.
   * Every plunge is > 30 days old so it only appears in the All-time window.
   */
  function manyYearsPlunges(): Plunge[] {
    // Offsets: roughly monthly for 12 months, ranging from 35 to 395 days ago
    const offsets = [35, 65, 95, 130, 160, 195, 225, 260, 290, 325, 355, 395];
    return offsets.map((offset, i) =>
      makePlunge({
        id: i + 1,
        mood: (i % 3 === 0) ? 5 : (i % 3 === 1) ? 4 : 3,
        duration: 240,
        temperature: 48,
        createdAt: daysBeforeAllTimeISO(offset) as unknown as Date,
      }),
    );
  }

  it("All-time tab shows the sweet-spot card for 12 sessions spread over two years", () => {
    render(<DiscoveryReportCard plunges={manyYearsPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText(/Your Current Sweet Spot/i)).toBeInTheDocument();
  });

  it("All-time tab never shows the 'No plunges with check-ins yet' message when 12 rated sessions exist", () => {
    render(<DiscoveryReportCard plunges={manyYearsPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.queryByText(/No plunges with check-ins yet/i)).not.toBeInTheDocument();
  });

  it("All-time tab shows 12 check-ins in the subtitle for a 2-year dataset", () => {
    render(<DiscoveryReportCard plunges={manyYearsPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText(/12 check-ins/i)).toBeInTheDocument();
  });

  it("All-time tab shows mood distribution bars for a 2-year dataset", () => {
    render(<DiscoveryReportCard plunges={manyYearsPlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.getByText(/Mood breakdown/i)).toBeInTheDocument();
  });
});

// ── All-time date range label tests ───────────────────────────────────────────
//
// These tests specifically verify the text of the date range label shown under
// the period tabs when the All-time tab is active.
//
// Key rules from dateRangeLabel():
//   • Cross-year earliest session  → "Since Mon D, YYYY"  (year suffix present)
//   • Same-year earliest session   → "Mon D – Mon D"      (no year suffix)
//
// Time is frozen at 2025-06-15T12:00:00Z for both suites so offsets produce
// deterministic calendar dates regardless of when the tests run.

describe("DiscoveryReportCard — All-time date range label (cross-year: 'Since Mon D, YYYY')", () => {
  // Frozen "today" = Jun 15, 2025
  const FROZEN = new Date("2025-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Earliest plunge is 400 days before 2025-06-15 = 2024-05-11.
   * 2024 ≠ 2025, so the label must use the "Since …" prefix with year.
   *
   * Expected: "Since May 11, 2024"
   */
  function crossYearAllTimePlunges(): Plunge[] {
    return [
      // Most recent — 60 days ago → 2025-04-16 (this year, outside 30-day window)
      makePlunge({ id: 1, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 60  * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 4, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 300 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      // Earliest — 400 days ago → 2024-05-11 (previous year)
      makePlunge({ id: 5, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
    ];
  }

  it("All-time date range label starts with 'Since' when earliest session is from a previous year", () => {
    render(<DiscoveryReportCard plunges={crossYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    // The date range label element should exist and begin with "Since"
    const labelEl = screen.getByText(/^Since /);
    expect(labelEl).toBeInTheDocument();
  });

  it("All-time date range label includes the correct year when earliest session spans to a prior year", () => {
    render(<DiscoveryReportCard plunges={crossYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    // 400 days before 2025-06-15 = 2024-05-11 → "Since May 11, 2024"
    expect(screen.getByText("Since May 11, 2024")).toBeInTheDocument();
  });

  it("All-time date range label does NOT use the 'Mon D – Mon D' format when earliest session is cross-year", () => {
    render(<DiscoveryReportCard plunges={crossYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    // The label must not contain " – " (range separator) for cross-year data
    const labelEl = screen.getByText(/^Since /);
    expect(labelEl.textContent).not.toContain(" – ");
  });

  it("All-time date range label is absent on the 7-day tab (rolling label, not 'Since')", () => {
    render(<DiscoveryReportCard plunges={crossYearAllTimePlunges()} />);

    // Default tab is 7-day — should not show a "Since …" label
    expect(screen.queryByText(/^Since /)).not.toBeInTheDocument();
  });

  it("All-time date range label reverts after switching from All time back to 7 days", () => {
    render(<DiscoveryReportCard plunges={crossYearAllTimePlunges()} />);

    // Switch to All time → "Since May 11, 2024" visible
    fireEvent.click(screen.getByRole("button", { name: /All time/i }));
    expect(screen.getByText("Since May 11, 2024")).toBeInTheDocument();

    // Switch back to 7 days → "Since" label must disappear
    fireEvent.click(screen.getByRole("button", { name: /7 days/i }));
    expect(screen.queryByText(/^Since /)).not.toBeInTheDocument();
  });
});

describe("DiscoveryReportCard — All-time date range label (same year: 'Mon D – Mon D')", () => {
  // Frozen "today" = Jun 15, 2025
  const FROZEN = new Date("2025-06-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * All plunges are within 2025 — the same year as the frozen "today".
   * Earliest is 60 days before 2025-06-15 = 2025-04-16.
   *
   * Expected: "Apr 16 – Jun 15"  (no year suffix, no "Since" prefix)
   */
  function sameYearAllTimePlunges(): Plunge[] {
    return [
      // Earliest — 60 days ago → 2025-04-16
      makePlunge({ id: 1, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 2, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 3, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 4, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
      makePlunge({ id: 5, mood: 5, duration: 240, temperature: 48,
        createdAt: new Date(FROZEN.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString() as unknown as Date }),
    ];
  }

  it("All-time date range label uses 'Mon D – Mon D' format when all sessions are within the current year", () => {
    render(<DiscoveryReportCard plunges={sameYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    // 60 days before 2025-06-15 = 2025-04-16 → "Apr 16 – Jun 15"
    expect(screen.getByText("Apr 16 – Jun 15")).toBeInTheDocument();
  });

  it("All-time date range label does NOT include 'Since' when all sessions are within the current year", () => {
    render(<DiscoveryReportCard plunges={sameYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    expect(screen.queryByText(/^Since /)).not.toBeInTheDocument();
  });

  it("All-time date range label does NOT include a year suffix when all sessions are within the current year", () => {
    render(<DiscoveryReportCard plunges={sameYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    // The label must not contain ", 2025" or any year suffix
    const labelEl = screen.getByText("Apr 16 – Jun 15");
    expect(labelEl.textContent).not.toMatch(/\d{4}/);
  });

  it("All-time date range label ends with today's date ('Jun 15') for same-year data", () => {
    render(<DiscoveryReportCard plunges={sameYearAllTimePlunges()} />);

    fireEvent.click(screen.getByRole("button", { name: /All time/i }));

    const labelEl = screen.getByText(/Jun 15/);
    expect(labelEl).toBeInTheDocument();
  });
});
