import type { CSSProperties } from "react";
import "./_group.css";
import "./SplitGoalChip.css";

const segments = [
  { id: "energy", label: "Energy", value: "MAX", progress: 100, color: "#41d7ea", glow: "rgba(65, 215, 234, .42)" },
  { id: "mood", label: "Mood", value: "MAX", progress: 100, color: "#f4c85b", glow: "rgba(244, 200, 91, .35)" },
  { id: "metabolism", label: "Metabolism", value: "1:30", progress: 70, color: "#f18a50", glow: "rgba(241, 138, 80, .35)" },
  { id: "recovery", label: "Recovery", value: "1:30", progress: 70, color: "#70dfbd", glow: "rgba(112, 223, 189, .4)" },
] as const;

export function SplitGoalChip() {
  return (
    <main className="split-goal-chip">
      <section className="split-goal-chip__panel" aria-label="ColdStreak benefits">
        <div className="split-goal-chip__controls">
          <button className="split-goal-chip__action" type="button">
            Tap to Set Goal
          </button>
          <span className="split-goal-chip__selected" aria-label="Current goal: Recovery">
            Recovery
          </span>
        </div>

        <div className="split-goal-chip__rails" role="list" aria-label="Benefit progress">
          {segments.map((segment) => (
            <article
              className="split-goal-chip__rail"
              key={segment.id}
              role="listitem"
              style={
                {
                  "--rail-color": segment.color,
                  "--rail-glow": segment.glow,
                  "--rail-progress": `${segment.progress}%`,
                } as CSSProperties
              }
              aria-label={`${segment.label}: ${segment.value === "MAX" ? "complete" : `${segment.value} remaining`}`}
            >
              <span className="split-goal-chip__label">{segment.label}</span>
              <span className="split-goal-chip__track" aria-hidden="true">
                <span className="split-goal-chip__fill" />
              </span>
              <span className="split-goal-chip__value">{segment.value}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}