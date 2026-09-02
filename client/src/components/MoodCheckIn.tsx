import { useEffect, useRef, useState } from "react";
import { useUpdatePlunge } from "@/hooks/use-plunges";
import { type Plunge } from "@shared/schema";
import { type SegmentId } from "@/lib/benefitSegments";
import { Analytics } from "@/lib/analytics";

// ── Scale definitions ──────────────────────────────────────────────────────────

export const MOOD_OPTIONS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low"   },
  { value: 3, emoji: "😐", label: "OK"    },
  { value: 4, emoji: "🙂", label: "Good"  },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

export const ENERGY_OPTIONS = [
  { value: 1, emoji: "💤", label: "Drained"   },
  { value: 2, emoji: "⚡", label: "Neutral"   },
  { value: 3, emoji: "🔋", label: "Energized" },
] as const;

export const FOCUS_OPTIONS = [
  { value: 1, emoji: "🌫️", label: "Worse"  },
  { value: 2, emoji: "🧠", label: "Same"   },
  { value: 3, emoji: "🎯", label: "Better" },
] as const;

export const FATIGUE_OPTIONS = [
  { value: 1, emoji: "😣", label: "Still sore" },
  { value: 2, emoji: "😐", label: "Neutral"    },
  { value: 3, emoji: "💪", label: "Relieved"   },
] as const;

