import type { CSSProperties } from "react";
import "./_group.css";
import "./PrecisionTelemetry.css";

const SEGMENTS = [
  { id: "energy", label: "Energy", baseDuration: 60, signal: "#62d8e8" },
  { id: "mood", label: "Mood", baseDuration: 120, signal: "#e5c66b" },
  { id: "metabolism", label: "Metabolism", baseDuration: 180, signal: "#e99a62" },
  { id: "recovery", label: "Recovery", baseDuration: 300, signal: "#70d5ae" },
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
 * Precision Telemetry reframes the active-session benefit bar as a compact
 * readout: names and values first, with a fine trace for each signal.
 */
export function PrecisionTelemetry() {
  const compositionFactor = staticSession.bodyFatPct / 20;
  const thresholds = SEGMENTS.map((segment) =>
    Math.round(segment.baseDuration * compositionFactor),
  );
  const totalElapsed = staticSession.todayLoggedSeconds + staticSession.elapsedSeconds;
  const fills = thresholds.map((threshold) =>
    Math.min(100, Math.max(0, (totalElapsed / threshold) * 100)),
  );

  return (
    <main className="benefit-bar-precision flex min-h-screen items-center justify-center">
      <section className="precision-shell" aria-label="Active session benefit telemetry">
        <div className="precision-panel">
          <div className="precision-heading">
            <span className="precision-kicker">Session telemetry</span>
            <span className="precision-elapsed">T+{formatRemaining(totalElapsed)}</span>
          </div>
          <div className="precision-grid">
            {SEGMENTS.map((segment, index) => {
              const fill = fills[index];
              const achieved = fill >= 100;
              const remaining = Math.max(0, thresholds[index] - totalElapsed);
              const current = staticSession.isActive && staticSession.primaryBenefit === segment.id;

              return (
                <div
                  className="precision-segment"
                  data-current={current}
                  key={segment.id}
                  style={{ "--signal": segment.signal } as CSSProperties}
                >
                  <div className="precision-label-row">
                    <span className="precision-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="precision-label">{segment.label}</span>
                  </div>
                  <p className="precision-value">{Math.round(fill)}%</p>
                  <div className="precision-trace" aria-label={`${segment.label}: ${Math.round(fill)} percent`}>
                    <div className="precision-fill" style={{ width: `${fill}%` }} />
                  </div>
                  <div className="precision-state">
                    <span>{current ? <span className="precision-current-mark inline-block" /> : null}{current ? "NOW" : achieved ? "MAX" : "NEXT"}</span>
                    <span>{achieved ? "—" : formatRemaining(remaining)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}