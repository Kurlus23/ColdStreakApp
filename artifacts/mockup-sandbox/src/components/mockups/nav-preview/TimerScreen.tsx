import { History, Compass, ShoppingCart, Trophy, Settings, Bluetooth, Snowflake, Heart, RotateCcw, Play } from "lucide-react";

export function TimerScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="relative w-[390px] h-[780px] bg-slate-900 rounded-[44px] overflow-hidden shadow-2xl border border-slate-700/50" style={{ fontFamily: "system-ui, sans-serif" }}>

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 z-20">
          <span className="text-white text-xs font-semibold">9:41</span>
          <span className="text-white text-xs font-semibold">ColdStreak</span>
          <span className="text-white text-xs font-semibold">🔋</span>
        </div>

        {/* Background iceberg */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-900 via-blue-950 to-slate-950" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

        {/* Main content area */}
        <div className="absolute top-12 bottom-24 left-0 right-0 px-3 py-3 flex flex-col gap-2.5">

          {/* 3-col cards */}
          <div className="grid grid-cols-3 gap-2 mt-auto" style={{ marginTop: "auto" }}>

            {/* Water Temp */}
            <div className="bg-blue-900/80 backdrop-blur rounded-2xl p-3 border border-blue-700/40 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <div className="text-blue-300 text-[9px] font-semibold uppercase tracking-widest">Water Temp</div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-[8px] font-semibold">Live</span>
                </div>
              </div>
              <div className="text-white text-3xl font-bold leading-none my-2">50°F</div>
              <div className="flex bg-blue-800/70 rounded-lg p-0.5 gap-0.5">
                <div className="flex-1 text-[10px] py-1 rounded-md font-bold text-center bg-white text-blue-900">°F</div>
                <div className="flex-1 text-[10px] py-1 rounded-md font-bold text-center text-blue-300">°C</div>
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[9px] text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span>TP25 Probe 1</span>
              </div>
            </div>

            {/* Timer */}
            <div className="bg-blue-900/80 backdrop-blur rounded-2xl p-3 border border-blue-700/40 flex flex-col items-center">
              <div className="text-blue-300 text-[9px] font-semibold uppercase tracking-widest mb-1">Stopwatch</div>
              <div className="text-white text-3xl font-bold leading-none my-2">0:00</div>
              <div className="flex gap-1.5 mt-1">
                <div className="flex-1 py-1.5 rounded-xl bg-cyan-600 text-white text-[11px] font-bold text-center">Start</div>
                <div className="flex-1 py-1.5 rounded-xl bg-slate-700 text-white text-[11px] font-bold text-center">Stop</div>
              </div>
            </div>

            {/* Cold Score */}
            <div className="bg-blue-900/80 backdrop-blur rounded-2xl p-3 border border-blue-700/40 flex flex-col items-center justify-center gap-1">
              <div className="text-blue-300 text-[9px] font-semibold uppercase tracking-widest">Cold Score</div>
              <Snowflake className="w-7 h-7 text-cyan-400" />
              <div className="text-white text-xl font-bold">0.0</div>
              <div className="text-blue-400 text-[9px]">today</div>
            </div>
          </div>

          {/* HR strip */}
          <div className="bg-blue-900/80 backdrop-blur rounded-2xl px-3.5 py-2.5 border border-blue-700/40 flex items-center gap-3">
            <Heart className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
            <div className="flex items-baseline gap-1.5 flex-1">
              <span className="text-white text-2xl font-bold leading-none">72</span>
              <span className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest">BPM</span>
              <span className="text-red-300/80 text-[10px] ml-1">↑88</span>
            </div>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          </div>

          {/* Weekly */}
          <div className="text-center text-white/90 text-sm font-semibold">
            Weekly: 6.4 / 11 min · Streak: 3 days
          </div>
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-blue-950/95 backdrop-blur border-t border-blue-800/60 flex items-center px-2">
          {[
            { icon: <History className="w-5 h-5" />, label: "History", active: false },
            { icon: <Compass className="w-5 h-5" />, label: "Explore", active: false },
            { icon: <ShoppingCart className="w-5 h-5" />, label: "Gear", active: false },
            { icon: <Trophy className="w-5 h-5" />, label: "Badges", active: false },
            { icon: (
              <div className="relative">
                <Bluetooth className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-blue-950" />
              </div>
            ), label: "Devices", active: false },
            { icon: <Settings className="w-5 h-5" />, label: "Settings", active: false },
          ].map((item, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center gap-1 ${i === 4 ? "text-cyan-400" : "text-blue-500"}`}>
              {item.icon}
              <span className="text-[9px] font-semibold">{item.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
