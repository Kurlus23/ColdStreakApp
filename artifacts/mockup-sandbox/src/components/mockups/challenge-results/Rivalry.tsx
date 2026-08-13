import { Share2, X } from "lucide-react";

export function Rivalry() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-12 px-6 relative overflow-hidden"
      style={{ background: "#05080f" }}>

      {/* Glow behind scores */}
      <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(234,179,8,0.12) 0%, transparent 70%)" }} />

      {/* X */}
      <button className="absolute top-12 right-5 text-slate-700">
        <X size={20} />
      </button>

      {/* Top: compact avatars */}
      <div className="flex items-center gap-3 z-10 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
            style={{ background: "rgba(234,179,8,0.18)", border: "1px solid rgba(234,179,8,0.35)" }}>🏆</div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">You</span>
        </div>
        <span className="text-slate-700 font-black text-sm">vs</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rachael</span>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
            style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.2)" }}>🥶</div>
        </div>
      </div>

      {/* HERO: giant scores */}
      <div className="flex items-center justify-center gap-4 z-10 w-full">
        <div className="flex flex-col items-center">
          <span className="font-black leading-none tracking-tighter"
            style={{ fontSize: "86px", color: "#fbbf24", filter: "drop-shadow(0 0 30px rgba(251,191,36,0.5))" }}>
            11.7
          </span>
        </div>
        <span className="text-slate-700 font-black text-3xl pb-2">vs</span>
        <div className="flex flex-col items-center">
          <span className="font-black leading-none tracking-tighter"
            style={{ fontSize: "86px", color: "#334155" }}>
            11.4
          </span>
        </div>
      </div>

      {/* Win margin */}
      <div className="z-10 -mt-6">
        <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
          style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.3)" }}>
          +0.3 pts ahead
        </span>
      </div>

      {/* Headline */}
      <div className="text-center z-10">
        <h2 className="text-xl font-black text-white tracking-tight">Ice in your veins. ❄️</h2>
        <p className="text-slate-500 text-xs mt-1">Rachael never stood a chance</p>
      </div>

      {/* Cold take quote */}
      <div className="w-full max-w-xs z-10">
        <div className="rounded-2xl px-4 py-3 text-center"
          style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)" }}>
          <p className="text-cyan-300 text-sm italic font-medium leading-snug">
            "Still thawing out, Rachael? ❄️"
          </p>
          <p className="text-slate-600 text-[10px] mt-1">Tap Share to send this</p>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3 z-10">
        <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm"
          style={{ background: "linear-gradient(135deg, #0e7490, #06b6d4)", color: "#001a2e", boxShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
          <Share2 size={16} /> Share your brag 🏆
        </button>
        <button className="w-full py-2.5 text-slate-600 text-sm">Continue</button>
      </div>
    </div>
  );
}
