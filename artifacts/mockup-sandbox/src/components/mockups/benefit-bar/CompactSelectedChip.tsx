import type { CSSProperties } from "react";
import "./_group.css";
import "./CompactSelectedChip.css";

const segments = [
  { id: "energy", label: "Energy", progress: 100, value: "MAX", color: "#41d7ea", glow: "rgba(65,215,234,.55)", selected: false },
  { id: "mood", label: "Mood", progress: 100, value: "MAX", color: "#f4c85b", glow: "rgba(244,200,91,.46)", selected: false },
  { id: "metabolism", label: "Metabolism", progress: 70, value: "1:30", color: "#f18a50", glow: "rgba(241,138,80,.46)", selected: false },
  { id: "recovery", label: "Recovery", progress: 70, value: "1:30", color: "#70dfbd", glow: "rgba(112,223,189,.52)", selected: true },
] as const;

export function CompactSelectedChip() {
  return (
    <main className="compact-selected-chip">
      <section className="compact-selected-chip__panel" aria-label="ColdStreak benefits">
        <button className="compact-selected-chip__action" type="button">
          Tap to Set Goal
        </button>

        <div className="compact-selected-chip__grid" role="list" aria-label="Benefit progress">
          {segments.map((segment) => (
            <article
              className={`compact-selected-chip__rail${segment.selected ? " compact-selected-chip__rail--selected" : ""}`}
              key={segment.id}
              role="listitem"
              style={
                {
                  "--rail-color": segment.color,
                  "--rail-glow": segment.glow,
                  "--rail-progress": `${segment.progress}%`,
                } as CSSProperties
              }
              aria-label={`${segment.label}: ${segment.value === "MAX" ? "complete" : `${segment.value} remaining`}${segment.selected ? ", current goal" : ""}`}
            >
              <div className="compact-selected-chip__name">
                <strong>{segment.label}</strong>
              </div>
              <div className="compact-selected-chip__track" aria-hidden="true">
                <i />
                <b />
              </div>
              <div className="compact-selected-chip__value">{segment.value}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}