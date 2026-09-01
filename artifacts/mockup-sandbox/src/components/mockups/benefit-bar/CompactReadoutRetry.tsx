import type { CSSProperties } from "react";
import "./_group.css";
import "./CompactReadoutRetry.css";

const signals = [
  { id: "energy", label: "Energy", code: "EN", duration: 60, color: "#77d9e0" },
  { id: "mood", label: "Mood", code: "MO", duration: 120, color: "#d6bd78" },
  { id: "metabolism", label: "Metabolism", code: "ME", duration: 180, color: "#e49a70" },
  { id: "recovery", label: "Recovery", code: "RE", duration: 300, color: "#82d0ae" },
] as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CompactReadoutRetry() {
  const elapsed = 210;

  return (
    <main className="compact-readout">
      <section className="compact-readout__instrument" aria-label="Session benefits">
        <header className="compact-readout__header">
          <div className="compact-readout__session">
            <span className="compact-readout__eyebrow">SESSION / 04</span>
            <strong>Benefit readout</strong>
          </div>
          <div className="compact-readout__conditions" aria-label="Session conditions">
            <span>50°F</span>
            <i aria-hidden="true" />
            <span>03:30</span>
          </div>
        </header>

        <div className="compact-readout__rule" aria-hidden="true">
          <span />
        </div>

        <div className="compact-readout__readings" role="list" aria-label="Benefit progress">
          {signals.map((signal) => {
            const progress = Math.min(100, (elapsed / signal.duration) * 100);
            const complete = progress >= 100;
            const remaining = Math.max(0, signal.duration - elapsed);
            const selected = signal.id === "recovery";
            return (
              <article
                className={`compact-reading${selected ? " compact-reading--selected" : ""}`}
                key={signal.id}
                role="listitem"
                style={{ "--signal-color": signal.color, "--signal-progress": `${progress}%` } as CSSProperties}
                aria-label={`${signal.label}: ${complete ? "complete" : `${formatTime(remaining)} remaining`}${selected ? ", recovery goal" : ""}`}
              >
                <div className="compact-reading__identity">
                  <span className="compact-reading__code" aria-hidden="true">{signal.code}</span>
                  <span className="compact-reading__label">{signal.label}</span>
                </div>
                <div className="compact-reading__meter" aria-hidden="true">
                  <span />
                  <b />
                </div>
                <div className="compact-reading__status">
                  <strong>{complete ? "READY" : formatTime(remaining)}</strong>
                  {selected && <span className="compact-reading__goal">GOAL</span>}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="compact-readout__footer">
          <span><i className="compact-readout__legend-dot" aria-hidden="true" />Progress updates with session time</span>
          <span className="compact-readout__safe">Within measured range</span>
        </footer>
      </section>
    </main>
  );
}