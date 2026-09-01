import "./_group.css";
import "./ColdSignal.css";

const SEGMENTS = [
  { id: "energy", label: "Energy", glyph: "E", baseDuration: 60, color: "#41d7ea", glow: "rgba(65, 215, 234, 0.65)" },
  { id: "mood", label: "Mood", glyph: "M", baseDuration: 120, color: "#f4c85b", glow: "rgba(244, 200, 91, 0.58)" },
  { id: "metabolism", label: "Metabolism", glyph: "M", baseDuration: 180, color: "#f18a50", glow: "rgba(241, 138, 80, 0.58)" },
  { id: "recovery", label: "Recovery", glyph: "R", baseDuration: 300, color: "#70dfbd", glow: "rgba(112, 223, 189, 0.64)" },
] as const;

const staticSession = {
  elapsedSeconds: 210,
  todayLoggedSeconds: 0,
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
 * Cold Signal: a compact sensor rail variant of ColdStreak's Benefit Bar.
 * It keeps the baseline's BMI-adjusted thresholds and active-session semantics.
 */
export function ColdSignal() {
  const compositionFactor = staticSession.bodyFatPct / 20;
  const totalElapsed = staticSession.todayLoggedSeconds + staticSession.elapsedSeconds;
  const thresholds = SEGMENTS.map((segment) => Math.round(segment.baseDuration * compositionFactor));

  return (
    <main className="benefit-bar-signal">
      <section className="signal-console" aria-label="ColdStreak active session benefits">
        <header className="signal-console__header">
          <span className="signal-console__eyebrow">Session signal / 03:30</span>
          <span className="signal-console__status">Live plunge</span>
        </header>
        <div className="signal-grid" role="list" aria-label="Benefit progress">
          {SEGMENTS.map((segment, index) => {
            const threshold = thresholds[index];
            const fill = Math.min(100, Math.max(0, (totalElapsed / threshold) * 100));
            const achieved = fill >= 100;
            const remaining = Math.max(0, threshold - totalElapsed);
            const isPrimary = staticSession.primaryBenefit === segment.id;

            return (
              <article
                className={`signal${achieved ? " signal--complete" : ""}`}
                key={segment.id}
                role="listitem"
                aria-label={`${segment.label}: ${achieved ? "complete" : `${formatRemaining(remaining)} remaining`}`}
                style={{
                  "--signal-color": segment.color,
                  "--signal-glow": segment.glow,
                  "--signal-progress": `${fill}%`,
                } as React.CSSProperties}
              >
                <div className="signal__label">
                  <span className="signal__glyph" aria-hidden="true">{segment.glyph}</span>
                  <span className="signal__label-text">{segment.label}</span>
                </div>
                <div className="signal__rail" aria-hidden="true">
                  <div className="signal__progress" />
                  <div className="signal__marker" />
                </div>
                <div className="signal__meta">
                  <span className="signal__time">{achieved ? "MAX" : formatRemaining(remaining)}</span>
                  <span className="signal__unit">{isPrimary ? "focus" : "to go"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}