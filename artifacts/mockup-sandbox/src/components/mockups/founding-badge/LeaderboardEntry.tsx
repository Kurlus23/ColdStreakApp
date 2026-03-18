export function LeaderboardEntry() {
  const entries = [
    { rank: 1, username: "IceKing88",   duration: "5:00", temp: "38°F", score: "98", founding: true,  vl: 3, gps: true  },
    { rank: 2, username: "ArcticAlex",  duration: "4:30", temp: "42°F", score: "91", founding: true,  vl: 3, gps: false },
    { rank: 3, username: "FrostByte",   duration: "4:00", temp: "45°F", score: "85", founding: false, vl: 2, gps: true  },
    { rank: 4, username: "ChillSeeker", duration: "3:15", temp: "48°F", score: "74", founding: false, vl: 1, gps: false },
    { rank: 5, username: "ColdNewbie",  duration: "1:30", temp: "55°F", score: "42", founding: false, vl: 0, gps: false },
  ];

  const rankIcons  = ["🥇", "🥈", "🥉"];
  const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

  function VerificationBadge({ vl, gps }: { vl: number; gps: boolean }) {
    if (vl === 0 && !gps) return null;
    const timerOn = vl === 1 || vl === 3;
    const photoOn = vl === 2 || vl === 3;
    const icons   = [timerOn && "⏱", photoOn && "📸", gps && "📍"].filter(Boolean).join("");
    const label   = vl === 3 && gps ? "✓ " + icons : icons;
    const color   = gps && vl === 3
      ? "bg-violet-500/20 border-violet-400/40 text-violet-200"
      : gps
      ? "bg-violet-500/20 border-violet-400/40 text-violet-300"
      : vl === 3
      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
      : vl === 2
      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
      : "bg-blue-500/20 border-blue-400/40 text-blue-300";
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border shrink-0 ${color}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-blue-950/80 rounded-2xl border border-blue-700/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-800/50">
          <div className="text-white font-bold text-sm">🏊 Barton Creek Greenbelt</div>
          <div className="text-blue-400 text-xs">Local Leaderboard</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <span className="text-blue-500 text-[9px] font-medium uppercase tracking-wide">Verification:</span>
            <span className="inline-flex items-center gap-1 text-[9px] text-blue-300">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/40 text-blue-300 font-bold text-[9px]">⏱</span> Timer
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-cyan-300">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-bold text-[9px]">📸</span> Photo
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-300">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[9px]">✓</span> Timer+Photo
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] text-violet-300">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/40 text-violet-300 font-bold text-[9px]">📍</span> GPS
            </span>
          </div>
        </div>
        <div className="divide-y divide-blue-900/40">
          {entries.map((e) => (
            <div
              key={e.rank}
              className={`flex items-center gap-3 px-4 py-3 ${e.rank === 1 ? "bg-yellow-500/5" : ""}`}
            >
              <div className={`text-lg font-bold w-7 text-center shrink-0 ${e.rank <= 3 ? rankColors[e.rank - 1] : "text-blue-500"}`}>
                {e.rank <= 3 ? rankIcons[e.rank - 1] : e.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-semibold text-sm">{e.username}</span>
                  {e.founding && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold leading-none">
                      🎖️ Founder
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-blue-400 text-xs">{e.duration} · {e.temp}</span>
                  <VerificationBadge vl={e.vl} gps={e.gps} />
                </div>
              </div>
              <div className="text-white font-bold text-sm shrink-0">{e.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
