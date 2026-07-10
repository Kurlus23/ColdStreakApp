import { useEffect, useState } from "react";
import { useUpdatePlunge } from "@/hooks/use-plunges";
import { type Plunge } from "@shared/schema";

export const MOODS = [
  { value: 1, emoji: "🙁", label: "Rough" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
] as const;

const DISMISS_KEY = (id: number) => `coldstreak-mood-dismissed-${id}`;

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

export function MoodCheckIn({ plunges, visible }: { plunges: Plunge[]; visible: boolean }) {
  const updatePlunge = useUpdatePlunge();
  const [notifPlungeId, setNotifPlungeId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [dismissTick, setDismissTick] = useState(0);

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

  // Notification-driven prompt takes priority; otherwise catch-up banner for
  // the most recent plunge that is 1-24h old and still unanswered.
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

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2200);
      return () => clearTimeout(t);
    }
  }, [saved]);

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

  const isNotif = notifPlunge != null;
  const ageHours = Math.round((now - new Date(target.createdAt).getTime()) / 3600000);

  const pick = (mood: number) => {
    updatePlunge.mutate(
      { id: target.id, patch: { mood } },
      { onSuccess: () => { setSaved(true); setNotifPlungeId(null); } },
    );
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY(target.id), "1");
    setNotifPlungeId(null);
    setDismissTick((t) => t + 1);
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center px-4">
      <div
        data-testid="banner-mood-checkin"
        className="w-full max-w-md bg-blue-950/95 backdrop-blur-sm border border-blue-700/60 rounded-2xl p-4 shadow-2xl space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-white text-sm font-semibold leading-snug">
            {isNotif
              ? "How's your body feeling after that plunge?"
              : ageHours <= 3
                ? "How did you feel after your plunge?"
                : "How did you feel after your last plunge?"}
          </p>
          <button
            data-testid="button-dismiss-mood"
            onClick={dismiss}
            className="text-blue-500 hover:text-blue-300 text-xs font-semibold shrink-0 transition-colors"
          >
            Skip
          </button>
        </div>
        <div className="flex gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              data-testid={`button-mood-${m.value}`}
              onClick={() => pick(m.value)}
              className="flex-1 flex flex-col items-center gap-1 bg-blue-900/60 hover:bg-blue-800/80 border border-blue-700/40 hover:border-cyan-400/50 rounded-xl py-2.5 transition-all active:scale-95"
            >
              <span className="text-2xl leading-none">{m.emoji}</span>
              <span className="text-blue-300 text-[10px] font-semibold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
