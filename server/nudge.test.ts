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

const BASE_DATE = new Date("2026-06-15T12:00:00Z");

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
 * The caller supplies a `moodFn` to control the composite score direction.
 */
function makeTwoMonthPlunges(
  count: number,
  moodFn: (index: number, isSecondMonth: boolean) => number,
  opts: { temperature?: number; duration?: number } = {},
): Plunge[] {
  const result: Plunge[] = [];
  const half = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    const isSecondMonth = i >= half;
    const date = new Date(BASE_DATE);
    // First half → January 2026; second half → February 2026
    date.setUTCMonth(isSecondMonth ? 1 : 0);
    date.setUTCDate(i + 1);

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

  // Most recent plunge is today so the 7-day suppression doesn't fire
  result[result.length - 1] = makePlunge({
    ...result[result.length - 1],
    createdAt: new Date(),
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

// ── trending-up (generic fallback path) ──────────────────────────────────────

describe("nudge message parity — trending-up generic copy", () => {
  /**
   * The client's trendingUpNudge() generates temperature-aware personalised
   * copy which is intentionally different from the server push.  This test
   * focuses on the shared string constants used by both sides, verifying that
   * the NUDGE_MESSAGES.trendingUp values themselves are consistent between what
   * the server emits and what the client would fall back to when no recent
   * averages are available.
   *
   * The server always uses the generic copy, so we verify that directly.
   */

  // Scores rise in the second month (delta >> 0.05)
  const plunges = makeTwoMonthPlunges(14, (_, isSecondMonth) =>
    isSecondMonth ? 5 : 1,
  );

  it("server body matches shared constant", () => {
    const push = deriveNudgeForPush(plunges);
    expect(push).not.toBeNull();
    expect(push!.body).toBe(NUDGE_MESSAGES.trendingUp.body);
  });

  it("server title (stripped of emoji) matches shared constant title", () => {
    const push = deriveNudgeForPush(plunges)!;
    expect(stripEmoji(push.title)).toBe(NUDGE_MESSAGES.trendingUp.title);
  });

  it("client emits trending-up kind", () => {
    const card = deriveNudge(plunges);
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("trending-up");
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
