/**
 * TryThisNextCard — personalised "Try this next" nudge surfaced below the
 * ColdAdaptationCard.
 *
 * The nudge is driven by the user's adaptation trend direction:
 *   - Trending up   → challenge suggestion (drop temp or add time)
 *   - Holding steady → consistency nudge (maintain and commit)
 *   - Trending down  → supportive recovery nudge (ease up, rest, listen to body)
 *
 * If there isn't enough month-over-month data yet but 10+ rated plunges exist,
 * falls back to surfacing the sweet-spot bucket as a practical target.
 *
 * WelcomeBackCard owns all "you've been away" messaging — this card never
 * duplicates it. The card is suppressed when the user hasn't plunged in 7+ days
 * so the two cards don't stack.
 *
 * Dismissable per "plunge epoch" (keyed to the most-recent plunge ID so it
 * auto-refreshes after every new plunge).
 *
 * Requires at least 10 total plunges to show anything.
 */

import { useState } from "react";
import { type Plunge } from "@shared/schema";

interface Props {
  plunges: Plunge[];
}

const DISMISS_KEY = "coldstreak-try-next-dismissed-plunge";

// ── Trend delta (mirrors ColdAdaptationCard composite logic) ──────────────────

/**
 * Returns the month-over-month composite delta (last month − first month).
 * Null means fewer than 2 months of rated data.
 */
