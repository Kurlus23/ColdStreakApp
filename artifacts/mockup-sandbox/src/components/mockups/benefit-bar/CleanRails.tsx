import type { CSSProperties } from "react";
import "./_group.css";
import "./CleanRails.css";

const segments = [
  { id: "energy", label: "Energy", duration: 60, color: "#41d7ea", glow: "rgba(65,215,234,.55)" },
  { id: "mood", label: "Mood", duration: 120, color: "#f4c85b", glow: "rgba(244,200,91,.46)" },
  { id: "metabolism", label: "Metabolism", duration: 180, color: "#f18a50", glow: "rgba(241,138,80,.46)" },
  { id: "recovery", label: "Recovery", duration: 300, color: "#70dfbd", glow: "rgba(112,223,189,.52)" },
] as const;

function remaining(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CleanRails() {
  const elapsed = 210;
  return (
    <main className="clean-rails">
      <section className="clean-rails__panel" aria-label="Benefits">
        <div className="clean-rails__caption">
          <span>BENEFITS</span>
        </div>
        <div className="clean-rails__grid" role="list">
          {segments.map((segment) => {
            const progress = Math.min(100, elapsed / segment.duration * 100);
            const complete = progress >= 100;
            return (
              <article
                className="clean-rail"
                key={segment.id}
                role="listitem"
                style={{ "--rail-color": segment.color, "--rail-glow": segment.glow, "--rail-progress": `${progress}%` } as CSSProperties}
                aria-label={`${segment.label}: ${complete ? "complete" : `${remaining(segment.duration - elapsed)} remaining`}`}
              >
                <div className="clean-rail__name">
                  <strong>{segment.label}</strong>
                </div>
                <div className="clean-rail__track" aria-hidden="true">
                  <i />
                  <b />
                </div>
                <div className="clean-rail__value">{complete ? "MAX" : remaining(segment.duration - elapsed)}</div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}