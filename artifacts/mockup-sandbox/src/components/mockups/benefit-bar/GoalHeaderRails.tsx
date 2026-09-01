import type { CSSProperties } from "react";
import "./_group.css";
import "./GoalHeaderRails.css";

const segments = [
  { id: "energy", label: "Energy", duration: 60, color: "#41d7ea", glow: "rgba(65,215,234,.55)" },
  { id: "mood", label: "Mood", duration: 120, color: "#f4c85b", glow: "rgba(244,200,91,.46)" },
  { id: "metabolism", label: "Metabolism", duration: 180, color: "#f18a50", glow: "rgba(241,138,80,.46)" },
  { id: "recovery", label: "Recovery", duration: 300, color: "#70dfbd", glow: "rgba(112,223,189,.52)" },
] as const;

function remaining(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GoalHeaderRails() {
  const elapsed = 210;
  const currentGoal = segments[0];

  return (
    <main className="goal-header-rails">
      <section className="goal-header-rails__panel" aria-label="Benefits">
        <header className="goal-header-rails__header">
          <div className="goal-header-rails__caption">
            <span>BENEFITS</span>
          </div>
          <button className="goal-header-rails__change" type="button">
            Tap to Change Goal
          </button>
          <div className="goal-header-rails__goal">
            <span>Goal:</span>
            <strong style={{ color: currentGoal.color }}>{currentGoal.label}</strong>
          </div>
        </header>

        <div className="goal-header-rails__grid" role="list">
          {segments.map((segment) => {
            const progress = Math.min(100, (elapsed / segment.duration) * 100);
            const complete = progress >= 100;
            return (
              <article
                className="goal-header-rail"
                key={segment.id}
                role="listitem"
                style={{ "--rail-color": segment.color, "--rail-glow": segment.glow, "--rail-progress": `${progress}%` } as CSSProperties}
                aria-label={`${segment.label}: ${complete ? "complete" : `${remaining(segment.duration - elapsed)} remaining`}`}
              >
                <div className="goal-header-rail__name">
                  <strong>{segment.label}</strong>
                </div>
                <div className="goal-header-rail__track" aria-hidden="true">
                  <i />
                  <b />
                </div>
                <div className="goal-header-rail__value">{complete ? "MAX" : remaining(segment.duration - elapsed)}</div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}