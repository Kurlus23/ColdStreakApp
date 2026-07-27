/**
 * ColdAdaptationCard — shows how the user's self-reported Mood, Energy,
 * and Focus check-in ratings have trended month over month.
 *
 * Requires at least 2 calendar months of check-in data to be meaningful.
 * Shows the last 6 months that have data.
 *
 * All language is correlational ("your ratings have trended…") — no
 * physiological claims about adaptation are made.
 */

import { useState } from "react";
import { type Plunge } from "@shared/schema";

interface Props {
  plunges: Plunge[];
}

interface MonthStats {
  label: string;   // "Jan", "Feb", etc.
  year:  number;
  month: number;
  avgMood:   number | null;  // 1–5
  avgEnergy: number | null;  // 1–3
  avgFocus:  number | null;  // 1–3
  count:     number;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function computeMonthStats(plunges: Plunge[]): MonthStats[] {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length === 0) return [];

  // Group by YYYY-MM
  const map = new Map<string, { moodSum: number; energySum: number; focusSum: number; moodC: number; energyC: number; focusC: number; year: number; month: number }>();

  for (const p of rated) {
    const d = new Date(p.createdAt);
    const year  = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-based
    const key   = `${year}-${String(month).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, { moodSum: 0, energySum: 0, focusSum: 0, moodC: 0, energyC: 0, focusC: 0, year, month });
    }
    const s = map.get(key)!;
    if (p.mood       != null) { s.moodSum   += p.mood;       s.moodC++;   }
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyC++; }
    if (p.moodFocus  != null) { s.focusSum  += p.moodFocus;  s.focusC++;  }
  }

  // Sort by date ascending
  const entries = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, s]): MonthStats => ({
      label:     MONTH_LABELS[s.month],
      year:      s.year,
      month:     s.month,
      avgMood:   s.moodC   > 0 ? Math.round((s.moodSum   / s.moodC)   * 10) / 10 : null,
      avgEnergy: s.energyC > 0 ? Math.round((s.energySum / s.energyC) * 10) / 10 : null,
      avgFocus:  s.focusC  > 0 ? Math.round((s.focusSum  / s.focusC)  * 10) / 10 : null,
      count:     s.moodC,
    }));

  // Need at least 2 months to show a trend
  if (entries.length < 2) return [];

  // Show last 6 months with data
  return entries.slice(-6);
}

// Normalise a rating to 0–100 for bar height
function normMood(v: number)   { return Math.round(((v - 1) / 4) * 100); }
function normEnergy(v: number) { return Math.round(((v - 1) / 2) * 100); }
function normFocus(v: number)  { return Math.round(((v - 1) / 2) * 100); }

interface BarColumnProps {
  stat: MonthStats;
  showEnergy: boolean;
  showFocus:  boolean;
}

function BarColumn({ stat, showEnergy, showFocus }: BarColumnProps) {
  const moodPct   = stat.avgMood   != null ? normMood(stat.avgMood)     : 0;
  const energyPct = stat.avgEnergy != null ? normEnergy(stat.avgEnergy) : 0;
  const focusPct  = stat.avgFocus  != null ? normFocus(stat.avgFocus)   : 0;

  return (
    <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
      {/* Bar group */}
      <div className="w-full flex items-end justify-center gap-[2px] h-14">
        {/* Mood bar — cyan */}
        <div className="flex-1 flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ maxWidth: 10 }}>
          <div
            className="rounded-t-sm transition-all duration-500"
            style={{ height: `${moodPct}%`, backgroundColor: "#22d3ee", minHeight: moodPct > 0 ? 2 : 0 }}
          />
        </div>
        {/* Energy bar — amber */}
        {showEnergy && (
          <div className="flex-1 flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ maxWidth: 10 }}>
            <div
              className="rounded-t-sm transition-all duration-500"
              style={{ height: `${energyPct}%`, backgroundColor: "#fbbf24", minHeight: energyPct > 0 ? 2 : 0 }}
            />
          </div>
        )}
        {/* Focus bar — violet */}
        {showFocus && (
          <div className="flex-1 flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ maxWidth: 10 }}>
            <div
              className="rounded-t-sm transition-all duration-500"
              style={{ height: `${focusPct}%`, backgroundColor: "#a78bfa", minHeight: focusPct > 0 ? 2 : 0 }}
            />
          </div>
        )}
      </div>

      {/* Month label */}
      <p className="text-blue-400 text-[8px] font-semibold truncate w-full text-center">{stat.label}</p>
    </div>
  );
}

const COLLAPSE_KEY = "coldstreak-adaptation-card-collapsed";

export function ColdAdaptationCard({ plunges }: Props) {
  const months = computeMonthStats(plunges);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );

  if (months.length < 2) return null;

  const hasEnergy = months.some((m) => m.avgEnergy != null);
  const hasFocus  = months.some((m) => m.avgFocus  != null);

  // Detect overall trend direction (first vs last month composite)
  const composite = (m: MonthStats) => {
    const parts: number[] = [];
    if (m.avgMood   != null) parts.push((m.avgMood   - 1) / 4);
    if (m.avgEnergy != null) parts.push((m.avgEnergy - 1) / 2);
    if (m.avgFocus  != null) parts.push((m.avgFocus  - 1) / 2);
    return parts.length > 0 ? parts.reduce((s, v) => s + v, 0) / parts.length : 0;
  };
  const firstScore = composite(months[0]);
  const lastScore  = composite(months[months.length - 1]);
  const delta      = lastScore - firstScore;
  const trendLabel = delta > 0.05 ? "↑ Trending up" : delta < -0.05 ? "↓ Trending down" : "→ Holding steady";
  const trendColor = delta > 0.05 ? "#6ee7b7" : delta < -0.05 ? "#f87171" : "#94a3b8";

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  return (
    <div
      data-testid="cold-adaptation-card"
      className="mb-4 rounded-2xl border border-blue-700/40 bg-blue-950/60 p-4 shadow"
    >
      {/* Header — tappable to collapse */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">❄️</span>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Cold Adaptation</p>
            <p className="text-blue-400 text-[10px] leading-tight mt-0.5">
              How your check-in ratings have trended
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold" style={{ color: trendColor }}>
            {trendLabel}
          </span>
          <span className="text-blue-500 text-xs">{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 mb-2">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2 rounded-sm bg-[#22d3ee]" />
              <span className="text-[9px] text-blue-300">Mood</span>
            </div>
            {hasEnergy && (
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2 rounded-sm bg-[#fbbf24]" />
                <span className="text-[9px] text-blue-300">Energy</span>
              </div>
            )}
            {hasFocus && (
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2 rounded-sm bg-[#a78bfa]" />
                <span className="text-[9px] text-blue-300">Focus</span>
              </div>
            )}
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-2 bg-blue-900/30 rounded-xl px-3 pt-2 pb-1">
            {months.map((m) => (
              <BarColumn
                key={`${m.year}-${m.month}`}
                stat={m}
                showEnergy={hasEnergy}
                showFocus={hasFocus}
              />
            ))}
          </div>

          {/* Scores row */}
          <div className="flex gap-2 mt-2">
            {months.map((m) => (
              <div key={`${m.year}-${m.month}`} className="flex-1 text-center">
                {m.avgMood != null && (
                  <p className="text-[8px] text-cyan-400 font-semibold leading-none">{m.avgMood}</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-slate-600 text-[9px] leading-relaxed mt-2">
            Bars show monthly average self-reported ratings. Higher = better reported response after plunging. Correlational only — not a medical measurement.
          </p>
        </>
      )}
    </div>
  );
}
