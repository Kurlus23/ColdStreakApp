/**
 * CoachWalkthrough — scripted step-by-step in-app tour.
 *
 * Two tours:
 *   "first-open"   — shown once after the user completes signup, before their
 *                    first plunge. Walks through the timer, temperature, benefits
 *                    bar, history tab, and the coach button.
 *   "post-plunge"  — shown once after the user logs their very first plunge.
 *                    Explains mood ratings, streaks, and what to do next.
 *
 * Each step can optionally highlight a DOM element by CSS selector —
 * a cyan glow ring is applied via a temporary style rule and cleaned up on
 * step change.
 *
 * Completion is stored in localStorage so the tour never repeats.
 */

import { useState, useEffect, useCallback } from "react";

// ── localStorage keys ─────────────────────────────────────────────────────────

export const FIRST_OPEN_KEY   = "coach-walkthrough-first-open-v6";
export const POST_PLUNGE_KEY  = "coach-walkthrough-post-plunge-v1";
export const PROFILE_TIP_KEY  = "coach-tip-profile-v1";
export const FRIENDS_TIP_KEY  = "coach-tip-friends-v1";
export const CHALLENGE_TIP_KEY = "coach-tip-challenge-v1";

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  icon: string;
  title: string;
  body: string;
  /** CSS selector of the element to highlight. Skipped gracefully if not found. */
  highlight?: string;
  /** Small hint text shown below the body (e.g. arrow + label). */
  hint?: string;
}

const FIRST_OPEN_STEPS: Step[] = [
  {
    icon: "❄️",
    title: "Welcome to ColdStreak",
    body: "Your personal cold plunge coach — let me point out the key parts.",
  },
  {
    icon: "⏱️",
    title: "Your plunge timer",
    body: "Hit Start when you're in the water, Stop when you get out. Tap the mode label below the timer to toggle between Stopwatch and Countdown — in Countdown mode, tap the time display to set your target duration.",
    highlight: '[data-testid="card-timer"]',
    hint: "↓ below",
  },
  {
    icon: "🌡️",
    title: "Water temperature",
    body: "Tap the temperature display to set your water temp manually. The 'LIVE' indicator means a Bluetooth thermometer is connected and updating temp automatically — link one in Settings.",
    highlight: '[data-testid="card-water-temp"]',
    hint: "↓ below",
  },
  {
    icon: "⚡",
    title: "Cold Score",
    body: "Your performance score — colder water and longer duration means a higher score. Tap to cycle between today and your personal best.",
    highlight: '[data-testid="card-cold-score"]',
    hint: "↓ below",
  },
  {
    icon: "🏅",
    title: "Badge progress",
    body: "The small bar under your score tracks how many unique days you've plunged, counting down to your next days badge. Each new day you plunge — no matter how many times — moves it forward.",
    highlight: '[data-testid="card-badge-progress"]',
    hint: "↓ below",
  },
  {
    icon: "💪",
    title: "Benefits bar",
    body: "Fills as you plunge through Energy, Mood, Metabolism, and Recovery. Thresholds are personalised — colder water and leaner body composition unlock each benefit faster. Tap the goal label at the top of the bar to set or change your target benefit.",
    highlight: '[data-testid="benefit-bar"]',
    hint: "↓ below",
  },
  {
    icon: "📊",
    title: "History",
    body: "Your full plunge log lives here. Tap any session to rate your Energy, Focus, and Mood — the more you rate, the smarter your insights get.",
    highlight: '[data-testid="nav-history"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "👤",
    title: "Profile",
    body: "Two tabs: Account (username, body metrics, your public badge page) and Stats (Cold Score trends, Sweet Spot, and Cold Adaptation analysis). Body metrics also personalise your Cold Score and Benefits bar.",
    highlight: '[data-testid="nav-profile"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "👥",
    title: "Friends",
    body: "Search for friends by @username, see their daily scores and streaks, and tap any friend card to send them an ⚡ Challenge. A red dot on the icon means a friend request is waiting.",
    highlight: '[data-testid="nav-friends"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "🧭",
    title: "Explore",
    body: "Global and city leaderboards, community events, and local plunge spots near you. A great place to find cold-plunge buddies and see how you stack up worldwide.",
    highlight: '[data-testid="nav-explore"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "🛒",
    title: "Gear",
    body: "Browse cold plunge tubs, thermometers, and accessories hand-picked for plungers. Linking a Bluetooth thermometer lets the app read your water temp automatically.",
    highlight: '[data-testid="nav-gear"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "⚙️",
    title: "Settings",
    body: "Change temperature units, link a Bluetooth thermometer, manage your account, and set up notifications. Body metrics (weight, height, body fat) are in Profile → Account.",
    highlight: '[data-testid="nav-settings"]',
    hint: "↓ bottom nav",
  },
  {
    icon: "💬",
    title: "Ask me anything",
    body: "Tap the ColdStreak icon (top-left, it moves — drag it wherever you like) any time to ask about your stats, cold plunge science, or how any feature works.",
    highlight: '[data-testid="coach-fab"]',
  },
];

const PROFILE_TIP_STEPS: Step[] = [
  {
    icon: "👤",
    title: "Set up your profile",
    body: "Add a username so friends can find and challenge you.",
    highlight: '[data-testid="input-account-username"]',
    hint: "↓ below",
  },
  {
    icon: "🏅",
    title: "Your public badge page",
    body: "Tap 'View My Profile' to see the page you can share with friends.",
    highlight: '[data-testid="button-view-badge-profile"]',
    hint: "↓ below",
  },
];

