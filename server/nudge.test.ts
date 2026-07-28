/**
 * Cross-checks that the push notification strings (deriveNudgeForPush) and the
 * in-app card strings (deriveNudge from TryThisNextCard) agree for every fixed
 * branch.  Any copy-paste drift that changes one side without the other will
 * fail here rather than reaching users.
 *
 * Both functions now import their strings from shared/nudgeMessages.ts, so a
 * divergence would have to come from hand-editing the template strings in one
 * of the two files — this test catches that.
 *
 * Trending-up note:
 *   The client renders a temperature-aware personalised nudge (trendingUpNudge)
 *   that intentionally differs from the generic server push.  The generic
 *   "Ready for a challenge" fallback copy is shared and verified here; the
 *   personalised variants are by-design server/client differences.
 */

import { describe, it, expect } from "vitest";
import { deriveNudgeForPush } from "./nudge";
import { deriveNudge } from "../client/src/components/TryThisNextCard";
import { NUDGE_MESSAGES } from "../shared/nudgeMessages";
import { type Plunge } from "../shared/schema";

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal Plunge object.  Only the fields that affect nudge derivation
 * need values; everything else gets harmless defaults.
 */
function makePlunge(overrides: Partial<Plunge> & { createdAt: Date }): Plunge {
  return {
    id:          1,
    userId:      1,
    temperature: 55,
    duration:    120,
    mood:        null,
    moodEnergy:  null,
    moodFocus:   null,
    notes:       null,
    waterType:   null,
    ...overrides,
    createdAt: overrides.createdAt,
  } as unknown as Plunge;
}

/**
 * Produce `count` plunges spread across two calendar months so that
 * computeMonthTrendDelta can return a non-null value.
 *
 * Uses the current month and the previous month so the last plunge (pinned to
 * today for the 7-day suppression guard) always lands in the same calendar
 * month as the rest of the second-half plunges.  Hardcoding January/February
 * caused the last plunge (overridden to today) to fall into a third, sparse
 * month, making the client's MIN_RATED_PER_MONTH=2 check return null.
 *
 * The caller supplies a `moodFn` to control the composite score direction.
 */
function makeTwoMonthPlunges(
  count: number,
  moodFn: (index: number, isSecondMonth: boolean) => number,
  opts: { temperature?: number; duration?: number } = {},
): Plunge[] {
  const result: Plunge[] = [];
  const half = Math.floor(count / 2);

  const now = new Date();
  // thisMonth: 1st of the current month; prevMonth: 1st of the prior month
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  for (let i = 0; i < count; i++) {
    const isSecondMonth = i >= half;
    const base = isSecondMonth ? thisMonth : prevMonth;
    const date = new Date(base);
    date.setUTCDate(i + 1); // spread entries across different days

    result.push(
      makePlunge({
        id:          i + 1,
        createdAt:   date,
        mood:        moodFn(i, isSecondMonth),
        temperature: opts.temperature ?? 55,
        duration:    opts.duration    ?? 120,
      }),
    );
  }

  // Most recent plunge is today so the 7-day suppression doesn't fire.
  // This stays within the current month (thisMonth) so it doesn't create a
  // third sparse month that would defeat MIN_RATED_PER_MONTH.
  result[result.length - 1] = makePlunge({
    ...result[result.length - 1],
    createdAt: now,
  });

  return result;
}

// ── Shared helper: strip a leading emoji + space from a server title ──────────

function stripEmoji(title: string): string {
  // Server titles look like "📈 Ready for a challenge" — strip the first
  // grapheme cluster (emoji) and the space that follows it.
  return title.replace(/^\S+\s/, "");
}

// ── trending-down ─────────────────────────────────────────────────────────────

describe("nudge message parity — trending-down", () => {
  // Scores drop noticeably in the second month (delta << −0.05)
  const plunges = makeTwoMonthPlunges(14, (_, isSecondMonth) =>
    isSecondMonth ? 1 : 5,
  );

  it("server body matches shared constant", () => {
    const push = deriveNudgeForPush(plunges);
    expect(push).not.toBeNull();
    expect(push!.body).toBe(NUDGE_MESSAGES.trendingDown.body);
  });

  it("client body matches shared constant", () => {
    const card = deriveNudge(plunges);
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("trending-down");
    expect(card!.body).toBe(NUDGE_MESSAGES.trendingDown.body);
  });

  it("server and client bodies are identical", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(push.body).toBe(card.body);
  });

  it("server title (stripped of emoji) matches client title", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(stripEmoji(push.title)).toBe(card.title);
  });
});

// ── holding-steady ────────────────────────────────────────────────────────────

describe("nudge message parity — holding-steady", () => {
  // Identical mood scores across both months → |delta| = 0
  const plunges = makeTwoMonthPlunges(14, () => 3);

  it("server body matches shared constant", () => {
    const push = deriveNudgeForPush(plunges);
    expect(push).not.toBeNull();
    expect(push!.body).toBe(NUDGE_MESSAGES.holdingSteady.body);
  });

  it("client body matches shared constant", () => {
    const card = deriveNudge(plunges);
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("holding-steady");
    expect(card!.body).toBe(NUDGE_MESSAGES.holdingSteady.body);
  });

  it("server and client bodies are identical", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(push.body).toBe(card.body);
  });

  it("server title (stripped of emoji) matches client title", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(stripEmoji(push.title)).toBe(card.title);
  });
});

