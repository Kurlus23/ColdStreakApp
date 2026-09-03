import {
  ChevronDown,
  Compass,
  History,
  Settings,
  ShoppingCart,
  User,
  Users,
} from "lucide-react";
import "./_group.css";

// Static idle-state extraction of the current ColdStreak home / timer screen.
export function CurrentHome() {
  return (
    <div className="coldstreak-home relative h-screen w-full overflow-hidden bg-blue-950 select-none">
      <img src="/__mockup/bg_frostlake.png" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center center" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 via-blue-900/20 to-blue-950/80" />

      <header className="absolute z-10 inset-x-0 top-0 flex items-center justify-end px-3 pt-5 pb-2">
        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl min-[420px]:text-2xl font-black tracking-widest pointer-events-none select-none" style={{ background: "linear-gradient(to bottom, #ffffff 0%, #67e8f9 60%, #0891b2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.7))", letterSpacing: "0.12em" }}>COLDSTREAK</h1>
        <button className="absolute left-[calc(50%+100px)] min-[420px]:left-[calc(50%+122px)] inline-flex items-center gap-1 rounded-xl border border-blue-700/50 bg-blue-950/75 px-2.5 py-2 text-blue-100 shadow-lg shadow-black/20 backdrop-blur-md">
          <span className="text-[11px] font-bold tracking-wide">Tools</span><ChevronDown className="h-3.5 w-3.5" />
        </button>
        <div className="w-24" aria-hidden="true" />
      </header>

      <main className="absolute top-20 bottom-[10.25rem] left-0 right-0 overflow-y-auto overscroll-contain px-3">
        <div className="flex min-h-full flex-col justify-center pb-2">
          <div className="rounded-2xl mb-3 relative bg-blue-950/90 backdrop-blur-sm border border-blue-800/50">
            <div className="grid grid-cols-3">
              <div className="flex flex-col items-center px-2 py-2.5 relative">
                <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Water</span>
                <span className="text-[2.4rem] font-bold leading-none text-white">50°F</span>
                <div className="flex items-center gap-1.5 mt-1.5"><span className="text-[10px] font-bold text-white">°F</span><span className="text-blue-600/60 text-[10px]">/</span><span className="text-[10px] font-bold text-blue-400/60">°C</span></div>
                <div className="absolute right-0 top-3 bottom-3 w-px bg-blue-800/50" />
              </div>
              <div className="flex flex-col items-center px-2 py-2.5 relative">
                <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Timer</span>
                <span className="text-[2.4rem] leading-none font-mono font-bold tracking-tight text-slate-200">0:00</span>
                <div className="flex gap-1.5 mt-2.5 w-full"><button className="flex-1 min-w-0 py-1.5 rounded-xl bg-blue-500/90 text-white text-[10px] font-bold shadow-lg shadow-blue-500/30">Start</button><button className="flex-1 min-w-0 py-1.5 rounded-xl border border-slate-600/60 text-slate-300 text-[10px] font-bold">Stop</button></div>
                <div className="absolute right-0 top-3 bottom-3 w-px bg-blue-800/50" />
              </div>
              <div className="relative flex flex-col items-center px-2 py-2.5">
                <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Score</span>
                <span className="text-[2.4rem] font-bold leading-none text-cyan-300" style={{ textShadow: "0 0 20px rgba(103,232,249,0.35)" }}>—</span>
                <span className="text-[8px] mt-1.5 text-blue-300/60">today</span><span className="text-blue-300/60 text-[8px] uppercase tracking-widest mt-auto pt-2">Tap to cycle</span>
                <span className="absolute top-2 right-2 z-20 w-5 h-5 flex items-center justify-center rounded-full bg-blue-800/70 border border-blue-600/50 text-blue-400 text-[10px] font-bold">ℹ</span>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-blue-800/30">
              <div className="flex items-center justify-center px-2 pt-2 pb-2.5 relative" style={{ minHeight: "2rem" }}><span className="text-[9px] font-bold uppercase tracking-widest text-blue-700/40">Live</span><div className="absolute right-0 top-2 bottom-2 w-px bg-blue-800/50" /></div>
              <div className="flex items-center justify-center px-2 pt-2 pb-2.5 relative"><span className="text-blue-300/60 text-[8px] uppercase tracking-widest">Stopwatch ↕</span><div className="absolute right-0 top-2 bottom-2 w-px bg-blue-800/50" /></div>
              <div className="flex flex-col justify-center px-3 pt-2 pb-2.5"><div className="flex justify-between mb-1"><span className="text-blue-300/60 text-[8px]">0d</span><span className="text-blue-300/60 text-[8px]">⚡ 1d</span></div><div className="h-0.5 rounded-full bg-blue-900"><div className="h-full w-0 rounded-full" /></div></div>
            </div>
          </div>

        </div>
      </main>

      <div className="absolute inset-x-0 bottom-20 z-10 px-3">
        <div className="rounded-2xl border border-blue-800/60 bg-blue-950/90 px-[14px] pb-[9px] pt-[8px] backdrop-blur-md" style={{ boxShadow: "0 8px 20px rgba(3, 12, 35, 0.16)" }}>
          <div className="grid grid-cols-4 gap-3">
            {[["Energy", "#22d3ee"], ["Mood", "#fbbf24"], ["Metabolism", "#f97316"], ["Recovery", "#34d399"]].map(([label, color]) => <div key={label} className="relative min-w-0"><div className="box-border flex h-[17px] items-center justify-center text-center text-[10px] leading-none whitespace-nowrap" style={{ color }}><strong className="overflow-hidden text-ellipsis font-semibold">{label}</strong></div><div className="relative mt-[10px] h-[3px] rounded-full bg-[rgba(157,203,207,0.14)]"><span className="absolute top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ left: "0%", borderColor: "#08131b", backgroundColor: color, boxShadow: `0 0 0 1px ${color}, 0 0 8px ${color}88` }} /></div></div>)}
          </div>
          <p className="mt-[7px] text-center text-[9px] leading-tight text-slate-500"><span className="block">Estimates vary with session conditions and profile settings</span><span className="mt-0.5 block">Not medical guidance</span></p>
        </div>
      </div>

      <nav className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/90 backdrop-blur-md border-t border-blue-800/60">
        <div className="flex items-center h-full max-w-xl mx-auto px-2">
          {[[History, "History"], [Compass, "Explore"], [ShoppingCart, "Gear"], [User, "Profile"], [Users, "Friends"], [Settings, "Settings"]].map(([Icon, label]) => {
            const NavIcon = Icon as typeof History;
            return <button key={label as string} className="flex-1 flex flex-col items-center gap-1 text-blue-500"><NavIcon className="w-5 h-5" /><span className="text-[10px] font-semibold">{label as string}</span></button>;
          })}
        </div>
      </nav>
    </div>
  );
}
