export function AchievementsCard() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-2">
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-900/40 to-yellow-900/20 border border-amber-500/40">
          <span className="text-4xl leading-none shrink-0">🎖️</span>
          <div className="min-w-0">
            <div className="text-amber-300 font-bold text-base leading-tight">Founding Plunger</div>
            <div className="text-amber-200/60 text-xs mt-1 leading-relaxed">
              One of the first 1,000 people to go Pro. This exclusive title appears on your profile and leaderboard entries.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-blue-950/80 border border-blue-700/50 opacity-60">
          <span className="text-3xl leading-none shrink-0">❄️</span>
          <div>
            <div className="text-white font-semibold text-sm">Cold Blooded</div>
            <div className="text-blue-400 text-xs mt-0.5">Plunged at 40–49°F</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-blue-950/80 border border-blue-700/50 opacity-60">
          <span className="text-3xl leading-none shrink-0">🔥</span>
          <div>
            <div className="text-white font-semibold text-sm">7-Day Streak</div>
            <div className="text-blue-400 text-xs mt-0.5">7 consecutive days</div>
          </div>
        </div>
      </div>
    </div>
  );
}