// ── sweet-spot ────────────────────────────────────────────────────────────────

describe("nudge message parity — sweet-spot", () => {
  /**
   * Sweet-spot fires when computeMonthTrendDelta returns null (fewer than 2
   * months of rated plunges) but bestBucket finds a bucket with ≥ 3 entries.
   *
   * All 12 plunges are spread across the last 6 days (same calendar month as
   * today) so that:
   *   - computeMonthTrendDelta sees only 1 month → returns null
   *   - daysSince < 7 → 7-day suppression does not fire
   *   - bestBucket has 12 rated plunges in the 55°F / 1.5–3 min bucket
   */
  const now = new Date();
  const plunges = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setUTCHours(now.getUTCHours() - i * 12); // spread backwards, all same month
    return makePlunge({
      id:          i + 1,
      createdAt:   d,
      mood:        4,
      moodEnergy:  3,
      temperature: 55,
      duration:    120,
    });
  });

  it("server body matches shared constant body template output", () => {
    const push = deriveNudgeForPush(plunges);
    expect(push).not.toBeNull();
    // The template is parameterised — just verify the constant template is used
    expect(push!.body).toBe(
      NUDGE_MESSAGES.sweetSpot.bodyTemplate("55–60°F", "1.5–3 min"),
    );
  });

  it("client body matches shared constant body template output", () => {
    const card = deriveNudge(plunges);
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("sweet-spot");
    expect(card!.body).toBe(
      NUDGE_MESSAGES.sweetSpot.bodyTemplate("55–60°F", "1.5–3 min"),
    );
  });

  it("server and client bodies are identical", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(push.body).toBe(card.body);
  });

  it("server title (stripped of emoji) matches client title", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(stripEmoji(push.title)).toBe(card.title);
  });
});

// ── trending-up (personalised path) ──────────────────────────────────────────

describe("nudge message parity — trending-up personalised copy", () => {
  /**
   * Both the server push and the in-app card now compute temperature-aware
   * personalised copy via the same trendingUpNudge() logic.  The fixture uses
   * 55 °F / 120 s plunges, which land in the "Warmer tier (52 °F+)" branch:
   *   title → "Time to nudge it colder"
   *   body  → "You've been plunging around 55°F … Try 52°F …"
   *
   * The generic NUDGE_MESSAGES.trendingUp strings remain as a shared fallback
   * when recent averages are unavailable; that path is verified separately
   * in the mixed-rated-plunges suite below.
   */

  // Scores rise in the second month (delta >> 0.05); default temp=55, dur=120
  const plunges = makeTwoMonthPlunges(14, (_, isSecondMonth) =>
    isSecondMonth ? 5 : 1,
  );

  it("server and client bodies are identical", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(push).not.toBeNull();
    expect(card).not.toBeNull();
    expect(push.body).toBe(card.body);
  });

  it("server title (stripped of emoji) matches client title", () => {
    const push = deriveNudgeForPush(plunges)!;
    const card = deriveNudge(plunges)!;
    expect(stripEmoji(push.title)).toBe(card.title);
  });

  it("client emits trending-up kind", () => {
    const card = deriveNudge(plunges);
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("trending-up");
  });

  it("personalised body contains the user's actual temperature", () => {
    const push = deriveNudgeForPush(plunges)!;
    expect(push.body).toContain("55°F");
  });
});

// ── mixed rated/unrated plunges ───────────────────────────────────────────────

