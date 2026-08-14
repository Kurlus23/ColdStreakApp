// Grok3 — Bold: filled ? with icy facets + brain in a glowing ring at the base
export function Grok3() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 44 56" width={size} height={size * 56/44} style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,0.45))" }}>
      <defs>
        <linearGradient id="g3-fill" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.97"/>
          <stop offset="35%" stopColor="#7dd3fc" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.95"/>
        </linearGradient>
        <linearGradient id="g3-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bae6fd"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>
        <linearGradient id="g3-brain" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#bae6fd"/>
          <stop offset="100%" stopColor="#0ea5e9"/>
        </linearGradient>
      </defs>

      {/* ── Bold filled ? shape ── */}
      <path d="
        M 14 15
        C 14 8, 19 3, 22 3
        C 25 3, 31 6, 31 14
        C 31 20, 26 23, 24 26
        C 22 28, 21 30, 21 33
        L 23 33
        C 23 31, 24 29, 26 27
        C 28 25, 34 22, 34 14
        C 34 5, 28 0, 22 0
        C 16 0, 11 5, 11 15
        Z"
        fill="url(#g3-fill)"/>
      {/* ? stem */}
      <rect x="20.5" y="33" width="3" height="6" rx="1.5" fill="url(#g3-fill)"/>

      {/* Ice facet highlights on the ? */}
      <path d="M 15 11 C 17 9, 20 11, 21 9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round"/>
      <path d="M 27 7 C 29 6, 31 8, 30 11" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M 26 21 C 28 20, 30 22, 29 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round"/>
      {/* Top sheen */}
      <path d="M 14 11 C 16 9, 19 8, 22 8" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round"/>

      {/* ── Brain in glowing ring ── */}
      {/* Outer glow ring */}
      <circle cx="22" cy="48" r="8.5"
        fill="rgba(2,71,107,0.75)"
        stroke="url(#g3-ring)" strokeWidth="1.8"
        style={{ filter: "drop-shadow(0 0 5px rgba(125,211,252,0.7))" }}/>

      {/* Brain blob inside ring */}
      <path d="
        M 22 43.5
        C 21.5 43, 19 43, 17.5 44.5
        C 16 46, 16.5 48, 17.5 49
        C 16 50, 16.5 51.5, 18.5 51.5
        C 19.5 51.5, 21 51, 22 50.5
        C 23 51, 24.5 51.5, 25.5 51.5
        C 27.5 51.5, 28 50, 26.5 49
        C 27.5 48, 28 46, 26.5 44.5
        C 25 43, 22.5 43, 22 43.5
        Z"
        fill="url(#g3-brain)"
        style={{ filter: "drop-shadow(0 0 3px rgba(56,189,248,0.5))" }}/>

      {/* Center groove */}
      <line x1="22" y1="43.5" x2="22" y2="47" stroke="rgba(2,132,199,0.9)" strokeWidth="1.2" strokeLinecap="round"/>

      {/* Bold fold lines inside the ring — darker than fill */}
      <path d="M 18 46 C 19 45, 20.5 46, 21 45" fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.0" strokeLinecap="round"/>
      <path d="M 23 45 C 23.5 46, 25 45, 26 46"  fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.0" strokeLinecap="round"/>
      <path d="M 17.5 48.5 C 19 47.5, 20.5 48.5, 21.5 47.5" fill="none" stroke="rgba(2,132,199,0.75)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M 22.5 47.5 C 23.5 48.5, 25 47.5, 26.5 48.5" fill="none" stroke="rgba(2,132,199,0.75)" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">? + Brain (Bold)</p>

      <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon size={100}/>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Actual size in header</p>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 18px rgba(103,232,249,0.28)"
             }}>
          <Icon size={26}/>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide mt-1">Play</span>
      </div>

      <p className="text-white/30 text-[11px] text-center px-6">Filled icy ? + brain in glowing ring — bold at any scale</p>
    </div>
  );
}
