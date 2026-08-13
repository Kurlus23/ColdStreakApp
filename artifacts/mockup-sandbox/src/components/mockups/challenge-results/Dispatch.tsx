import { Share2, X } from "lucide-react";

export function Dispatch() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-12 px-7 relative overflow-hidden"
      style={{ background: "#040810" }}>

      {/* Subtle ambient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.09) 0%, transparent 65%)" }} />

      {/* X */}
      <button className="absolute top-12 right-5 text-slate-700">
        <X size={20} />
      </button>

      {/* Win badge */}
      <div className="flex items-center gap-2 z-10 mt-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
          style={{ background: "rgba(234,179,8,0.12)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.25)" }}>
          You won ❄️
        </span>
      </div>

      {/* HERO: cold take as poster text */}
      <div className="flex-1 flex items-center justify-center z-10 px-2">
        <p className="text-center font-black leading-tight tracking-tight"
          style={{
            fontSize: "2.6rem",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: "italic",
            background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 50%, #d97706 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 30px rgba(251,191,36,0.3))",
          }}>
          Still thawing out, Rachael?
        </p>
      </div>

      {/* Secondary: scores */}
      <div className="flex items-center gap-4 z-10 mb-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">You</span>
          <span className="text-2xl font-black" style={{ color: "#fbbf24" }}>11.7</span>
        </div>
        <span className="text-slate-700 font-bold">vs</span>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">Rachael</span>
          <span className="text-2xl font-black text-slate-500">11.4</span>
        </div>
      </div>

      {/* Caption headline */}
      <p className="text-slate-500 text-xs tracking-wide z-10 mb-6">Ice in your veins. ❄️</p>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3 z-10">
        <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-wide border"
          style={{ borderColor: "rgba(234,179,8,0.5)", color: "#fbbf24", background: "rgba(234,179,8,0.08)" }}>
          <Share2 size={16} /> Share your brag 🏆
        </button>
        <button className="w-full py-2.5 text-slate-600 text-sm">Continue</button>
      </div>
    </div>
  );
}
