export function UpgradeBanner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-gradient-to-b from-blue-950 to-slate-950 rounded-3xl border border-blue-700/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-xl">👑</span>
            <span className="text-white font-bold text-lg">ColdStreak Pro</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">$7.99</div>
            <div className="text-blue-400 text-[10px]">one-time</div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
          <span className="text-2xl">🎖️</span>
          <div>
            <div className="text-amber-300 font-bold text-sm leading-tight">Become a Founding Plunger</div>
            <div className="text-amber-200/70 text-xs">
              Only 42 spots remaining! · Exclusive badge on your profile &amp; leaderboard
            </div>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-white">
          {[
            { icon: "📅", text: "Unlimited plunge history" },
            { icon: "🗺️", text: "Chill Places & leaderboards" },
            { icon: "🚫", text: "No ads, ever" },
            { icon: "🎖️", text: "Founding Plunger badge — first 1,000 only" },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <span className="w-6 text-center">{icon}</span>
              {text}
            </li>
          ))}
        </ul>

        <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black text-base shadow-lg shadow-cyan-500/30">
          Get Lifetime Access — $7.99
        </button>
      </div>
    </div>
  );
}