const FRIENDS_TIP_STEPS: Step[] = [
  {
    icon: "🔍",
    title: "Find friends",
    body: "Search by @username or display name to send a friend request.",
    highlight: '[data-testid="input-friend-search"]',
    hint: "↓ below",
  },
];

const CHALLENGE_TIP_STEPS: Step[] = [
  {
    icon: "⚡",
    title: "Challenge a friend",
    body: "Once a friend plunges today, tap their card and hit ⚡ Challenge to race their score.",
  },
];

const POST_PLUNGE_STEPS: Step[] = [
  {
    icon: "🎉",
    title: "First plunge done!",
    body: "That's the hardest one. Your plunge is logged and your benefits bar just lit up. Here's what to do next.",
  },
  {
    icon: "⭐",
    title: "Rate how you feel",
    body: "Open a plunge in History and rate your Energy, Focus, and Mood. The more you rate, the smarter your insights get.",
    highlight: '[data-testid="nav-history"]',
    hint: "↓ tap History → tap today's plunge",
  },
  {
    icon: "🔥",
    title: "Build a streak",
    body: "Come back tomorrow to start a daily streak. Use Streak Freeze tokens on rest days so you don't lose progress.",
  },
  {
    icon: "💬",
    title: "I'm here when you need me",
    body: "Tap the ❄️ button any time to ask about cold plunge science, your stats, or how any feature works. See you in the water!",
    highlight: '[data-testid="coach-fab"]',
  },
];

// ── Highlight helper ──────────────────────────────────────────────────────────

const HIGHLIGHT_CLASS = "coach-highlight-ring";

function applyHighlight(selector: string | undefined) {
  clearHighlight();
  if (!selector) return;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearHighlight() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) =>
    el.classList.remove(HIGHLIGHT_CLASS),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tourType: "first-open" | "post-plunge" | "profile-tip" | "friends-tip" | "challenge-tip";
  onComplete: () => void;
}

const STEPS_BY_TYPE = {
  "first-open":    FIRST_OPEN_STEPS,
  "post-plunge":   POST_PLUNGE_STEPS,
  "profile-tip":   PROFILE_TIP_STEPS,
  "friends-tip":   FRIENDS_TIP_STEPS,
  "challenge-tip": CHALLENGE_TIP_STEPS,
};

/** Tours shown over full-content screens sit near the top so they don't cover the list */
const TOP_POSITIONED = new Set(["profile-tip", "friends-tip", "challenge-tip"]);

const KEY_BY_TYPE = {
  "first-open":    FIRST_OPEN_KEY,
  "post-plunge":   POST_PLUNGE_KEY,
  "profile-tip":   PROFILE_TIP_KEY,
  "friends-tip":   FRIENDS_TIP_KEY,
  "challenge-tip": CHALLENGE_TIP_KEY,
};

export function CoachWalkthrough({ tourType, onComplete }: Props) {
  const steps = STEPS_BY_TYPE[tourType];
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(id);
  }, []);

  // Apply / clear highlight ring whenever step changes
  useEffect(() => {
    applyHighlight(steps[step]?.highlight);
    return () => clearHighlight();
  }, [step, steps]);

  // Clean up on unmount
  useEffect(() => () => clearHighlight(), []);

  const complete = useCallback(() => {
    clearHighlight();
    localStorage.setItem(KEY_BY_TYPE[tourType], "1");
    onComplete();
  }, [tourType, onComplete]);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      complete();
    }
  }, [step, steps.length, complete]);

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Inject highlight ring style once */}
      <style>{`
        .coach-highlight-ring {
          outline: 2px solid #22d3ee !important;
          outline-offset: 3px !important;
          border-radius: 12px !important;
          box-shadow: 0 0 0 4px rgba(34,211,238,0.20) !important;
          transition: outline 0.2s ease, box-shadow 0.2s ease !important;
          position: relative;
          z-index: 1;
        }
      `}</style>

      {/* Tap-away area — transparent, just catches taps outside the card */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={complete}
      />

      {/* Step card — floats in the landscape dead-zone, compact tooltip style */}
      <div
        className="fixed z-[61] rounded-2xl border border-blue-700/60 bg-[#0c1e3a]/95 shadow-2xl"
        style={{
          top: TOP_POSITIONED.has(tourType) ? "calc(env(safe-area-inset-top, 0px) + 72px)" : "32%",
          left: "5%",
          right: "5%",
          transform: visible ? "translateY(0)" : "translateY(-12px)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.3s ease",
        }}
      >
        {/* Downward arrow pointing toward bottom UI elements */}
        {current.hint && (
          <div
            className="absolute left-1/2 -translate-x-1/2 text-cyan-400 text-lg leading-none select-none"
            style={{ bottom: "-28px" }}
          >
            ↓
          </div>
        )}

        <div className="px-4 pt-3 pb-3">
          {/* Header row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{current.icon}</span>
              <p className="text-white text-sm font-bold leading-tight">{current.title}</p>
            </div>
            <button
              onClick={complete}
              className="text-slate-500 hover:text-slate-300 text-sm leading-none p-1 -mr-1"
              aria-label="Skip tour"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <p className="text-blue-200 text-xs leading-relaxed">{current.body}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2.5">
            {/* Progress dots */}
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? "14px" : "5px",
                    height: "5px",
                    backgroundColor: i === step ? "#22d3ee" : "#1e3a5f",
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-1.5">
              {!isLast && (
                <button
                  onClick={complete}
                  className="text-slate-500 text-xs px-2.5 py-1 rounded-lg hover:text-slate-300"
                >
                  Skip
                </button>
              )}
              <button
                onClick={next}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-1 rounded-lg transition-colors"
              >
                {isLast ? "Got it!" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
