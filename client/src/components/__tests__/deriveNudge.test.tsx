/**
 * Unit tests for deriveNudge (exported from TryThisNextCard) and the
 * dismiss-key reset behaviour of the TryThisNextCard component.
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type Plunge } from "@shared/schema";
import { deriveNudge } from "../TryThisNextCard";
import { TryThisNextCard } from "../TryThisNextCard";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date whose UTC value is `daysAgo` days before `now`. */
function daysAgo(days: number, now = Date.now()): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

/**
 * Minimal Plunge factory.  Only the fields read by deriveNudge / bestBucket /
 * computeMonthTrendDelta are significant; everything else is filled with safe
 * defaults so TypeScript is happy.
 */
function makePlunge(overrides: {
  id?: number;
  createdAt?: Date;
  mood?: number | null;
  moodEnergy?: number | null;
  moodFocus?: number | null;
  temperature?: number;
  duration?: number;
}): Plunge {
  return {
    id:             overrides.id           ?? 1,
    clientId:       null,
    userId:         null,
    duration:       overrides.duration     ?? 180,
    temperature:    overrides.temperature  ?? 50,
    score:          "3.00",
    hrAvg:          null,
    spo2Avg:        null,
    photoData:      null,
    locationName:   null,
    locationId:     null,
    timerUsed:      false,
    calories:       null,
    timezone:       null,
    mood:           overrides.mood         ?? null,
    moodEnergy:     overrides.moodEnergy   ?? null,
    moodFocus:      overrides.moodFocus    ?? null,
    moodFatigue:        null,
    moodPromptedAt:     null,
    challengerUserId:   null,
    challengeResultSent: false,
    brainFreezeScore:   null,
    createdAt:          overrides.createdAt ?? new Date(),
  };
}

/**
 * Build `count` plunges, all created `daysAgoValue` days ago with the given
 * mood / energy / focus ratings (all rated by default).
 */
function makePlunges(
  count: number,
  daysAgoValue: number,
  opts: {
    mood?: number | null;
    moodEnergy?: number | null;
    moodFocus?: number | null;
    temperature?: number;
    duration?: number;
    idStart?: number;
  } = {},
): Plunge[] {
  const { idStart = 1, ...rest } = opts;
  return Array.from({ length: count }, (_, i) =>
    makePlunge({
      id:        idStart + i,
      createdAt: daysAgo(daysAgoValue),
      ...rest,
    }),
  );
}

// ── deriveNudge unit tests ────────────────────────────────────────────────────

