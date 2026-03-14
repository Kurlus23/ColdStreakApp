export function LeaderboardEntry() {
  const entries = [
    { rank: 1, username: "IceKing88", duration: "5:00", temp: "38°F", score: "98", founding: true },
    { rank: 2, username: "ArcticAlex", duration: "4:30", temp: "42°F", score: "91", founding: true },
    { rank: 3, username: "FrostByte", duration: "4:00", temp: "45°F", score: "85", founding: false },
  ];

  const rankIcons = ["🥇", "🥈", "🥉"];
  const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-blue-950/80 rounded-2xl border border-blue-700/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-blue-800/50">
          <div className="text-white font-bold text-sm">🏊 Barton Creek Greenbelt</div>
          <div className="text-blue-400 text-xs">Local Leaderboard</div>
        </div>
        <div className="divide-y divide-blue-900/40">
          {entries.map((e) => (
            <div key={e.rank} className="flex items-center gap-3 px-4 py-3">
              <div className={`text-lg font-bold w-7 text-center shrink-0 ${rankColors[e.rank - 1]}`}>
                {rankIcons[e.rank - 1]}
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
                <div className="text-blue-400 text-xs mt-0.5">{e.duration} · {e.temp}</div>
              </div>
              <div className="text-white font-bold text-sm shrink-0">{e.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
