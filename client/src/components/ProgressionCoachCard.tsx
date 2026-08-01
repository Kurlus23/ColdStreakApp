import { useMemo, useState } from "react";
import { type Plunge } from "@shared/schema";
import { SEGMENTS, type SegmentId, computeThresholds } from "@/lib/benefitSegments";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(Math.round(s) % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toLocaleDateString();
}

type TimeBucket = "morning" | "afternoon" | "evening";
function getTimeBucket(d: Date): TimeBucket {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "evening";
}

const PROG_KEY = "cs-progression-coach-dismissed";
const TOD_KEY  = "cs-tod-coach-dismissed";

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  plunges:       Plunge[];
  primaryBenefit: SegmentId;
  temperature:   number;
  bodyWeightLbs: number;
  bodyHeightCm:  number;
  bodyFatPct?:   number | null;
}

export function ProgressionCoachCard({
  plunges, primaryBenefit, temperature, bodyWeightLbs, bodyHeightCm, bodyFatPct,
}: Props) {
  const [progDismissed, setProgDismissed] = useState(
    () => localStorage.getItem(PROG_KEY) === todayStr(),
  );
  const [todDismissed, setTodDismissed] = useState(
    () => localStorage.getItem(TOD_KEY) === todayStr(),
  );

  // ── Progression coaching ────────────────────────────────────────────────────
  const progressionCard = useMemo(() => {
    if (progDismissed) return null;

    const today = todayStr();
    const recent = plunges
      .filter(p => new Date(p.createdAt).toLocaleDateString() !== today)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    if (recent.length < 5) return null;

    const avgDur = recent.reduce((s, p) => s + p.duration, 0) / recent.length;
    const thresholds = computeThresholds(temperature, bodyWeightLbs, bodyHeightCm, bodyFatPct);
    const primaryIdx  = SEGMENTS.findIndex(s => s.id === primaryBenefit);
    const goalSecs    = thresholds[primaryIdx];
    const seg         = SEGMENTS[primaryIdx];
    const shortfall   = goalSecs - avgDur;

    if (shortfall <= 15) return null; // already hitting goal

    const suggestion = shortfall <= 60
      ? `Try pushing to ${fmtSecs(goalSecs)} today.`
      : `Try adding 30 seconds today.`;
    const detail = shortfall <= 60
      ? `${fmtSecs(Math.round(shortfall))} short of ${seg.emoji} ${seg.label}`
      : `Averaging ${fmtSecs(Math.round(avgDur))} · ${seg.emoji} ${seg.label} needs ${fmtSecs(goalSecs)}`;

    return { seg, headline: shortfall <= 60 ? "You're close!" : "Level up", suggestion, detail };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plunges, primaryBenefit, temperature, bodyWeightLbs, bodyHeightCm, bodyFatPct, progDismissed]);

  // ── Time-of-day coaching ────────────────────────────────────────────────────
  const todCard = useMemo(() => {
    if (todDismissed || progressionCard) return null; // progression takes priority

    const withMood = plunges.filter(p => p.mood != null);
    if (withMood.length < 8) return null;

    const buckets: Record<TimeBucket, number[]> = { morning: [], afternoon: [], evening: [] };
    for (const p of withMood) {
      buckets[getTimeBucket(new Date(p.createdAt))].push(p.mood!);
    }

    const morningScores = buckets.morning;
    const otherScores   = [...buckets.afternoon, ...buckets.evening];
    if (morningScores.length < 3 || otherScores.length < 3) return null;

    const avgMorning = morningScores.reduce((a, b) => a + b, 0) / morningScores.length;
    const avgOther   = otherScores.reduce((a, b) => a + b, 0) / otherScores.length;
    const diff       = avgMorning - avgOther;
    if (Math.abs(diff) < 0.5) return null;

    const betterBucket = diff > 0 ? "morning" : "evening";
    if (getTimeBucket(new Date()) === betterBucket) return null; // already in best slot

    const pct = Math.round(Math.abs(diff) / Math.max(avgMorning, avgOther) * 100);
    return { betterBucket, pct };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plunges, progressionCard, todDismissed]);

  if (!progressionCard && !todCard) return null;

  // ── Progression card ────────────────────────────────────────────────────────
  if (progressionCard) {
    return (
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: "rgba(6,182,212,0.06)",
          border: "1px solid rgba(34,211,238,0.12)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: progressionCard.seg.barColor }}
            >
              {progressionCard.seg.emoji} {progressionCard.headline}
            </p>
            <p className="text-white text-xs font-medium leading-snug">
              {progressionCard.suggestion}
            </p>
            <p className="text-blue-400/70 text-[10px] leading-snug">
              {progressionCard.detail}
            </p>
          </div>
          <button
            onClick={() => { localStorage.setItem(PROG_KEY, todayStr()); setProgDismissed(true); }}
            className="text-blue-600 hover:text-blue-400 text-[10px] shrink-0 mt-0.5 transition-colors"
            aria-label="Dismiss coaching tip"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // ── Time-of-day card ────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "rgba(6,182,212,0.06)",
        border: "1px solid rgba(34,211,238,0.12)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            🕐 Timing insight
          </p>
          <p className="text-white text-xs font-medium leading-snug">
            Your {todCard!.betterBucket} plunges score {todCard!.pct}% higher on mood.
          </p>
          <p className="text-blue-400/70 text-[10px] leading-snug">
            Consider moving today's session to the {todCard!.betterBucket}.
          </p>
        </div>
        <button
          onClick={() => { localStorage.setItem(TOD_KEY, todayStr()); setTodDismissed(true); }}
          className="text-blue-600 hover:text-blue-400 text-[10px] shrink-0 mt-0.5 transition-colors"
          aria-label="Dismiss timing tip"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
