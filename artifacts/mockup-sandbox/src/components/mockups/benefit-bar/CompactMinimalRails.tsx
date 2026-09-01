import type { CSSProperties } from "react";
import "./_group.css";
import "./CompactMinimalRails.css";

const segments = [
  { id: "energy", label: "Energy", duration: 60, color: "#41d7ea", glow: "rgba(65,215,234,.55)" },
  { id: "mood", label: "Mood", duration: 120, color: "#f4c85b", glow: "rgba(244,200,91,.46)" },
  { id: "metabolism", label: "Metabolism", duration: 300, color: "#f18a50", glow: "rgba(241,138,80,.46)" },
  { id: "recovery", label: "Recovery", duration: 300, color: "#70dfbd", glow: "rgba(112,223,189,.52)" },
] as const;

function remaining(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CompactMinimalRails() {
  const elapsed = 210;
  const currentGoal = "recovery";

  return (
    <main className="compact-minimal-rails">
      <section className="compact-minimal-rails__panel" aria-label="ColdStreak benefits">
        <button
          className="compact-minimal-rails__action"
          type="button"
          aria-label="Tap to set goal. Recovery is currently selected."
        >
          Tap to Set Goal
        </button>

        <div className="compact-minimal-rails__grid" role="list" aria-label="Benefit progress">
          {segments.map((segment) => {
            const progress = Math.min(100, (elapsed / segment.duration) * 100);
            const complete = progress >= 100;
            const isGoal = segment.id === currentGoal;

            return (
              <article
                className={`compact-minimal-rail${isGoal ? " compact-minimal-rail--goal" : ""}`}
                key={segment.id}
                role="listitem"
                style={
                  {
                    "--rail-color": segment.color,
                    "--rail-glow": segment.glow,
                    "--rail-progress": `${progress}%`,
                  } as CSSProperties
                }
                aria-label={`${segment.label}: ${complete ? "complete" : `${remaining(segment.duration - elapsed)} remaining`}${isGoal ? ", current goal" : ""}`}
              >
                <div className="compact-minimal-rail__name">{segment.label}</div>
                <div className="compact-minimal-rail__track" aria-hidden="true">
                  <i />
                  <b />
                </div>
                <div className="compact-minimal-rail__value">{complete ? "MAX" : remaining(segment.duration - elapsed)}</div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}