describe("deriveNudge", () => {
  // ── Minimum plunge count ──────────────────────────────────────────────────

  it("returns null when there are fewer than 10 plunges", () => {
    const plunges = makePlunges(9, 1, { mood: 4 });
    expect(deriveNudge(plunges)).toBeNull();
  });

  it("returns null when there are exactly 0 plunges", () => {
    expect(deriveNudge([])).toBeNull();
  });

  // ── 7-day gap suppression (defers to WelcomeBackCard) ────────────────────

  it("returns null when the most-recent plunge was 7 days ago", () => {
    // Exactly 7 days → daysSince = 7, threshold is >= 7
    const plunges = makePlunges(10, 7, { mood: 4 });
    expect(deriveNudge(plunges)).toBeNull();
  });

  it("returns null when the most-recent plunge was 8 days ago", () => {
    const plunges = makePlunges(10, 8, { mood: 4 });
    expect(deriveNudge(plunges)).toBeNull();
  });

  // ── Trending-up ───────────────────────────────────────────────────────────

  it("returns trending-up when the month-over-month delta is > 0.05", () => {
    // Month 1 (older): mood=2  → normalised ≈ 0.25
    // Month 2 (recent): mood=5 → normalised = 1.00
    // delta ≈ +0.75
    const month1 = makePlunges(5, 60, { mood: 2, idStart: 1 });   // ~2 months ago
    const month2 = makePlunges(5, 1,  { mood: 5, idStart: 6 });   // yesterday

    // Spread the month-1 plunges across a clearly different calendar month
    // (60 days ago is comfortably in a prior UTC month).
    const nudge = deriveNudge([...month1, ...month2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-up");
  });

  it("trending-up contains a challenge suggestion in the body", () => {
    const month1 = makePlunges(5, 60, { mood: 2, idStart: 1 });
    const month2 = makePlunges(5, 1,  { mood: 5, idStart: 6 });
    const nudge = deriveNudge([...month1, ...month2]);
    expect(nudge!.body).toMatch(/challenge|drop|add/i);
  });

  // ── Trending-down ─────────────────────────────────────────────────────────

  it("returns trending-down when the month-over-month delta is < -0.05", () => {
    // Month 1: mood=5 → 1.00
    // Month 2 (recent): mood=1 → 0.00
    // delta ≈ -1.00
    const month1 = makePlunges(5, 60, { mood: 5, idStart: 1 });
    const month2 = makePlunges(5, 1,  { mood: 1, idStart: 6 });
    const nudge = deriveNudge([...month1, ...month2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-down");
  });

  it("trending-down contains a recovery / ease-up suggestion in the body", () => {
    const month1 = makePlunges(5, 60, { mood: 5, idStart: 1 });
    const month2 = makePlunges(5, 1,  { mood: 1, idStart: 6 });
    const nudge = deriveNudge([...month1, ...month2]);
    expect(nudge!.body).toMatch(/dial|back|warmer|shorter|consistent/i);
  });

  // ── Holding-steady ────────────────────────────────────────────────────────

  it("returns holding-steady when the month-over-month delta is within ±0.05", () => {
    // Both months: mood=3 → normalised = 0.5; delta = 0
    const month1 = makePlunges(5, 60, { mood: 3, idStart: 1 });
    const month2 = makePlunges(5, 1,  { mood: 3, idStart: 6 });
    const nudge = deriveNudge([...month1, ...month2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("holding-steady");
  });

  // ── Sweet-spot fallback ───────────────────────────────────────────────────

  it("returns sweet-spot when there is only one month of data but ≥10 rated plunges in ≥3-plunge buckets", () => {
    // All plunges within the current month so computeMonthTrendDelta returns null.
    // 10 plunges in the same temp/duration bucket (50°F, 180 s → "45–50°F", "3–6 min").
    const plunges = makePlunges(10, 3, {
      mood:        4,
      temperature: 50,
      duration:    240,
    });
    const nudge = deriveNudge(plunges);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("sweet-spot");
  });

  it("sweet-spot body mentions the temperature and duration bucket", () => {
    const plunges = makePlunges(10, 3, {
      mood:        4,
      temperature: 50,
      duration:    240,
    });
    const nudge = deriveNudge(plunges);
    // body should reference the sweet-spot label text
    expect(nudge!.body).toMatch(/45–50°F|3–6 min/i);
  });

  it("returns null when there is no qualifying bucket (all buckets have <3 plunges)", () => {
    // 10 plunges each in a unique (temperature × duration) bucket so no
    // bucket reaches the required count of 3.
    //   Temp bands:  40-45°F (41), 45-50°F (46), 50-55°F (50)
    //   Dur bands:   <1.5min (30s), 1.5-3min (100s), 3-6min (200s), 6+min (400s)
    // Using combinations that are each unique keeps every bucket at count=1.
    const combos: [number, number][] = [
      [41, 30], [41, 100], [41, 200], [41, 400],
      [46, 30], [46, 100], [46, 200], [46, 400],
      [50, 30], [50, 100],
    ];
    const plunges = combos.map(([temp, dur], i) =>
      makePlunge({
        id:          i + 1,
        createdAt:   daysAgo(i + 1), // same calendar month, staggered by a day
        mood:        4,
        temperature: temp,
        duration:    dur,
      }),
    );
    // All plunges are in the same calendar month → no 2-month delta.
    // Each bucket has exactly 1 plunge → count < 3 → bestBucket returns null.
    const nudge = deriveNudge(plunges);
    expect(nudge).toBeNull();
  });

  // ── Priority ordering ─────────────────────────────────────────────────────

  it("suppresses (welcome-back beats trending-up): 7-day gap wins over rising trend", () => {
    // month1 is old, month2 is also old (8 days ago) → daysSince >= 7 → null
    const month1 = makePlunges(5, 70, { mood: 2, idStart: 1 });
    const month2 = makePlunges(5, 8,  { mood: 5, idStart: 6 });
    // Without the gap this would be trending-up; the gap must suppress it.
    expect(deriveNudge([...month1, ...month2])).toBeNull();
  });

  it("suppresses (welcome-back beats sweet-spot): 7-day gap suppresses sweet-spot too", () => {
    // All in one month but 8 days old → daysSince >= 7 → null
    const plunges = makePlunges(10, 8, {
      mood:        4,
      temperature: 50,
      duration:    240,
    });
    expect(deriveNudge(plunges)).toBeNull();
  });

  it("trending-up takes priority over sweet-spot when trend data is available", () => {
    // Two months of data → delta is computed → we never fall through to sweet-spot
    const month1 = makePlunges(5, 60, { mood: 2, idStart: 1 });
    const month2 = makePlunges(5, 1,  { mood: 5, idStart: 6 });
    const nudge = deriveNudge([...month1, ...month2]);
    // Result must be trend-based, not sweet-spot
    expect(nudge!.kind).not.toBe("sweet-spot");
  });

  // ── Mixed rated / unrated plunges ─────────────────────────────────────────

  it("minimum-count check uses total plunges, not rated plunges", () => {
    // 10 plunges total but only 5 are rated; the gate is plunges.length < 10
    // so this should NOT return null just because rated count < 10.
    // The 5 rated plunges span two months → a trend is computable.
    const unrated1 = makePlunges(3, 60, { mood: null, idStart: 1 }); // 3 unrated, old month
    const rated1   = makePlunges(2, 60, { mood: 2,    idStart: 4 }); // 2 rated, old month
    const unrated2 = makePlunges(2, 1,  { mood: null, idStart: 6 }); // 2 unrated, recent
    const rated2   = makePlunges(3, 1,  { mood: 5,    idStart: 8 }); // 3 rated, recent
    // total = 10; rated = 5 (across 2 months) → delta > 0 → trending-up
    const nudge = deriveNudge([...unrated1, ...rated1, ...unrated2, ...rated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-up");
  });

  it("returns null when all 10 plunges are unrated (no mood data at all)", () => {
    // plunges.length === 10 passes the gate, but:
    //   - computeMonthTrendDelta → null (no rated data)
    //   - bestBucket → null (rated.length === 0 < 10)
    const plunges = makePlunges(10, 1, { mood: null });
    expect(deriveNudge(plunges)).toBeNull();
  });

  it("returns null when 10 total plunges but only 1 is rated (insufficient for sweet-spot)", () => {
    // 9 unrated + 1 rated → total passes; rated.length=1 fails bestBucket's ≥10 check
    const unrated = makePlunges(9, 1,  { mood: null, idStart: 1 });
    const rated   = makePlunges(1, 60, { mood: 4,    idStart: 10, temperature: 50, duration: 240 });
    const nudge   = deriveNudge([...unrated, ...rated]);
    expect(nudge).toBeNull();
  });

  it("returns sweet-spot when 15 total plunges have 10 rated in a qualifying bucket", () => {
    // 5 unrated + 10 rated in the same bucket (50°F, 240 s → "45–50°F", "3–6 min")
    // All within one calendar month → no 2-month delta → falls through to bestBucket.
    const unrated = makePlunges(5,  2, { mood: null, idStart: 1 });
    const rated   = makePlunges(10, 3, { mood: 4, temperature: 50, duration: 240, idStart: 6 });
    const nudge   = deriveNudge([...unrated, ...rated]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("sweet-spot");
  });

  it("returns trending-up when unrated plunges are interspersed across both months", () => {
    // month1: 5 rated (mood=2) + 2 unrated; month2: 5 rated (mood=5) + 2 unrated
    // Unrated entries must not corrupt the composite calculation.
    const rated1   = makePlunges(5, 60, { mood: 2,    idStart: 1  });
    const unrated1 = makePlunges(2, 62, { mood: null, idStart: 6  });
    const rated2   = makePlunges(5, 1,  { mood: 5,    idStart: 8  });
    const unrated2 = makePlunges(2, 2,  { mood: null, idStart: 13 });
    const nudge    = deriveNudge([...rated1, ...unrated1, ...rated2, ...unrated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-up");
  });

  it("returns trending-down when unrated plunges are interspersed across both months", () => {
    // month1: 5 rated (mood=5) + 2 unrated; month2: 5 rated (mood=1) + 2 unrated
    const rated1   = makePlunges(5, 60, { mood: 5,    idStart: 1  });
    const unrated1 = makePlunges(2, 62, { mood: null, idStart: 6  });
    const rated2   = makePlunges(5, 1,  { mood: 1,    idStart: 8  });
    const unrated2 = makePlunges(2, 2,  { mood: null, idStart: 13 });
    const nudge    = deriveNudge([...rated1, ...unrated1, ...rated2, ...unrated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-down");
  });

  it("returns holding-steady when unrated plunges are mixed in with stable rated data", () => {
    // month1 and month2 both mood=3; unrated entries scattered throughout
    const rated1   = makePlunges(5, 60, { mood: 3,    idStart: 1  });
    const unrated1 = makePlunges(3, 62, { mood: null, idStart: 6  });
    const rated2   = makePlunges(5, 1,  { mood: 3,    idStart: 9  });
    const unrated2 = makePlunges(2, 2,  { mood: null, idStart: 14 });
    const nudge    = deriveNudge([...rated1, ...unrated1, ...rated2, ...unrated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("holding-steady");
  });

  // ── computeMonthTrendDelta per-month minimum threshold ───────────────────
  //
  // MIN_RATED_PER_MONTH = 2: both participating months must have at least 2
  // rated plunges for the delta to be considered meaningful.  A sample size of
  // 1 is too sparse (could be an outlier) and must produce null so the card
  // falls through to the sweet-spot fallback or returns null entirely.

  it("returns null (not trending-up) when each month has only 1 rated plunge", () => {
    // 8 unrated recent plunges pass the total-count (≥10) gate.
    // Each calendar month has exactly 1 rated entry → below MIN_RATED_PER_MONTH
    // → computeMonthTrendDelta must return null → no trend nudge shown.
    // bestBucket also returns null (rated.length=2 < 10) → null overall.
    //
    // month1 (60 days ago): mood=2  (1 rated)
    // month2 (1 day ago):   mood=5  (1 rated)
    const unrated = makePlunges(8, 1,  { mood: null, idStart: 1 });
    const rated1  = makePlunges(1, 60, { mood: 2,    idStart: 9 });
    const rated2  = makePlunges(1, 1,  { mood: 5,    idStart: 10 });
    const nudge   = deriveNudge([...unrated, ...rated1, ...rated2]);
    expect(nudge).toBeNull();
  });

  it("returns null (not holding-steady) when each month has only 1 rated plunge", () => {
    // Identical mood in both months would normally yield delta=0 → holding-steady,
    // but with only 1 rated entry per month computeMonthTrendDelta must return null.
    // bestBucket also returns null (rated.length=2 < 10) → null overall.
    //
    // month1 (60 days ago): mood=3  (1 rated)
    // month2 (1 day ago):   mood=3  (1 rated)
    const unrated = makePlunges(8, 1,  { mood: null, idStart: 1 });
    const rated1  = makePlunges(1, 60, { mood: 3,    idStart: 9 });
    const rated2  = makePlunges(1, 1,  { mood: 3,    idStart: 10 });
    const nudge   = deriveNudge([...unrated, ...rated1, ...rated2]);
    expect(nudge).toBeNull();
  });

  it("produces a valid trending-up nudge with exactly 2 rated plunges per month (minimum threshold)", () => {
    // 2 rated entries per month meets MIN_RATED_PER_MONTH exactly.
    // 6 unrated recent plunges fill out the total-count (≥10) gate.
    //
    // month1 (60 days ago): 2× mood=2  → composite ≈ 0.25
    // month2 (1 day ago):   2× mood=5  → composite = 1.00
    // delta ≈ +0.75  →  trending-up
    const unrated = makePlunges(6, 1,  { mood: null, idStart: 1 });
    const rated1  = makePlunges(2, 60, { mood: 2,    idStart: 7 });
    const rated2  = makePlunges(2, 1,  { mood: 5,    idStart: 9 });
    const nudge   = deriveNudge([...unrated, ...rated1, ...rated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("trending-up");
  });

  it("produces a valid holding-steady nudge with exactly 2 rated plunges per month", () => {
    // 2 rated entries per month meets MIN_RATED_PER_MONTH exactly.
    // Identical mood → delta = 0 → holding-steady.
    //
    // month1 (60 days ago): 2× mood=3  → composite = 0.50
    // month2 (1 day ago):   2× mood=3  → composite = 0.50
    // delta = 0.00  →  |delta| ≤ 0.05  →  holding-steady
    const unrated = makePlunges(6, 1,  { mood: null, idStart: 1 });
    const rated1  = makePlunges(2, 60, { mood: 3,    idStart: 7 });
    const rated2  = makePlunges(2, 1,  { mood: 3,    idStart: 9 });
    const nudge   = deriveNudge([...unrated, ...rated1, ...rated2]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("holding-steady");
  });

  it("sweet-spot bucket counts only rated plunges (unrated in same bucket are ignored)", () => {
    // bestBucket first filters to rated entries (mood != null), so:
    //   - 10 rated in the high-mood bucket (50°F / 240s → "45–50°F" / "3–6 min")
    //   - 5 unrated in a DIFFERENT bucket (55°F / 300s → "50–55°F" / "3–6 min")
    // The unrated entries must not pollute the high-mood bucket's score or be
    // counted in the rated set, so the sweet-spot must still land on "45–50°F".
    const rated   = makePlunges(10, 3, { mood: 5, temperature: 50, duration: 240, idStart: 1  });
    const unrated = makePlunges(5,  2, { mood: null, temperature: 55, duration: 300, idStart: 11 });
    // total = 15; single month → no trend; 10 rated in same bucket → sweet-spot
    const nudge = deriveNudge([...rated, ...unrated]);
    expect(nudge).not.toBeNull();
    expect(nudge!.kind).toBe("sweet-spot");
    // temperature=50 falls in [50, 55) → "50–55°F" bucket; the sweet-spot must
    // reference the rated bucket, not the unrated one ("55–60°F" at temp=55).
    expect(nudge!.body).toMatch(/50–55°F/);
  });
});

// ── Dismiss-key component tests ───────────────────────────────────────────────

const DISMISS_KEY = "coldstreak-try-next-dismissed-plunge";

/**
 * Enough plunges (recent, same month) to guarantee the sweet-spot nudge.
 * Each plunge gets a unique createdAt so that the sort in TryThisNextCard is
 * deterministic: the plunge with the highest id is the most recent.
 */
function recentRatedPlunges(count = 10, idStart = 1): Plunge[] {
  return Array.from({ length: count }, (_, i) =>
    makePlunge({
      id:          idStart + i,
      // Higher id → more recent (less hours ago); all within last 4 days.
      createdAt:   new Date(Date.now() - (count - i) * 60 * 60 * 1000), // 1 hour apart
      mood:        4,
      temperature: 50,
      duration:    240,
    }),
  );
}

describe("TryThisNextCard dismiss-key behaviour", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the card when no dismiss key is set", () => {
    render(<TryThisNextCard plunges={recentRatedPlunges()} />);
    expect(screen.getByTestId("try-this-next-card")).toBeInTheDocument();
  });

  it("hides the card after the dismiss button is clicked", () => {
    render(<TryThisNextCard plunges={recentRatedPlunges()} />);
    fireEvent.click(screen.getByTestId("button-dismiss-try-next"));
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();
  });

  it("persists the dismissed plunge ID to localStorage on dismiss", () => {
    const plunges = recentRatedPlunges(); // latest id = idStart + count - 1 = 10
    render(<TryThisNextCard plunges={plunges} />);
    fireEvent.click(screen.getByTestId("button-dismiss-try-next"));
    // The latest plunge (highest id = 10) should be stored
    expect(localStorage.getItem(DISMISS_KEY)).toBe("10");
  });

  it("shows the card again when a new plunge is added after dismissal", () => {
    const original = recentRatedPlunges(10, 1); // ids 1..10
    const { rerender } = render(<TryThisNextCard plunges={original} />);

    // Dismiss against plunge id=10
    fireEvent.click(screen.getByTestId("button-dismiss-try-next"));
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();

    // A new plunge (id=11) is logged — give it a timestamp newer than all
    // existing plunges (original's most-recent is ~1 hour ago).
    const updated = [
      ...original,
      makePlunge({ id: 11, createdAt: new Date(Date.now() - 60_000), mood: 4, temperature: 50, duration: 240 }),
    ];
    rerender(<TryThisNextCard plunges={updated} />);

    // The latest id is now 11, which doesn't match the stored dismiss id (10)
    expect(screen.getByTestId("try-this-next-card")).toBeInTheDocument();
  });

  it("remains hidden when the same plunges are re-rendered after dismissal", () => {
    const plunges = recentRatedPlunges();
    const { rerender } = render(<TryThisNextCard plunges={plunges} />);
    fireEvent.click(screen.getByTestId("button-dismiss-try-next"));

    rerender(<TryThisNextCard plunges={plunges} />);
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();
  });

  it("shows the card again when a sync delivers a plunge with a higher id than the stored dismiss key", () => {
    // Simulate: user dismissed against plunge id=42 (stored in localStorage from a
    // previous session or device), then a sync arrives carrying plunge id=43.
    // The dismiss key no longer matches the new latest id, so the card must reappear.
    const beforeSync = recentRatedPlunges(10, 33); // ids 33..42; latest = 42
    localStorage.setItem(DISMISS_KEY, "42");

    const { rerender } = render(<TryThisNextCard plunges={beforeSync} />);
    // Card is hidden because stored key matches latest id (42 === 42)
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();

    // Sync delivers a new plunge with id=43 (higher than the stored dismiss key)
    const afterSync = [
      ...beforeSync,
      makePlunge({ id: 43, createdAt: new Date(Date.now() - 30_000), mood: 4, temperature: 50, duration: 240 }),
    ];
    rerender(<TryThisNextCard plunges={afterSync} />);

    // Latest id is now 43, which no longer matches the stored dismiss key (42)
    expect(screen.getByTestId("try-this-next-card")).toBeInTheDocument();
  });

  it("stays hidden when the plunge list is refreshed but the latest id is unchanged", () => {
    // Simulate a background data refresh (e.g. React Query re-fetch) that returns
    // the same plunges — the dismiss key must still suppress the card.
    const plunges = recentRatedPlunges(10, 33); // ids 33..42; latest = 42
    localStorage.setItem(DISMISS_KEY, "42");

    const { rerender } = render(<TryThisNextCard plunges={plunges} />);
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();

    // Re-render with a fresh array reference but identical content (same latest id)
    rerender(<TryThisNextCard plunges={[...plunges]} />);
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();
  });
});
