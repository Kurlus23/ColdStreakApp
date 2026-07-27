/**
 * Server-side nudge computation — mirrors the logic in
 * client/src/components/TryThisNextCard.tsx.
 *
 * Returns null when:
 *   - fewer than 10 plunges exist
 *   - the user hasn't plunged in 7+ days (WelcomeBack territory)
 *   - there isn't enough data to derive a meaningful nudge
 */

import { type Plunge } from "@shared/schema";

// ── Month-over-month composite trend ─────────────────────────────────────────

function computeMonthTrendDelta(plunges: Plunge[]): number | null {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length === 0) return null;

  type MonthAcc = {
    moodSum: number; energySum: number; focusSum: number;
    moodC: number; energyC: number; focusC: number;
  };
  const map = new Map<string, MonthAcc>();

  for (const p of rated) {
    const d   = new Date(p.createdAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    if (!map.has(key)) {
      map.set(key, { moodSum: 0, energySum: 0, focusSum: 0, moodC: 0, energyC: 0, focusC: 0 });
    }
    const s = map.get(key)!;
    if (p.mood       != null) { s.moodSum   += p.mood;       s.moodC++;   }
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyC++; }
    if (p.moodFocus  != null) { s.focusSum  += p.moodFocus;  s.focusC++;  }
  }

  const months = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 2) return null;

  const composite = ([, s]: [string, MonthAcc]) => {
    const parts: number[] = [];
    if (s.moodC   > 0) parts.push((s.moodSum   / s.moodC   - 1) / 4);
    if (s.energyC > 0) parts.push((s.energySum / s.energyC - 1) / 2);
    if (s.focusC  > 0) parts.push((s.focusSum  / s.focusC  - 1) / 2);
    return parts.length > 0 ? parts.reduce((a, v) => a + v, 0) / parts.length : 0;
  };

  return composite(months[months.length - 1]) - composite(months[0]);
}

// ── Sweet-spot fallback ───────────────────────────────────────────────────────

const TEMP_BANDS = [
  { min: 0,   max: 40,  label: "35–40°F" },
  { min: 40,  max: 45,  label: "40–45°F" },
  { min: 45,  max: 50,  label: "45–50°F" },
  { min: 50,  max: 55,  label: "50–55°F" },
  { min: 55,  max: 60,  label: "55–60°F" },
  { min: 60,  max: 999, label: "60°F+"   },
] as const;

const DUR_BANDS = [
  { min: 0,   max: 90,       label: "< 1.5 min" },
  { min: 90,  max: 180,      label: "1.5–3 min" },
  { min: 180, max: 360,      label: "3–6 min"   },
  { min: 360, max: Infinity, label: "6+ min"    },
] as const;

function bestBucket(plunges: Plunge[]): { tempLabel: string; durLabel: string } | null {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length < 10) return null;

  const map = new Map<string, {
    tempLabel: string; durLabel: string;
    moodSum: number; energySum: number; count: number; moodC: number; energyC: number;
  }>();

  for (const p of rated) {
    const tb  = TEMP_BANDS.find((b) => p.temperature >= b.min && p.temperature < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1];
    const db  = DUR_BANDS.find((b) => p.duration >= b.min && p.duration < b.max) ?? DUR_BANDS[DUR_BANDS.length - 1];
    const key = `${tb.label}||${db.label}`;
    if (!map.has(key)) {
      map.set(key, { tempLabel: tb.label, durLabel: db.label, moodSum: 0, energySum: 0, count: 0, moodC: 0, energyC: 0 });
    }
    const b = map.get(key)!;
    b.count++;
    if (p.mood       != null) { b.moodSum   += p.mood;       b.moodC++;   }
    if (p.moodEnergy != null) { b.energySum += p.moodEnergy; b.energyC++; }
  }

  let best: { tempLabel: string; durLabel: string; score: number } | null = null;

  for (const b of Array.from(map.values())) {
    if (b.count < 3) continue;
    const avgMood   = b.moodC   > 0 ? b.moodSum   / b.moodC   : 0;
    const avgEnergy = b.energyC > 0 ? b.energySum / b.energyC : null;
    const mn    = (avgMood - 1) / 4;
    const en    = avgEnergy != null ? (avgEnergy - 1) / 2 : mn;
    const score = (mn + en) / 2;
    if (!best || score > best.score) best = { tempLabel: b.tempLabel, durLabel: b.durLabel, score };
  }

  return best ? { tempLabel: best.tempLabel, durLabel: best.durLabel } : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface NudgePayload {
  title: string;
  body:  string;
}

/**
 * Derive the "Try this next" nudge for the given plunge history.
 *
 * Returns null when there isn't enough data or the user has been away 7+ days
 * (WelcomeBack territory — no overlap).
 */
export function deriveNudgeForPush(plunges: Plunge[]): NudgePayload | null {
  if (plunges.length < 10) return null;

  // Suppress when the user has been away ≥7 days (WelcomeBack owns that state)
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const daysSince = Math.floor(
    (Date.now() - new Date(sorted[0].createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince >= 7) return null;

  // Primary: month-over-month trend direction
  const delta = computeMonthTrendDelta(plunges);

  if (delta !== null) {
    if (delta > 0.05) {
      return {
        title: "📈 Ready for a challenge",
        body:  "Your check-in scores are trending up — consider dropping 2–3°F or adding 30 seconds to your next session and see how you feel.",
      };
    }

    if (delta < -0.05) {
      return {
        title: "🌡️ Listen to your body",
        body:  "Your recent check-in ratings have dipped a little. Try dialling back slightly — a warmer temperature or shorter duration can help you stay consistent without burning out.",
      };
    }

    // Holding steady
    return {
      title: "🎯 Stay the course",
      body:  "Your ratings have been consistent — you're in a solid rhythm. Commit to your current temperature and duration for another few sessions before experimenting.",
    };
  }

  // Fallback: sweet-spot bucket
  const spot = bestBucket(plunges);
  if (spot) {
    return {
      title: "⭐ Hit your sweet spot",
      body:  `Your sweet spot so far is ${spot.tempLabel} for ${spot.durLabel} — try to hit it in your next 3 plunges and keep the momentum going.`,
    };
  }

  return null;
}