function computeMonthTrendDelta(plunges: Plunge[]): number | null {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length === 0) return null;

  type MonthAcc = { moodSum: number; energySum: number; focusSum: number; moodC: number; energyC: number; focusC: number };
  const map = new Map<string, MonthAcc>();

  for (const p of rated) {
    const d   = new Date(p.createdAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { moodSum: 0, energySum: 0, focusSum: 0, moodC: 0, energyC: 0, focusC: 0 });
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

  const map = new Map<string, { tempLabel: string; durLabel: string; moodSum: number; energySum: number; count: number; moodC: number; energyC: number }>();

  for (const p of rated) {
    const tb  = TEMP_BANDS.find((b) => p.temperature >= b.min && p.temperature < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1];
    const db  = DUR_BANDS.find((b) => p.duration >= b.min && p.duration < b.max) ?? DUR_BANDS[DUR_BANDS.length - 1];
    const key = `${tb.label}||${db.label}`;
    if (!map.has(key)) map.set(key, { tempLabel: tb.label, durLabel: db.label, moodSum: 0, energySum: 0, count: 0, moodC: 0, energyC: 0 });
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

// ── Recent session averages ───────────────────────────────────────────────────

interface RecentAverages {
  avgTempF: number;   // average temperature of last 5 plunges (°F)
  avgDurSec: number;  // average duration of last 5 plunges (seconds)
}

function recentAverages(plunges: Plunge[]): RecentAverages | null {
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const recent = sorted.slice(0, 5);
  if (recent.length === 0) return null;
  return {
    avgTempF:  Math.round(recent.reduce((s, p) => s + p.temperature, 0) / recent.length),
    avgDurSec: Math.round(recent.reduce((s, p) => s + p.duration,    0) / recent.length),
  };
}

// ── Temperature-aware progression suggestion ──────────────────────────────────

/**
 * Returns a personalised challenge nudge for users whose scores are trending up.
 *
 * Temperature tiers (°F):
 *   ≥ 52  → concrete colder-temp suggestion (floor: recommended target ≥ 40°F)
 *   46–51 → duration first if sessions are short; small temp step if longer
 *   40–45 → already advanced — affirm consistency, don't push colder
 *   < 40  → elite territory — never suggest going colder
 */
function trendingUpNudge(recents: RecentAverages): { title: string; body: string } {
  const { avgTempF, avgDurSec } = recents;

  // Elite tier — already in the extreme cold
  if (avgTempF < 40) {
    return {
      title: "Elite cold exposure",
      body:  `You're regularly plunging below 40°F — that's serious work. Focus on consistency rather than going colder; at these temperatures, showing up is the achievement.`,
    };
  }

  // Advanced tier (40–45°F) — don't push colder, affirm
  if (avgTempF <= 45) {
    return {
      title: "Advanced territory",
      body:  `At ~${avgTempF}°F you're already in the deep end. Your scores are trending up — keep that consistency going. Duration is the lever to pull here if you want a new challenge.`,
    };
  }

  // Intermediate tier (46–51°F)
  if (avgTempF <= 51) {
    if (avgDurSec < 150) {
      // Short sessions — build duration before going colder
      const targetSec = Math.min(avgDurSec + 45, 300);
      const targetMin = Math.floor(targetSec / 60);
      const targetRemSec = targetSec % 60;
      const targetLabel = targetMin > 0
        ? `${targetMin}:${String(targetRemSec).padStart(2, "0")}`
        : `${targetSec}s`;
      return {
        title: "Build your time first",
        body:  `Your scores are improving at ${avgTempF}°F. Before going colder, try extending your session to around ${targetLabel} — building duration at your current temp is the safer next step.`,
      };
    }
    // Longer sessions — small temp drop
    const targetTemp = Math.max(40, avgTempF - 2);
    return {
      title: "Ready to go a little colder",
      body:  `Your sessions at ~${avgTempF}°F are paying off. Try dropping to ${targetTemp}°F on your next plunge — a 2°F step is enough to feel the difference without a big shock.`,
    };
  }

  // Warmer tier (52°F+) — clear colder suggestion
  const targetTemp = Math.max(40, avgTempF - 3);
  return {
    title: "Time to nudge it colder",
    body:  `You've been plunging around ${avgTempF}°F and your scores are trending up — that's a sign your body is adapting. Try ${targetTemp}°F on your next session and see how you feel.`,
  };
}

// ── Nudge derivation ──────────────────────────────────────────────────────────

type NudgeKind = "trending-up" | "holding-steady" | "trending-down" | "sweet-spot";

interface Nudge {
  kind:    NudgeKind;
  icon:    string;
  title:   string;
  body:    string;
  borderClass: string;
  bgClass:     string;
}

export function deriveNudge(plunges: Plunge[]): Nudge | null {
  if (plunges.length < 10) return null;

  // Suppress this card when WelcomeBackCard is already visible (7+ day gap)
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const daysSince = Math.floor(
    (Date.now() - new Date(sorted[0].createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSince >= 7) return null;

  const recents = recentAverages(plunges);

  // Primary: trend direction
  const delta = computeMonthTrendDelta(plunges);

  if (delta !== null) {
    if (delta > 0.05) {
      const { title, body } = recents
        ? trendingUpNudge(recents)
        : { title: "Ready for a challenge", body: "Your check-in scores are trending up — consider dropping 2–3°F or adding 30 seconds to your next session and see how you feel." };
      return {
        kind: "trending-up",
        icon: recents && recents.avgTempF <= 45 ? "🏆" : "📈",
        title,
        body,
        borderClass: "border-emerald-500/40",
        bgClass:     "bg-emerald-900/20",
      };
    }

    if (delta < -0.05) {
      return {
        kind:        "trending-down",
        icon:        "🌡️",
        title:       "Listen to your body",
        body:        "Your recent check-in ratings have dipped a little. Try dialling back slightly — a warmer temperature or shorter duration can help you stay consistent without burning out.",
        borderClass: "border-amber-500/40",
        bgClass:     "bg-amber-900/20",
      };
    }

    // Holding steady (|delta| ≤ 0.05)
    return {
      kind:        "holding-steady",
      icon:        "🎯",
      title:       "Stay the course",
      body:        "Your ratings have been consistent — you're in a solid rhythm. Commit to your current temperature and duration for another few sessions before experimenting.",
      borderClass: "border-blue-500/40",
      bgClass:     "bg-blue-900/30",
    };
  }

  // Fallback: not enough months yet — use sweet-spot bucket
  const spot = bestBucket(plunges);
  if (spot) {
    return {
      kind:        "sweet-spot",
      icon:        "⭐",
      title:       "Hit your sweet spot",
      body:        `Your sweet spot so far is ${spot.tempLabel} for ${spot.durLabel} — try to hit it in your next 3 plunges and keep the momentum going.`,
      borderClass: "border-cyan-500/30",
      bgClass:     "bg-blue-950/60",
    };
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TryThisNextCard({ plunges }: Props) {
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestId = sorted[0]?.id ?? null;

  const [dismissedId, setDismissedId] = useState<string | null>(
    () => localStorage.getItem(DISMISS_KEY),
  );

  const nudge = deriveNudge(plunges);

  if (!nudge) return null;
  if (latestId != null && dismissedId === String(latestId)) return null;

  const dismiss = () => {
    if (latestId == null) return;
    localStorage.setItem(DISMISS_KEY, String(latestId));
    setDismissedId(String(latestId));
  };

  return (
    <div
      data-testid="try-this-next-card"
      className={`mb-4 rounded-2xl border ${nudge.borderClass} ${nudge.bgClass} p-4 shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1">
          <span className="text-xl leading-none mt-0.5">{nudge.icon}</span>
          <div>
            <p className="text-blue-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5">
              Try this next
            </p>
            <p className="text-white text-sm font-semibold leading-snug mb-1">
              {nudge.title}
            </p>
            <p className="text-blue-300 text-[11px] leading-relaxed">
              {nudge.body}
            </p>
          </div>
        </div>
        <button
          data-testid="button-dismiss-try-next"
          onClick={dismiss}
          className="text-blue-500 hover:text-blue-300 text-lg leading-none shrink-0 transition-colors mt-0.5"
          aria-label="Dismiss suggestion"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
