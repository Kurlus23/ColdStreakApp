import { useState } from "react";

const ringRadius = 126;
const ringCircumference = 2 * Math.PI * ringRadius;
const progress = ringCircumference * 0.35;

export function InterludeC() {
  const [stopped, setStopped] = useState(false);

  return (
    <div
      className="relative h-[844px] w-[390px] overflow-hidden text-slate-100"
      style={{
        background:
          "linear-gradient(180deg, #0c2a42 0%, #071a2e 50%, #040f1e 100%)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        className="pointer-events-none absolute -left-28 -top-24 h-[300px] w-[300px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,.06) 0%, transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,.06) 0%, transparent 68%)",
        }}
      />

      <header className="relative z-10 pt-14 text-center">
        <div
          className="text-[13px] font-bold uppercase tracking-[0.2em]"
          style={{
            background: "linear-gradient(100deg, #f8fafc 12%, #22d3ee 58%, #2dd4bf)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          COLDSTREAK
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
          BRAIN FREEZE MODE
        </div>
      </header>

      <main className="absolute inset-0 z-10">
        <div className="absolute left-1/2 top-[190px] -translate-x-1/2">
          <svg
            aria-label="Brain freeze timer at one minute forty two seconds"
            className="h-[280px] w-[280px]"
            viewBox="0 0 280 280"
          >
            <circle
              cx="140"
              cy="140"
              r={ringRadius}
              fill="none"
              stroke="rgba(34,211,238,0.15)"
              strokeWidth="9"
            />
            <circle
              cx="140"
              cy="140"
              r={ringRadius}
              fill="none"
              stroke="#22d3ee"
              strokeLinecap="round"
              strokeWidth="9"
              strokeDasharray={`${progress} ${ringCircumference}`}
              style={{ filter: "drop-shadow(0 0 7px rgba(34,211,238,.85))" }}
              transform="rotate(-90 140 140)"
            />
            <circle
              cx="242"
              cy="214"
              r="6"
              fill="#67e8f9"
              style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }}
            />
            <text
              x="140"
              y="145"
              fill="#f8fafc"
              textAnchor="middle"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: "-0.07em",
                textShadow: "0 0 20px rgba(34,211,238,.6)",
              }}
            >
              01:42
            </text>
            <text
              x="140"
              y="174"
              fill="#94a3b8"
              textAnchor="middle"
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.2em",
              }}
            >
              ELAPSED
            </text>
          </svg>
        </div>

        <section
          className="absolute left-5 right-5 top-[470px] flex h-[90px] flex-col items-center justify-center rounded-xl border px-4 py-4 text-center"
          style={{
            background: "rgba(6,182,212,0.06)",
            borderColor: "rgba(34,211,238,0.2)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 20px rgba(34,211,238,0.25)",
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
            🧠 BRAIN FREEZE INCOMING
          </div>
          <div
            className="mt-0.5 text-[72px] font-extrabold leading-[0.85] text-white"
            style={{ textShadow: "0 0 30px #22d3ee" }}
          >
            3
          </div>
        </section>
      </main>

      <div className="absolute inset-x-6 bottom-10 z-20 flex flex-col gap-4">
        <div
          className="flex h-[69px] items-center justify-between rounded-full border px-6"
          style={{
            background: "rgba(6,182,212,0.07)",
            borderColor: "rgba(34,211,238,0.2)",
          }}
        >
          <div className="text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">LIVE TEMP</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-white">39°F</div>
          </div>
          <div className="h-9 w-px" style={{ background: "linear-gradient(transparent, rgba(34,211,238,.2), transparent)" }} />
          <div className="text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-cyan-300">COLD SCORE</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-cyan-300">4.2</div>
          </div>
          <div className="h-9 w-px" style={{ background: "linear-gradient(transparent, rgba(34,211,238,.2), transparent)" }} />
          <div className="text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-300">PERS. BEST</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-amber-300">6.1</div>
          </div>
        </div>

        <div className="flex gap-1.5">
          {[
            { emoji: "⚡", color: "#22d3ee", bg: "rgba(22,78,99,.18)", width: "100%" },
            { emoji: "😊", color: "#fbbf24", bg: "rgba(120,53,15,.18)", width: "70%" },
            { emoji: "🔥", color: "#fb923c", bg: "rgba(124,45,18,.44)", width: "0%" },
            { emoji: "💪", color: "#34d399", bg: "rgba(6,78,59,.44)", width: "0%" },
          ].map((segment) => (
            <div key={segment.emoji} className="flex-1">
              <div
                className="relative h-2 overflow-hidden rounded-sm border"
                style={{ background: segment.bg, borderColor: `${segment.color}bb` }}
              >
                <div className="h-full rounded-sm" style={{ width: segment.width, background: segment.color }} />
              </div>
              <div className="mt-1 text-center text-[11px] leading-none">{segment.emoji}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStopped(true)}
          className="h-[72px] w-full rounded-2xl text-[20px] font-extrabold tracking-[0.08em] text-white transition-transform active:scale-[.98]"
          style={{
            background: stopped
              ? "linear-gradient(#64748b, #334155)"
              : "linear-gradient(#ef4444, #b91c1c)",
            boxShadow: stopped ? "none" : "0 0 20px rgba(239,68,68,.4)",
          }}
        >
          {stopped ? "STOPPED" : "STOP"}
        </button>
      </div>
    </div>
  );
}