export const RECOVERY_OPTIONS = [
  { value: 1, emoji: "😓", label: "Not yet"  },
  { value: 2, emoji: "😐", label: "Somewhat" },
  { value: 3, emoji: "✨", label: "Restored" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

const DISMISS_KEY = (id: number) => `coldstreak-mood-dismissed-${id}`;

/** 5-minute threshold for a "longer" mood-goal plunge */
const MOOD_LONG_SECS = 300;

function extractMoodId(url: string): number | null {
  try {
    const u = new URL(url, window.location.origin);
    const raw = u.searchParams.get("mood");
    if (!raw) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

interface PickerRowProps<T extends readonly { value: number; emoji: string; label: string }[]> {
  icon: string;
  label: string;
  options: T;
  value: number | null;
  onPick: (v: number) => void;
}

function PickerRow<T extends readonly { value: number; emoji: string; label: string }[]>(
  { icon, label, options, value, onPick }: PickerRowProps<T>
) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-blue-300 text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onPick(opt.value)}
              className={[
                "flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 transition-all active:scale-95 border",
                selected
                  ? "bg-cyan-500/20 border-cyan-400/70 shadow-sm"
                  : "bg-blue-900/50 border-blue-700/40 hover:bg-blue-800/60 hover:border-blue-600/50",
              ].join(" ")}
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <span className={`text-[9px] font-semibold ${selected ? "text-cyan-300" : "text-blue-400"}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Question-set logic ─────────────────────────────────────────────────────────

type QuestionSet = "recovery" | "mood-short" | "mood-long" | "default";

function getQuestionSet(goal: SegmentId, durationSec: number): QuestionSet {
  if (goal === "recovery") return "recovery";
  if (goal === "mood") return durationSec >= MOOD_LONG_SECS ? "mood-long" : "mood-short";
  return "default";
}

function getHeaderText(qset: QuestionSet, isNotif: boolean, ageHours: number): string {
  if (qset === "recovery") return "How's your body feeling after your plunge?";
  if (qset === "mood-short") return "How's your mood after your plunge?";
  if (isNotif) return "How did your plunge affect the rest of your day?";
  return ageHours <= 3
    ? "How did your plunge affect you today?"
    : "How did your last plunge affect the rest of your day?";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MoodCheckIn({
  plunges,
  visible,
  primaryBenefit = "mood",
}: {
  plunges: Plunge[];
  visible: boolean;
  primaryBenefit?: SegmentId;
}) {
  const updatePlunge = useUpdatePlunge();
  const [notifPlungeId, setNotifPlungeId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);
  const shownTargetIdRef = useRef<number | null>(null);

  const [mood,        setMood]        = useState<number | null>(null);
  const [moodEnergy,  setMoodEnergy]  = useState<number | null>(null);
  const [moodFocus,   setMoodFocus]   = useState<number | null>(null);
  const [moodFatigue, setMoodFatigue] = useState<number | null>(null);

  // Cold start: arrived via /?mood=<id> (notification tap opened a new window)
  useEffect(() => {
    const id = extractMoodId(window.location.href);
    if (id) {
      setNotifPlungeId(id);
      const clean = new URL(window.location.href);
      clean.searchParams.delete("mood");
      window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
    }
  }, []);

  // Warm start: notification tapped while the app was already open
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "notification-navigate" && typeof e.data.url === "string") {
        const id = extractMoodId(e.data.url);
        if (id) setNotifPlungeId(id);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  const now = Date.now();

  const notifPlunge = notifPlungeId != null
    ? plunges.find((p) => p.id === notifPlungeId && p.mood == null) ?? null
    : null;

  const catchUpPlunge = (() => {
    void dismissTick;
    const latest = plunges[0];
    if (!latest || latest.mood != null) return null;
    const age = now - new Date(latest.createdAt).getTime();
    if (age < 60 * 60 * 1000 || age > 24 * 60 * 60 * 1000) return null;
    if (localStorage.getItem(DISMISS_KEY(latest.id))) return null;
    return latest;
  })();

  const target = notifPlunge ?? catchUpPlunge;

  // Reset selections when target changes
  useEffect(() => {
    setMood(null);
    setMoodEnergy(null);
    setMoodFocus(null);
    setMoodFatigue(null);
  }, [target?.id]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2200);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const isNotif = notifPlunge != null;
  const ageHours = target ? Math.round((now - new Date(target.createdAt).getTime()) / 3600000) : 0;
  const qset = target ? getQuestionSet(primaryBenefit, target.duration) : "default";
  const checkInSource = isNotif ? "notification" : "catch_up_prompt";

  useEffect(() => {
    if (!visible || !target || updatePlunge.isPending || shownTargetIdRef.current === target.id) return;
    shownTargetIdRef.current = target.id;
    Analytics.moodCheckInStarted(checkInSource, qset, Math.max(0, ageHours));
  }, [ageHours, checkInSource, qset, target, updatePlunge.isPending, visible]);

  if (!visible) return null;

  if (saved) {
    return (
      <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
        <div
          data-testid="banner-mood-saved"
          className="bg-blue-950/95 border border-cyan-400/40 rounded-2xl px-5 py-3 shadow-xl text-cyan-300 text-sm font-semibold"
        >
          Logged — thanks for checking in ❄️
        </div>
      </div>
    );
  }

  if (!target || updatePlunge.isPending) return null;

  const headerText = getHeaderText(qset, isNotif, ageHours);

  // Per-question-set "all answered" guard
  const allPicked = (() => {
    if (qset === "recovery")   return mood !== null && moodEnergy !== null && moodFatigue !== null && moodFocus !== null;
    if (qset === "mood-short") return mood !== null && moodEnergy !== null;
    return mood !== null && moodEnergy !== null && moodFocus !== null;
  })();

  const submit = () => {
    if (!allPicked) return;
    const patch: Record<string, number | null> = { mood, moodEnergy };
    if (qset === "recovery") {
      patch.moodFatigue = moodFatigue;
      patch.moodFocus   = moodFocus;   // saved as "recovery feeling"
    } else if (qset !== "mood-short") {
      patch.moodFocus = moodFocus;
    }
    updatePlunge.mutate(
      { id: target.id, patch },
      { onSuccess: () => {
          Analytics.moodCheckInSaved(checkInSource, qset, {
            mood: mood ?? undefined,
            plunge_id: target.id,
            duration_seconds: target.duration,
            water_temp_f: target.temperature,
          });
          setSaved(true);
          setNotifPlungeId(null);
        } },
    );
  };

  const dismiss = () => {
    Analytics.moodCheckInSkipped(checkInSource, qset);
    localStorage.setItem(DISMISS_KEY(target.id), "1");
    setNotifPlungeId(null);
    setDismissTick((t) => t + 1);
  };

  const saveLabel = (() => {
    if (qset === "recovery")   return allPicked ? "Save check-in" : "Answer all four to save";
    if (qset === "mood-short") return allPicked ? "Save check-in" : "Answer both to save";
    return allPicked ? "Save check-in" : "Select all three to save";
  })();

  return (
    <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center px-4">
      <div
        data-testid="banner-mood-checkin"
        className="w-full max-w-md bg-blue-950/95 backdrop-blur-sm border border-blue-700/60 rounded-2xl p-4 shadow-2xl space-y-3"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-white text-sm font-semibold leading-snug">{headerText}</p>
          <button
            data-testid="button-dismiss-mood"
            onClick={dismiss}
            className="text-blue-500 hover:text-blue-300 text-xs font-semibold shrink-0 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Accuracy nudge — honest answers power Sweet Spot and recommendations */}
        <p className="text-[10px] text-blue-400/70 italic leading-snug">
          Your answers shape your Sweet Spot — the more honest, the smarter the coaching.
        </p>

        {/* ── Recovery goal: mood + energy + muscle fatigue + recovery feeling ── */}
        {qset === "recovery" && (
          <>
            <PickerRow icon="😊" label="Mood"           options={MOOD_OPTIONS}     value={mood}        onPick={setMood} />
            <PickerRow icon="⚡" label="Energy"         options={ENERGY_OPTIONS}   value={moodEnergy}  onPick={setMoodEnergy} />
            <PickerRow icon="💪" label="Muscle fatigue" options={FATIGUE_OPTIONS}  value={moodFatigue} onPick={setMoodFatigue} />
            <PickerRow icon="🔄" label="Recovery"       options={RECOVERY_OPTIONS} value={moodFocus}   onPick={setMoodFocus} />
          </>
        )}

        {/* ── Mood goal, short: just mood + energy ── */}
        {qset === "mood-short" && (
          <>
            <PickerRow icon="😊" label="Mood"   options={MOOD_OPTIONS}   value={mood}       onPick={setMood} />
            <PickerRow icon="⚡" label="Energy" options={ENERGY_OPTIONS} value={moodEnergy} onPick={setMoodEnergy} />
          </>
        )}

        {/* ── Mood goal long / default: mood + energy + focus ── */}
        {(qset === "mood-long" || qset === "default") && (
          <>
            <PickerRow icon="😊" label="Mood"   options={MOOD_OPTIONS}   value={mood}       onPick={setMood} />
            <PickerRow icon="⚡" label="Energy" options={ENERGY_OPTIONS} value={moodEnergy} onPick={setMoodEnergy} />
            <PickerRow icon="🧠" label="Focus"  options={FOCUS_OPTIONS}  value={moodFocus}  onPick={setMoodFocus} />
          </>
        )}

        {/* Save button */}
        <button
          data-testid="button-mood-save"
          disabled={!allPicked}
          onClick={submit}
          className={[
            "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
            allPicked
              ? "bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30 active:scale-95"
              : "bg-blue-900/30 border border-blue-700/30 text-blue-600 cursor-not-allowed",
          ].join(" ")}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
