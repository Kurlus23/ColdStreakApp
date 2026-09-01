import type { CSSProperties } from "react";
import "./_group.css";
import "./ContrastSelectedChip.css";

const segments = [
  { id: "energy", label: "Energy", progress: 100, value: "MAX", color: "#41d7ea", selected: false },
  { id: "mood", label: "Mood", progress: 100, value: "MAX", color: "#f4c85b", selected: false },
  { id: "metabolism", label: "Metabolism", progress: 70, value: "1:30", color: "#f18a50", selected: false },
  { id: "recovery", label: "Recovery", progress: 70, value: "1:30", color: "#70dfbd", selected: true },
] as const;

export function ContrastSelectedChip() {
  return (
    <main className="contrast-selected-chip">
      <section className="contrast-selected-chip__panel" aria-label="ColdStreak benefits">
        <button className="contrast-selected-chip__action" type="button">
          Tap to Set Goal
        </button>

        <div className="contrast-selected-chip__rails" role="list" aria-label="Benefit progress">
          {segments.map((segment) => (
            <article
              className={`contrast-selected-chip__rail${segment.selected ? " contrast-selected-chip__rail--selected" : ""}`}
              key={segment.id}
              role="listitem"
              style={
                {
                  "--rail-color": segment.color,
                  "--rail-progress": `${segment.progress}%`,
                } as CSSProperties
              }
              aria-label={`${segment.label}: ${segment.value === "MAX" ? "complete" : `${segment.value} remaining`}${segment.selected ? ", current goal" : ""}`}
            >
              <div className="contrast-selected-chip__label">
                <strong>{segment.label}</strong>
              </div>
              <div className="contrast-selected-chip__track" aria-hidden="true">
                <i />
                <b />
              </div>
              <div className="contrast-selected-chip__value">{segment.value}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}