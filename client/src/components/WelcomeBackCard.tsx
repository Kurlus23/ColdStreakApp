/**
 * WelcomeBackCard — shown on the home/timer screen when the user
 * returns after a gap of 7 or more days since their last plunge.
 *
 * Dismissable per gap (stores the last-dismissed plunge ID in localStorage
 * so it won't nag again until after the next new gap opens).
 *
 * Uses honest, non-alarmist language — no adaptation-loss percentages.
 */

import { useState } from "react";
import { type Plunge } from "@shared/schema";

interface Props {
  plunges: Plunge[];
}

const DISMISS_KEY = "coldstreak-welcome-back-dismissed-plunge";

function buildMessage(daysSince: number): { headline: string; body: string } {
  if (daysSince < 14) {
    return {
      headline: "Welcome back ❄️",
      body: `It's been ${daysSince} days since your last plunge. Your body may feel the cold a little more intensely today — that's completely normal.`,
    };
  }
  if (daysSince < 30) {
    return {
      headline: "Good to see you again ❄️",
      body: `It's been ${daysSince} days. You haven't lost your progress — a few sessions will have you back at your previous cold response. Take it at your own pace.`,
    };
  }
  return {
    headline: "Welcome back to the cold ❄️",
    body: `It's been ${daysSince} days. Start with a comfortable temperature and duration — your body will re-adapt quickly. The hardest part is always getting back in.`,
  };
}

export function WelcomeBackCard({ plunges }: Props) {
  const [dismissed, setDismissed] = useState<string | null>(
    () => localStorage.getItem(DISMISS_KEY),
  );

  if (plunges.length === 0) return null;

  // Sort plunges newest-first and find the most recent one
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latest = sorted[0];

  const daysSince = Math.floor(
    (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  // Only show if gap is 7–365 days
  if (daysSince < 7 || daysSince > 365) return null;

  // Don't re-show for the same gap (dismissed key = plunge id of latest at dismiss time)
  if (dismissed === String(latest.id)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(latest.id));
    setDismissed(String(latest.id));
  };

  const { headline, body } = buildMessage(daysSince);

  return (
    <div
      data-testid="welcome-back-card"
      className="mx-0 mb-4 rounded-2xl border border-blue-600/40 bg-blue-900/50 p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1">
          <span className="text-2xl leading-none mt-0.5">🥶</span>
          <div>
            <p className="text-white text-sm font-bold leading-tight mb-1">{headline}</p>
            <p className="text-blue-300 text-[11px] leading-relaxed">{body}</p>
          </div>
        </div>
        <button
          data-testid="button-dismiss-welcome-back"
          onClick={dismiss}
          className="text-blue-500 hover:text-blue-300 text-lg leading-none shrink-0 transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
