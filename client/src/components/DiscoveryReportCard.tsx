/**
 * DiscoveryReportCard — in-app version of the weekly/monthly discovery email.
 *
 * Shows the same insights as the emailed report (sweet spot, morning advantage,
 * diminishing returns, Mood/Energy/Focus distribution bars) so users who miss
 * the email — or have no email on file — still see their personalised patterns.
 *
 * Two period tabs mirror the two email cadences:
 *   • Last 7 days  → equivalent to the weekly report window
 *   • Last 30 days → equivalent to the monthly report window
 *
 * Analysis is performed by shared/reportAnalysis.ts — the same functions that
 * build the email — so in-app and email results can never drift apart.
 *
 * Requires ≥ 3 rated check-ins in the chosen window to show anything.
 * Collapsible, with state persisted to localStorage.
 */

import { useState, useMemo } from "react";
import { type Plunge } from "@shared/schema";
import { analysePatterns, computeStats, type ReportRow } from "@shared/reportAnalysis";

interface Props {
  plunges: Plunge[];
}

// ── Period definitions (mirror server email cadences) ─────────────────────────

type Period = "7d" | "30d";

const PERIODS: { id: Period; label: string; days: number; description: string }[] = [
  { id: "7d",  label: "Last 7 days",  days: 7,  description: "same window as weekly email"  },
  { id: "30d", label: "Last 30 days", days: 30, description: "same window as monthly email" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toReportRow(p: Plunge): ReportRow {
  return {
    duration:    p.duration,
    temperature: p.temperature,
    mood:        p.mood ?? null,
    moodEnergy:  p.moodEnergy ?? null,
    moodFocus:   p.moodFocus ?? null,
    score:       p.score ?? null,
    createdAt:   new Date(p.createdAt),
  };
}

// ── Mini bar component ─────────────────────────────────────────────────────────

interface MiniBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function MiniBar({ label, count, total, color }: MiniBarProps) {
  if (count === 0) return null;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-400 w-24 shrink-0 leading-none">{label}</span>
      <div className="flex-1 bg-blue-950/80 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-slate-500 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const COLLAPSE_KEY = "coldstreak-discovery-report-collapsed";
const PERIOD_KEY   = "coldstreak-discovery-report-period";

export function DiscoveryReportCard({ plunges }: Props) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const [period, setPeriod] = useState<Period>(
    () => (localStorage.getItem(PERIOD_KEY) as Period | null) ?? "7d",
  );

  // Filter plunges to the selected rolling window
  const windowRows = useMemo<ReportRow[]>(() => {
    const periodDef = PERIODS.find((p) => p.id === period)!;
    const cutoff = new Date(Date.now() - periodDef.days * 24 * 60 * 60 * 1000);
    return plunges
      .filter((p) => new Date(p.createdAt) >= cutoff)
      .map(toReportRow);
  }, [plunges, period]);

  // Run the same analysis the email uses
  const stats = useMemo(() => {
    const rated = windowRows.filter((r) => r.mood != null);
    if (rated.length < 3) return null;
    return computeStats(windowRows);
  }, [windowRows]);

  const insights = stats ? analysePatterns(windowRows.filter((r) => r.mood != null)) : null;

  // Determine if there's anything meaningful to show (before rendering)
  const hasSweet      = insights && insights.tempLabel && insights.durLabel && insights.sampleSize >= 5;
  const hasAnyInsight = stats && (hasSweet || insights?.morningBest || insights?.diminishing || (stats.moodResponded > 0));

  // Still render the header when there's no data — user can switch period tabs
  const totalRatedInWindow = windowRows.filter((r) => r.mood != null).length;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  const selectPeriod = (p: Period) => {
    setPeriod(p);
    localStorage.setItem(PERIOD_KEY, p);
  };

  // Don't render at all if there are zero rated check-ins across ALL plunges
  const totalRatedAllTime = plunges.filter((p) => p.mood != null).length;
  if (totalRatedAllTime === 0) return null;

  // Mood / Energy / Focus labels
  const moodLabels:   Record<number, string> = { 1: "😞 Rough", 2: "😕 Low", 3: "😐 OK", 4: "🙂 Good", 5: "😄 Great" };
  const energyLabels: Record<number, string> = { 1: "💤 Drained", 2: "⚡ Neutral", 3: "🔋 Energised" };
  const focusLabels:  Record<number, string> = { 1: "🌫️ Worse", 2: "🧠 Same", 3: "🎯 Better" };

  return (
    <div
      data-testid="discovery-report-card"
      className="mb-4 rounded-2xl border border-cyan-700/30 bg-gradient-to-br from-blue-950/80 to-slate-900/80 p-4 shadow"
    >
      {/* Header — tappable to collapse */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Your Last Report</p>
            <p className="text-blue-400 text-[10px] leading-tight mt-0.5">
              Cold-response patterns
              {insights ? ` · ${insights.sampleSize} check-in${insights.sampleSize === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        <span className="text-blue-500 text-xs shrink-0">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">

          {/* Period tabs */}
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPeriod(p.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  period === p.id
                    ? "bg-cyan-600/40 text-cyan-200 border border-cyan-500/40"
                    : "bg-blue-900/40 text-blue-400 border border-transparent hover:bg-blue-800/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* No data in this window */}
          {!hasAnyInsight && (
            <div className="bg-blue-900/40 rounded-xl p-3 text-center">
              <p className="text-slate-400 text-[12px]">
                {totalRatedInWindow === 0
                  ? `No plunges with check-ins in the last ${PERIODS.find((p) => p.id === period)!.days} days.`
                  : `Need at least 3 rated check-ins — you have ${totalRatedInWindow} so far in this window.`}
              </p>
              <p className="text-slate-500 text-[10px] mt-1">Try switching to a longer window or add more check-ins after plunging.</p>
            </div>
          )}

          {hasAnyInsight && stats && insights && (
            <>
              {/* ── Sweet spot ── */}
              {hasSweet ? (
                <div className="bg-blue-900/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">🎯</span>
                    <p className="text-white text-[12px] font-semibold leading-tight">Your Current Sweet Spot</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <div className="bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-cyan-300 text-xs font-bold leading-tight">{insights.tempLabel}</p>
                      <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">Temp</p>
                    </div>
                    <div className="bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-cyan-300 text-xs font-bold leading-tight">{insights.durLabel}</p>
                      <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">Duration</p>
                    </div>
                    <div className="bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-emerald-300 text-xs font-bold leading-tight">{insights.sweetSpotFor ?? "Overall"}</p>
                      <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">Best for</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-[9px] leading-relaxed">
                    Sessions in this range are most <em>associated with</em> your highest mood &amp; energy ratings.
                  </p>
                </div>
              ) : insights.sampleSize > 0 && insights.sampleSize < 5 ? (
                <div className="bg-blue-900/40 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-sm">🎯</span>
                  <div>
                    <p className="text-white text-[12px] font-semibold leading-tight">Sweet Spot — Building Data</p>
                    <p className="text-slate-400 text-[11px] leading-relaxed mt-1">
                      {insights.sampleSize} check-in{insights.sampleSize === 1 ? "" : "s"} in this window. A few more and we'll surface your personalised patterns.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* ── Pattern flags ── */}
              {(insights.morningBest || insights.diminishing) && (
                <div className="space-y-2">
                  {insights.morningBest && (
                    <div className="bg-amber-900/20 border border-amber-600/20 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-sm shrink-0">🌅</span>
                      <div>
                        <p className="text-amber-200 text-[12px] font-semibold leading-tight">Morning Timing Advantage</p>
                        <p className="text-slate-400 text-[10px] leading-relaxed mt-0.5">
                          Your pre-10 AM plunges are <em>associated with</em> higher mood ratings compared with later sessions.
                        </p>
                      </div>
                    </div>
                  )}
                  {insights.diminishing && (
                    <div className="bg-rose-900/20 border border-rose-700/20 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-sm shrink-0">📉</span>
                      <div>
                        <p className="text-rose-200 text-[12px] font-semibold leading-tight">Diminishing Returns</p>
                        <p className="text-slate-400 text-[10px] leading-relaxed mt-0.5">
                          Sessions longer than 6 min didn't produce higher mood ratings than your 3–6 min plunges.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── How you felt ── */}
              {stats.moodResponded > 0 && (
                <div className="bg-blue-900/40 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-[12px] font-semibold leading-tight">How You Felt After Plunging</p>
                    <span className="text-[10px] text-slate-400">
                      {stats.moodResponded}/{stats.count} rated
                    </span>
                  </div>

                  {/* Averages row */}
                  <div className="flex gap-2 mb-3">
                    {stats.avgMood != null && (
                      <div className="flex-1 bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-cyan-300 text-xs font-bold">
                          {stats.avgMood}<span className="text-[9px] text-blue-500">/5</span>
                        </p>
                        <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">😊 Mood</p>
                      </div>
                    )}
                    {stats.avgEnergy != null && (
                      <div className="flex-1 bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-amber-300 text-xs font-bold">
                          {stats.avgEnergy}<span className="text-[9px] text-blue-500">/3</span>
                        </p>
                        <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">⚡ Energy</p>
                      </div>
                    )}
                    {stats.avgFocus != null && (
                      <div className="flex-1 bg-blue-950/60 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-violet-300 text-xs font-bold">
                          {stats.avgFocus}<span className="text-[9px] text-blue-500">/3</span>
                        </p>
                        <p className="text-blue-500 text-[9px] uppercase tracking-wide mt-0.5">🧠 Focus</p>
                      </div>
                    )}
                  </div>

                  {/* Mood distribution */}
                  <p className="text-[9px] text-blue-500 uppercase tracking-wide mb-1.5">Mood breakdown</p>
                  <div className="space-y-1 mb-3">
                    {[5, 4, 3, 2, 1].map((r) => (
                      <MiniBar
                        key={r}
                        label={moodLabels[r]}
                        count={stats.moodCounts[r] ?? 0}
                        total={stats.moodResponded}
                        color={r >= 4 ? "#22d3ee" : r === 3 ? "#6ee7b7" : "#94a3b8"}
                      />
                    ))}
                  </div>

                  {/* Energy distribution */}
                  {stats.avgEnergy != null && (
                    <>
                      <p className="text-[9px] text-blue-500 uppercase tracking-wide mb-1.5">Energy breakdown</p>
                      <div className="space-y-1 mb-3">
                        {[3, 2, 1].map((r) => (
                          <MiniBar
                            key={r}
                            label={energyLabels[r]}
                            count={stats.energyCounts[r] ?? 0}
                            total={stats.moodResponded}
                            color={r === 3 ? "#fbbf24" : r === 2 ? "#6ee7b7" : "#94a3b8"}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Focus distribution */}
                  {stats.avgFocus != null && (
                    <>
                      <p className="text-[9px] text-blue-500 uppercase tracking-wide mb-1.5">Focus breakdown</p>
                      <div className="space-y-1">
                        {[3, 2, 1].map((r) => (
                          <MiniBar
                            key={r}
                            label={focusLabels[r]}
                            count={stats.focusCounts[r] ?? 0}
                            total={stats.moodResponded}
                            color={r === 3 ? "#a78bfa" : r === 2 ? "#fbbf24" : "#94a3b8"}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <p className="text-slate-600 text-[9px] leading-relaxed">
            Patterns are based on your self-reported check-ins and are correlational only — not medical data.
          </p>
        </div>
      )}
    </div>
  );
}
