import { useState } from "react";
import { Analytics } from "@/lib/analytics";

const ONBOARDING_KEY = "coldstreak-onboarded";

export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: "🧊",
    title: "Welcome to ColdStreak",
    subtitle: "Your cold plunge companion",
    body: "Track every plunge, build your streak, and watch your cold tolerance grow over time. Science-backed scoring shows your real progress.",
  },
  {
    icon: "⏱️",
    title: "How It Works",
    subtitle: "Three simple steps",
    body: null,
    steps: [
      { emoji: "▶️", label: "Start the timer and get in" },
      { emoji: "📋", label: "Log your plunge when done" },
      { emoji: "📈", label: "Your Cold Score updates automatically" },
    ],
  },
  {
    icon: "🏆",
    title: "Built for Serious Plungers",
    subtitle: "Everything in one place",
    body: null,
    features: [
      { emoji: "🔥", label: "Streak tracking & weekly goals" },
      { emoji: "🥇", label: "Achievement badges" },
      { emoji: "🌍", label: "Chill Places bucket list" },
      { emoji: "👑", label: "Go Pro to unlock leaderboards & more" },
    ],
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [slide, setSlide] = useState(0);

  function finish(skipped: boolean) {
    localStorage.setItem(ONBOARDING_KEY, "true");
    Analytics.onboardingCompleted(skipped);
    onComplete();
  }

  function next() {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      finish(false);
    }
  }

  const current = slides[slide];
  const isLast = slide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-blue-950 px-6 py-10">

      {/* Skip */}
      <div className="w-full flex justify-end">
        <button
          data-testid="button-onboarding-skip"
          onClick={() => finish(true)}
          className="text-blue-300 text-sm font-medium px-2 py-1"
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full gap-5">
        <div className="text-7xl leading-none">{current.icon}</div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{current.title}</h2>
          <p className="text-blue-300 text-sm font-medium">{current.subtitle}</p>
        </div>

        {current.body && (
          <p className="text-blue-100 text-sm leading-relaxed">{current.body}</p>
        )}

        {current.steps && (
          <div className="w-full flex flex-col gap-3">
            {current.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 bg-blue-900/50 rounded-xl px-4 py-3 text-left">
                <span className="text-xl">{step.emoji}</span>
                <span className="text-blue-100 text-sm font-medium">{step.label}</span>
              </div>
            ))}
          </div>
        )}

        {current.features && (
          <div className="w-full grid grid-cols-2 gap-3">
            {current.features.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 bg-blue-900/50 rounded-xl px-3 py-4">
                <span className="text-2xl">{f.emoji}</span>
                <span className="text-blue-100 text-xs font-medium text-center leading-snug">{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mb-4">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === slide ? "w-6 bg-cyan-400" : "w-2 bg-blue-700"
            }`}
          />
        ))}
      </div>

      {/* CTA button */}
      <button
        data-testid="button-onboarding-next"
        onClick={next}
        className="w-full max-w-sm py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-blue-950 font-bold text-base"
      >
        {isLast ? "Get Started" : "Next"}
      </button>

    </div>
  );
}
