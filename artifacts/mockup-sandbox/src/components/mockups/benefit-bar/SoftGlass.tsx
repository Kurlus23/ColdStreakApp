import type { CSSProperties } from "react";
import "./_group.css";
import "./SoftGlass.css";

const SEGMENTS = [
  { id: "energy", label: "Energy", code: "01", baseDuration: 60, color: "#67e8f9", tint: "103, 232, 249" },
  { id: "mood", label: "Mood", code: "02", baseDuration: 120, color: "#f6cf74", tint: "246, 207, 116" },
  { id: "metabolism", label: "Metabolism", code: "03", baseDuration: 180, color: "#f6a36a", tint: "246, 163, 106" },
  { id: "recovery", label: "Recovery", code: "04", baseDuration: 300, color: "#75dfb2", tint: "117, 223, 178" },
] as const;

const staticSession = {
  elapsedSeconds: 210,
  todayLoggedSeconds: 0,
  tempF: 50,
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
 * Soft Glass Ribbon: a quieter, translucent refinement of the active-session
 * benefit bar. Static session data keeps this preview deterministic.
 */
export function SoftGlass() {
  const compositionFactor = staticSession.bodyFatPct / 20;
  const thresholds = SEGMENTS.map((segment) =>
    Math.round(segment.baseDuration * compositionFactor),
  );
  const totalElapsed = staticSession.todayLoggedSeconds + staticSession.elapsedSeconds;
  const fills = thresholds.map((threshold) =>
    Math.min(100, Math.max(0, (totalElapsed / threshold) * 100)),
  );
  const achievedToday = fills.map((fill) => fill >= 100);

  return (
    <main className="benefit-bar-soft-glass flex min-h-screen items-center justify-center p-4">
      <section className="soft-glass-ribbon w-full max-w-[390px]" aria-label="Active plunge benefits">
        <div className="soft-glass-ribbon__topline">
          <div className="flex min-w-0 items-center gap-2">
            <span className="soft-glass-ribbon__status-dot" aria-hidden="true" />
            <span className="soft-glass-ribbon__eyebrow">Active plunge</span>
            <span className="soft-glass-ribbon__divider" aria-hidden="true" />
            <span className="soft-glass-ribbon__temperature">50°F</span>
          </div>
          <span className="soft-glass-ribbon__goal">Recovery goal</span>
        </div>

        <div className="flex flex-nowrap gap-1.5">
          {SEGMENTS.map((segment, index) => {
            const fill = fills[index];
            const achieved = achievedToday[index];
            const isCurrent = segment.id === staticSession.primaryBenefit;
            const remaining = Math.max(0, thresholds[index] - totalElapsed);

            return (
              <div key={segment.id} className="soft-glass-segment min-w-0 flex-1">
                <div
                  className={`soft-glass-segment__surface ${isCurrent ? "soft-glass-segment__surface--current" : ""}`}
                  style={{
                    "--segment-color": segment.color,
                    "--segment-tint": segment.tint,
                  } as CSSProperties}
                >
                  <div className="soft-glass-segment__wash" style={{ width: `${fill}%` }} />
                  <div className="soft-glass-segment__label">
                    <span className="soft-glass-segment__mark" aria-hidden="true">{segment.code}</span>
                    <span className="truncate">{segment.label}</span>
                  </div>
                  <span className="soft-glass-segment__shine" aria-hidden="true" />
                </div>
                <div className="soft-glass-segment__meta">
                  <span className={achieved ? "soft-glass-segment__max" : ""}>
                    {achieved ? "MAX" : formatRemaining(remaining)}
                  </span>
                  {isCurrent && !achieved ? <span className="soft-glass-segment__current-line">NOW</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}