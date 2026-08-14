// Grok1 — Faithful: frozen ? mark with brain in the circular base, shown at two sizes
export function Grok1() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 44 54" width={size} height={size * 54/44} style={{ filter: "drop-shadow(0 0 6px rgba(103,232,249,0.5))" }}>
      <defs>
        <linearGradient id="g1-q" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#e0f2fe"/>
          <stop offset="40%" stopColor="#7dd3fc"/>
          <stop offset="100%" stopColor="#0284c7"/>
        </linearGradient>
        <linearGradient id="g1-brain" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#bae6fd"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>
      </defs>

      {/* ── Question mark arc (the hook) ── */}
      {/* Outer filled path of the ? */}
      <path d="
        M 12 14
        C 12 7, 18 3, 22 3
        C 26 3, 32 6, 32 13
        C 32 19, 27 22, 24 25
        C 22 27, 21 29, 21 31
        L 23 31
        C 23 29, 24 28, 26 26
        C 29 23, 35 20, 35 13
        C 35 5, 29 0, 22 0
        C 15 0, 9 5, 9 14
        Z"
        fill="url(#g1-q)"/>

      {/* ? stem */}
      <rect x="20" y="31" width="4" height="7" rx="2" fill="url(#g1-q)"/>

      {/* Ice texture lines on the ? */}
      <path d="M 13 10 C 15 9, 18 11, 20 9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M 28 8 C 30 7, 32 9, 31 11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" strokeLinecap="round"/>
      <path d="M 25 20 C 27 19, 29 21, 28 23" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" strokeLinecap="round"/>

      {/* ── Brain in circular ring at the dot position ── */}
      {/* Outer ring */}
      <circle cx="22" cy="46" r="7.5"
        fill="none" stroke="url(#g1-q)" strokeWidth="1.8"
        style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.7))" }}/>
      {/* Brain fill inside ring */}
      <circle cx="22" cy="46" r="5.5" fill="rgba(2,71,107,0.8)"/>
      {/* Brain blob — compact version inside circle */}
      <path d="M22 42.5 C21 42,18.5 42,17 43.5 C15.5 45,16 47,17 48 C16 49,16.5 50.5,18 50.5 C19 50.5,20 50,21 49.5 L21 43 Z"
        fill="url(#g1-brain)" opacity="0.9"/>
      <path d="M22 42.5 C23 42,25.5 42,27 43.5 C28.5 45,28 47,27 48 C28 49,27.5 50.5,26 50.5 C25 50.5,24 50,23 49.5 L23 43 Z"
        fill="url(#g1-brain)" opacity="0.9"/>
      {/* Brain center groove */}
      <line x1="22" y1="42.5" x2="22" y2="46" stroke="rgba(2,132,199,0.8)" strokeWidth="1" strokeLinecap="round"/>
      {/* Brain folds */}
      <path d="M17.5 45.5 C18.5 44.5,19.5 45.5,20.5 44.5" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M23.5 44.5 C24.5 45.5,25.5 44.5,26.5 45.5" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M17 47.5 C18.5 46.5,20 47.5,21 46.5" fill="none" stroke="rgba(2,132,199,0.65)" strokeWidth="0.7" strokeLinecap="round"/>
      <path d="M23 46.5 C24 47.5,25.5 46.5,27 47.5" fill="none" stroke="rgba(2,132,199,0.65)" strokeWidth="0.7" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">? + Brain (Faithful)</p>

      {/* Large preview */}
      <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon size={100}/>
      </div>

      {/* Actual header-button size preview */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Actual size in header</p>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 18px rgba(103,232,249,0.28)"
             }}>
          <Icon size={28}/>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide mt-1">Play</span>
      </div>

      <p className="text-white/30 text-[11px] text-center px-6">Frozen ? with brain at the base — like the Grok concept</p>
    </div>
  );
}
