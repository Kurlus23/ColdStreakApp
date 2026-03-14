export function BadgeProfileHeader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-blue-900/70 rounded-3xl px-5 pt-5 pb-4 border border-blue-700/50 text-center">
        <h1 className="text-white font-bold text-2xl mb-0.5">IceKing88</h1>

        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
            🎖️ Founding Plunger
          </span>
        </div>

        <p className="text-blue-400 text-xs mb-4">Badge Profile · Updated today</p>

        <div className="flex justify-center flex-wrap gap-1 mb-4">
          <span className="text-3xl leading-none">❄️</span>
          <span className="text-3xl leading-none">🥶</span>
          <span className="text-3xl leading-none">🔥</span>
        </div>

        <div className="flex justify-center gap-5 text-center mt-1">
          <div>
            <div className="text-white font-bold text-xl">248</div>
            <div className="text-blue-400 text-[11px]">plunges</div>
          </div>
          <div className="w-px bg-blue-700/60" />
          <div>
            <div className="text-white font-bold text-xl">183</div>
            <div className="text-blue-400 text-[11px]">unique days</div>
          </div>
          <div className="w-px bg-blue-700/60" />
          <div>
            <div className="text-white font-bold text-xl">38°F</div>
            <div className="text-blue-400 text-[11px]">coldest</div>
          </div>
        </div>
      </div>
    </div>
  );
}
