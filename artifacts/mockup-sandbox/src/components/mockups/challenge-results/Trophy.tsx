import { Share2, X } from "lucide-react";

export function Trophy() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "rgba(4,15,30,1)" }}>

      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(234,179,8,0.16) 0%, transparent 65%)" }} />
      </div>

      {/* X */}
      <button className="absolute top-12 right-5 text-slate-600">
        <X size={20} />
      </button>

      {/* Avatars */}
      <div className="flex items-center gap-5 mb-6 z-10">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(234,179,8,0.18)", border: "1px solid rgba(234,179,8,0.4)", boxShadow: "0 0 24px rgba(234,179,8,0.3)" }}>
            🏆
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">You</span>
        </div>
        <span className="text-slate-600 font-black text-2xl">vs</span>
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)" }}>
            🥶
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rachael</span>
        </div>
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-black text-center mb-1 tracking-tight z-10"
        style={{ background: "linear-gradient(to bottom, #fde68a, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        Ice in your veins. ❄️
      </h1>
      <p className="text-slate-400 text-sm text-center mb-7 z-10">Rachael never stood a chance (+0.3)</p>

      {/* Scores */}
      <div className="w-full max-w-xs rounded-2xl p-5 mb-5 flex items-center justify-around z-10"
        style={{ background: "rgba(14,30,54,0.8)", border: "1px solid rgba(34,211,238,0.15)" }}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">You</span>
          <span className="text-4xl font-black" style={{ color: "#fbbf24", filter: "drop-shadow(0 0 12px rgba(251,191,36,0.6))" }}>11.7</span>
        </div>
        <span className="text-slate-600 font-bold text-xl">vs</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rachael</span>
          <span className="text-4xl font-black" style={{ color: "#22d3ee" }}>11.4</span>
        </div>
      </div>

      {/* Cold take */}
      <div className="w-full max-w-xs rounded-2xl px-4 py-3 mb-7 text-center z-10"
        style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
        <p className="text-amber-300 text-sm font-semibold leading-snug">Still thawing out, Rachael? ❄️</p>
        <p className="text-slate-500 text-[10px] mt-1">Tap Share to send this to Rachael</p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3 z-10">
        <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-wide"
          style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#1c1008", boxShadow: "0 0 24px rgba(245,158,11,0.4)" }}>
          <Share2 size={16} /> Share your brag 🏆
        </button>
        <button className="w-full py-2.5 text-slate-500 text-sm">Continue</button>
      </div>
    </div>
  );
}
