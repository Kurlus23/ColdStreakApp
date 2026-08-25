interface FriendBrainFreezeScoreProps {
  scoreThisPlunge?: number | null;
  scoreToday?: number;
  scoreAllTime?: number;
}

const metricLabelClass =
  "min-w-0 text-center text-[8px] leading-tight font-semibold uppercase tracking-[0.12em] text-blue-500";

export function FriendBrainFreezeScore({
  scoreThisPlunge,
  scoreToday = 0,
  scoreAllTime = 0,
}: FriendBrainFreezeScoreProps) {
  return (
    <div
      className="rounded-[18px] border border-cyan-400/20 bg-gradient-to-br from-blue-950/80 to-blue-900/50 p-3.5 shadow-[inset_0_1px_0_rgba(207,250,254,0.07)]"
      aria-label="Brain Freeze score"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[9px] font-bold tracking-[0.15em] text-blue-400/80">
            FRIEND SCORE
          </p>
          <h3
            className="text-[16px] font-semibold leading-tight text-cyan-50"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Brain Freeze
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[8px] font-bold tracking-[0.13em] text-cyan-200">
          SCORE
        </span>
      </div>

      <div className="my-3 h-px bg-gradient-to-r from-cyan-300/30 to-transparent" />

      <div
        className="grid grid-cols-3 gap-0 overflow-hidden rounded-xl"
        style={{
          border: "1px solid rgba(34,211,238,0.13)",
          background: "rgba(8,30,60,0.55)",
        }}
      >
        <div className="flex min-w-0 flex-col items-center justify-center gap-1 border-r border-cyan-900/40 px-1.5 py-2">
          <span className={metricLabelClass}>Last Plunge</span>
          <span className="text-[11px] font-bold leading-none text-cyan-200">
            {scoreThisPlunge != null ? scoreThisPlunge : "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center gap-1 border-r border-cyan-900/40 px-1.5 py-2">
          <span className={metricLabelClass}>Today</span>
          <span className="text-[11px] font-bold leading-none text-cyan-300">
            {scoreToday > 0 ? scoreToday : "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2">
          <span className={metricLabelClass}>All Time</span>
          <span className="text-[11px] font-bold leading-none text-cyan-300">
            {scoreAllTime > 0 ? scoreAllTime : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}