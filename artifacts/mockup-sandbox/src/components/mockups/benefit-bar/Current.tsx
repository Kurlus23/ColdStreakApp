import "./_group.css";

const SEGMENTS = [
  { id: "energy", emoji: "⚡", label: "Energy", baseDuration: 60, barColor: "#22d3ee", dimColor: "#164e63" },
  { id: "mood", emoji: "😊", label: "Mood", baseDuration: 120, barColor: "#fbbf24", dimColor: "#78350f" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", baseDuration: 180, barColor: "#f97316", dimColor: "#7c2d12" },
  { id: "recovery", emoji: "💪", label: "Recovery", baseDuration: 300, barColor: "#34d399", dimColor: "#064e3b" },
] as const;

const staticSession = {
  elapsedSeconds: 210,
  todayLoggedSeconds: 0,
  tempF: 50,
  bodyFatPct: 20,
  isActive: true,
  primaryBenefit: "recovery",
} as const;

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * An isolated baseline copied from ColdStreak's live BenefitBar.
 * Static session data replaces timer, profile, and milestone dependencies.
 */
export function Current() {
  const compositionFactor = staticSession.bodyFatPct / 20;
  const thresholds = SEGMENTS.map((segment) =>
    Math.round(segment.baseDuration * compositionFactor),
  );
  const totalElapsed = staticSession.todayLoggedSeconds + staticSession.elapsedSeconds;
  const fills = thresholds.map((threshold) =>
    Math.min(100, Math.max(0, (totalElapsed / threshold) * 100)),
  );
  const achievedToday = fills.map((fill) => fill >= 100);

  return (
    <main className="benefit-bar-current flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[390px] px-0.5">
        <div className="space-y-0.5 mt-0.5 mb-0">
          {staticSession.isActive && achievedToday.every(Boolean) ? (
            <div className="space-y-1.5">
              <div className="relative h-2 overflow-hidden rounded-full bg-cyan-400/15">
                <div
                  className="absolute inset-0 animate-pulse rounded-full"
                  style={{ backgroundColor: "#67e8f9", opacity: 0.7 }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-[9px] font-semibold tracking-wide text-cyan-300 uppercase">
                  Adaptation Zone
                </p>
                <span className="text-[9px] text-slate-500">· Score only</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-nowrap gap-1.5">
              {SEGMENTS.map((segment, index) => {
                const fill = fills[index];
                const achieved = achievedToday[index];
                const filling = fill > 0 && fill < 100;

                return (
                  <div key={segment.id} className="min-w-0 flex-1">
                    <div
                      className="relative h-5 overflow-hidden rounded-md"
                      style={{
                        backgroundColor: achieved
                          ? `${segment.barColor}18`
                          : `${segment.dimColor}44`,
                        boxShadow: achieved ? `0 0 0 1px ${segment.barColor}cc` : "none",
                        transition: "box-shadow 0.4s ease, background-color 0.4s ease",
                      }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-md">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md"
                          style={{
                            width: `${fill}%`,
                            backgroundColor: segment.barColor,
                            opacity: fill > 0 ? (filling ? 0.85 : 0.75) : 0,
                            transition: "width 1s linear, opacity 0.6s ease",
                            boxShadow: filling ? `0 0 6px 1px ${segment.barColor}66` : "none",
                          }}
                        />
                      </div>
                      <span
                        className="absolute inset-0 z-10 flex items-center justify-center px-0.5 text-[8px] font-bold leading-none whitespace-nowrap"
                        style={{
                          color: segment.barColor,
                          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                        }}
                      >
                        {segment.emoji} {segment.label}
                      </span>
                    </div>
                    <p
                      className="mt-1 text-center font-mono text-[9px] font-semibold tabular-nums"
                      style={{ color: segment.barColor, opacity: achieved ? 0.75 : 1 }}
                    >
                      {achieved
                        ? "MAX"
                        : formatRemaining(Math.max(0, thresholds[index] - totalElapsed))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}