import type { CSSProperties } from "react";
import "./_group.css";
import "./InlineSelectedChip.css";

const segments = [
  { id: "energy", label: "Energy", value: "2h59", progress: 100, color: "#41d7ea", glow: "rgba(65, 215, 234, .46)" },
  { id: "mood", label: "Mood", value: "4h59", progress: 100, color: "#f4c85b", glow: "rgba(244, 200, 91, .42)" },
  { id: "metabolism", label: "Metabolism", value: "1:30", progress: 70, color: "#f18a50", glow: "rgba(241, 138, 80, .42)" },
  { id: "recovery", label: "Recovery", value: "1:30", progress: 70, color: "#70dfbd", glow: "rgba(112, 223, 189, .48)" },
] as const;

export function InlineSelectedChip() {
  return (
    <main className="inline-selected-chip">
      <section className="inline-selected-chip__panel" aria-label="ColdStreak benefits">
        <div className="inline-selected-chip__grid" role="list" aria-label="Benefit progress">
          {segments.map((segment) => {
            const isSelected = segment.id === "recovery";
            return (
              <article
                className={`inline-selected-chip__rail${isSelected ? " inline-selected-chip__rail--selected" : ""}`}
                key={segment.id}
                role="listitem"
                style={
                  {
                    "--rail-color": segment.color,
                    "--rail-glow": segment.glow,
                    "--rail-progress": `${segment.progress}%`,
                  } as CSSProperties
                }
                aria-label={`${segment.label}: ${segment.value === "MAX" ? "complete" : `${segment.value} remaining`}${isSelected ? ", current goal" : ""}`}
              >
                <div className="inline-selected-chip__name">
                  <strong>{segment.label}</strong>
                </div>
                <div className="inline-selected-chip__track" aria-hidden="true">
                  <i />
                  <b />
                </div>
                <div className="inline-selected-chip__value">{segment.value}</div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}