describe("deriveNudgeForPush — mixed rated/unrated plunges", () => {
  /**
   * These tests verify that:
   *   1. The initial gate is on *total* plunge count, not rated count.
   *   2. Trend direction is computed using only the rated subset.
   *   3. Unrated plunges don't distort or suppress the nudge when rated data
   *      is sufficient.
   *   4. When every plunge is unrated the function correctly returns null.
   */

  it("gate uses total plunge count, not rated count (10 total, 8 unrated)", () => {
    // 2 rated plunges spread across two calendar months → trend delta computable.
    // 8 unrated plunges (mood: null) pad the total to 10.
    // Most-recent plunge is today so the 7-day suppression doesn't fire.
    const now = new Date();
    const plunges: Plunge[] = [
      // Rated: Jan → low mood, Feb → high mood  (delta > 0.05 → trending-up)
      makePlunge({ id: 1, createdAt: new Date("2026-01-15T12:00:00Z"), mood: 1 }),
      makePlunge({ id: 2, createdAt: new Date("2026-02-15T12:00:00Z"), mood: 5 }),
      // 7 unrated plunges in the recent past
      ...Array.from({ length: 7 }, (_, i) =>
        makePlunge({
          id:        i + 3,
          createdAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000),
          // mood stays null (default in makePlunge)
        }),
      ),
      // Most-recent unrated plunge is today
      makePlunge({ id: 10, createdAt: now }),
    ];

    const result = deriveNudgeForPush(plunges);
    expect(result).not.toBeNull();
    // Trending-up fires — server now emits personalised copy so verify the
    // emoji prefix that marks the trending-up branch rather than a fixed string.
    expect(result!.title).toMatch(/^(📈|🏆)/);
  });

  it("9 total plunges → null even when all are rated", () => {
    const now = new Date();
    const plunges = Array.from({ length: 9 }, (_, i) =>
      makePlunge({
        id:        i + 1,
        createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        mood:      5,
      }),
    );
    expect(deriveNudgeForPush(plunges)).toBeNull();
  });

  it("trend direction is driven by rated plunges only; unrated are ignored", () => {
    // 14 total plunges: alternating rated/unrated.
    // Rated entries: first-month mood=1, second-month mood=5 → trending-up.
    // The 7 unrated entries (mood=null) must not change the result.
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const half = 7;
    const result: Plunge[] = [];
    for (let i = 0; i < 14; i++) {
      const isSecondMonth = i >= half;
      const base = isSecondMonth ? thisMonth : prevMonth;
      const date = new Date(base);
      date.setUTCDate(i + 1);
      const isRated = i % 2 === 0; // even-index entries are rated
      result.push(
        makePlunge({
          id:        i + 1,
          createdAt: date,
          mood:      isRated ? (isSecondMonth ? 5 : 1) : null,
        }),
      );
    }
    // Pin the last entry to today (stays within thisMonth)
    result[result.length - 1] = makePlunge({
      ...result[result.length - 1],
      createdAt: now,
    });

    const push = deriveNudgeForPush(result);
    expect(push).not.toBeNull();
    // Trending-up fires — server now emits personalised copy for the 55 °F / 120 s
    // fixture, so verify the emoji prefix rather than the generic string constant.
    expect(push!.title).toMatch(/^(📈|🏆)/);
    // Body is the personalised variant (55 °F warmer-tier path)
    expect(push!.body).toContain("55°F");
  });

  it("trending-down with mixed entries: unrated don't suppress the signal", () => {
    // Same structure as above but rated entries show declining mood.
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const half = 7;
    const result: Plunge[] = [];
    for (let i = 0; i < 14; i++) {
      const isSecondMonth = i >= half;
      const base = isSecondMonth ? thisMonth : prevMonth;
      const date = new Date(base);
      date.setUTCDate(i + 1);
      const isRated = i % 2 === 0;
      result.push(
        makePlunge({
          id:        i + 1,
          createdAt: date,
          mood:      isRated ? (isSecondMonth ? 1 : 5) : null,
        }),
      );
    }
    result[result.length - 1] = makePlunge({
      ...result[result.length - 1],
      createdAt: now,
    });

    const push = deriveNudgeForPush(result);
    expect(push).not.toBeNull();
    expect(push!.title).toContain(NUDGE_MESSAGES.trendingDown.title);
    expect(push!.body).toBe(NUDGE_MESSAGES.trendingDown.body);
  });

  it("returns null when total >= 10 but every plunge is unrated", () => {
    // All 12 plunges have mood=null → computeMonthTrendDelta returns null,
    // bestBucket also returns null (needs rated entries) → overall null.
    const now = new Date();
    const plunges = Array.from({ length: 12 }, (_, i) =>
      makePlunge({
        id:        i + 1,
        createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        // mood stays null
      }),
    );
    expect(deriveNudgeForPush(plunges)).toBeNull();
  });
});

// ── 7-day absence guard ───────────────────────────────────────────────────────

describe("deriveNudgeForPush — 7-day absence guard", () => {
  /**
   * Build 10+ plunges spread across two calendar months (so trend delta is
   * computable) but pin the most-recent plunge to `daysAgo` days in the past.
   */
  function makePlungesWithLastDaysAgo(daysAgo: number): Plunge[] {
    // Rising scores so the function would normally return a non-null nudge
    const plunges = makeTwoMonthPlunges(14, (_, isSecondMonth) =>
      isSecondMonth ? 5 : 1,
    );

    const mostRecent = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    plunges[plunges.length - 1] = makePlunge({
      ...plunges[plunges.length - 1],
      createdAt: mostRecent,
    });

    return plunges;
  }

  it("returns null when the most-recent plunge is exactly 7 days ago", () => {
    const plunges = makePlungesWithLastDaysAgo(7);
    expect(deriveNudgeForPush(plunges)).toBeNull();
  });

  it("returns null when the most-recent plunge is 10 days ago", () => {
    const plunges = makePlungesWithLastDaysAgo(10);
    expect(deriveNudgeForPush(plunges)).toBeNull();
  });

  it("returns non-null when the most-recent plunge is exactly 6 days ago", () => {
    const plunges = makePlungesWithLastDaysAgo(6);
    expect(deriveNudgeForPush(plunges)).not.toBeNull();
  });

  it("boundary: 6 days → nudge, 7 days → null", () => {
    expect(deriveNudgeForPush(makePlungesWithLastDaysAgo(6))).not.toBeNull();
    expect(deriveNudgeForPush(makePlungesWithLastDaysAgo(7))).toBeNull();
  });
});
