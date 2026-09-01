import type { CSSProperties } from "react";
import "./_group.css";
import "./GoalFocus.css";

const segments = [
  { id: "energy", label: "Energy", mark: "E", duration: 60, color: "#41d7ea", glow: "rgba(65,215,234,.5)" },
  { id: "mood", label: "Mood", mark: "M", duration: 120, color: "#f4c85b", glow: "rgba(244,200,91,.44)" },
  { id: "metabolism", label: "Metabolism", mark: "M", duration: 180, color: "#f18a50", glow: "rgba(241,138,80,.44)" },
  { id: "recovery", label: "Recovery", mark: "R", duration: 300, color: "#70dfbd", glow: "rgba(112,223,189,.52)" },
] as const;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function GoalFocus() {
  const elapsed = 210;
  return (
    <main className="goal-focus">
      <section className="goal-focus__panel" aria-label="Recovery goal">
        <header className="goal-focus__header">
          <div><span className="goal-focus__kicker">BENEFIT PROFILE</span><strong>Recovery goal</strong></div>
          <span className="goal-focus__temperature">50°F</span>
        </header>
        <div className="goal-focus__grid" role="list">
          {segments.map((segment) => {
            const progress = Math.min(100, elapsed / segment.duration * 100);
            const complete = progress >= 100;
            const focus = segment.id === "recovery";
            return (
              <article
                className={`goal-cell${focus ? " goal-cell--focus" : ""}`}
                key={segment.id}
                role="listitem"
                style={{ "--goal-color": segment.color, "--goal-glow": segment.glow, "--goal-progress": `${progress}%` } as CSSProperties}
              >
                <div className="goal-cell__top"><span className="goal-cell__mark">{segment.mark}</span><span>{segment.label}</span></div>
                <div className="goal-cell__rail"><i /><b /></div>
                <div className="goal-cell__bottom"><strong>{complete ? "MAX" : clock(segment.duration - elapsed)}</strong><span>{focus ? "GOAL" : "READY"}</span></div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}