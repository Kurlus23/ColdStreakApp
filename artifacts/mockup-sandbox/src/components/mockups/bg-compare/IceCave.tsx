export function IceCave() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900">
      <div
        className="relative overflow-hidden rounded-[2.5rem] shadow-2xl"
        style={{ width: 390, height: 844 }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/bg_icecave.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/80 via-blue-900/20 to-blue-950/90" />

        <div className="relative z-10 flex flex-col h-full px-6 pt-14 pb-8">
          <div className="text-center mb-1">
            <span
              className="text-2xl font-black tracking-widest"
              style={{
                background: "linear-gradient(to right, #ffffff, #67e8f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              COLDSTREAK
            </span>
          </div>

          <div className="flex justify-center gap-6 mb-8 mt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-300">12</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Day Streak</div>
            </div>
            <div className="w-px bg-blue-700/50" />
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-300">847</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Cold Score</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="w-52 h-52 rounded-full border-4 border-cyan-400/40 flex items-center justify-center bg-blue-950/40 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-5xl font-mono font-bold text-white">2:00</div>
                <div className="text-sm text-cyan-300 mt-1 uppercase tracking-widest">Ready</div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="px-8 py-3 rounded-full bg-cyan-500 text-white font-bold text-lg shadow-lg shadow-cyan-500/30">
                Start
              </div>
              <div className="px-6 py-3 rounded-full border border-blue-400/40 text-blue-200 font-semibold">
                Reset
              </div>
            </div>
          </div>

          <div className="flex justify-around items-center pt-4 border-t border-blue-800/40">
            {["🏠", "📍", "🏆", "📜", "⚙️"].map((icon, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{icon}</span>
                <div className={`w-1 h-1 rounded-full ${i === 0 ? "bg-cyan-400" : "bg-transparent"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
