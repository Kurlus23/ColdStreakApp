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

export const FIRST_OPEN_KEY   = "coach-walkthrough-first-open-v1";
export const POST_PLUNGE_KEY  = "coach-walkthrough-post-plunge-v1";

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
    body: "I'm your personal cold plunge coach. Let me show you around in 30 seconds.",
  },
  {
    icon: "⏱️",
    title: "Your plunge timer",
    body: "When you're in the water, hit Start. Stop when you get out. ColdStreak tracks your time, temperature, and benefits automatically.",
    highlight: '[data-testid="card-timer"]',
    hint: "↓ The timer is right here on the main screen",
  },
  {
    icon: "🌡️",
    title: "Set your water temp",
    body: "Tap the temperature display to enter your water temp. Accuracy matters — it powers your Sweet Spot and personalised suggestions.",
    highlight: '[data-testid="card-water-temp"]',
    hint: "← Tap the temperature display",
  },
  {
    icon: "⚡",
    title: "The benefits bar",
    body: "It fills as you plunge. Energy unlocks at ~60s, Mood at 2 min, Metabolism at 3 min, Recovery at 5 min+. Benefits decay gradually between sessions.",
    highlight: '[data-testid="benefit-bar"]',
    hint: "↓ The bar just below the timer",
  },
  {
    icon: "📊",
    title: "Track your progress",
    body: "After your first plunge, open the History tab. You'll find your full log, your Sweet Spot, and your Cold Adaptation trend there.",
    hint: "Tap 📊 in the navigation bar below",
  },
  {
    icon: "💬",
    title: "Ask me anything",
    body: "Tap the blue ❄️ button in the bottom-right corner any time to ask about cold plunge science, your stats, or any feature in the app.",
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
    body: "Open a plunge in History and rate your Energy, Focus, and Mood. These ratings power your Sweet Spot and Cold Adaptation insights — the more you rate, the smarter your data gets.",
    hint: "Tap 📊 History → tap today's plunge",
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
  tourType: "first-open" | "post-plunge";
  onComplete: () => void;
}

export function CoachWalkthrough({ tourType, onComplete }: Props) {
  const steps = tourType === "first-open" ? FIRST_OPEN_STEPS : POST_PLUNGE_STEPS;
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
    const key = tourType === "first-open" ? FIRST_OPEN_KEY : POST_PLUNGE_KEY;
    localStorage.setItem(key, "1");
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

      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px]"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
        onClick={complete}
      />

      {/* Step card */}
      <div
        className="fixed inset-x-4 bottom-[88px] z-[61] rounded-2xl border border-blue-700/60 bg-[#0c1e3a] shadow-2xl p-5"
        style={{
          transform: visible ? "translateY(0)" : "translateY(24px)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(.22,1,.36,1), opacity 0.3s ease",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{current.icon}</span>
            <div>
              <p className="text-cyan-400 text-[10px] font-semibold uppercase tracking-wide leading-none mb-0.5">
                ColdStreak Coach
              </p>
              <p className="text-white text-base font-bold leading-tight">{current.title}</p>
            </div>
          </div>
          <button
            onClick={complete}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none p-1"
            aria-label="Skip tour"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <p className="text-blue-200 text-sm leading-relaxed mb-2">{current.body}</p>

        {/* Hint */}
        {current.hint && (
          <p className="text-cyan-500 text-[11px] font-medium mb-3">{current.hint}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? "16px" : "6px",
                  height: "6px",
                  backgroundColor: i === step ? "#22d3ee" : "#1e3a5f",
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isLast && (
              <button
                onClick={complete}
                className="text-slate-500 text-xs px-3 py-1.5 rounded-lg hover:text-slate-300"
              >
                Skip
              </button>
            )}
            <button
              onClick={next}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold px-5 py-1.5 rounded-xl transition-colors"
            >
              {isLast ? "Got it!" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
