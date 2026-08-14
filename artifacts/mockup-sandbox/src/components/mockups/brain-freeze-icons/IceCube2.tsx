// Ice Cube 2 — Rounded cube, brain prominent, ? subtle background glow
export function IceCube2() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <defs>
        <linearGradient id="ic2-body" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.12"/>
        </linearGradient>
        <linearGradient id="ic2-border" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.95"/>
          <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="ic2-brain" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#e0f2fe"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>
      </defs>

      {/* Cube front face — very rounded */}
      <rect x="3" y="3" width="42" height="42" rx="8"
        fill="url(#ic2-body)"/>
      <rect x="3" y="3" width="42" height="42" rx="8"
        fill="none" stroke="url(#ic2-border)" strokeWidth="2.5"
        style={{ filter: "drop-shadow(0 0 8px rgba(186,230,253,0.55))" }}/>

      {/* Corner ice highlights */}
      <path d="M 8 3 L 3 3 L 3 8" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M 40 3 L 45 3 L 45 8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M 3 40 L 3 45 L 8 45" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>

      {/* Frost shimmer lines inside cube */}
      <line x1="10" y1="12" x2="22" y2="9" stroke="rgba(186,230,253,0.2)" strokeWidth="1" strokeLinecap="round"/>
      <line x1="28" y1="38" x2="40" y2="36" stroke="rgba(186,230,253,0.15)" strokeWidth="0.8" strokeLinecap="round"/>

      {/* ? mark as large background glow */}
      <text x="24" y="36" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="30"
        fill="rgba(56,189,248,0.2)"
        style={{ filter: "drop-shadow(0 0 10px rgba(56,189,248,0.6))" }}>?</text>

      {/* Brain — large and prominent, centre of cube */}
      <path d="M24 13 C23 12,20 12,18 13.5 C16 15.5,16.5 18.5,18 20 C16 21,16.5 24,19 24 C20.5 24,22.5 23.5,24 23 C25.5 23.5,27.5 24,29 24 C31.5 24,32 21,30 20 C31.5 18.5,32 15.5,30 13.5 C28 12,25 12,24 13 Z"
        fill="url(#ic2-brain)"
        style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.7))" }}/>
      {/* Center groove */}
      <line x1="24" y1="13" x2="24" y2="17.5" stroke="rgba(2,132,199,0.9)" strokeWidth="1.3" strokeLinecap="round"/>
      {/* Bold folds — darker than fill for contrast */}
      <path d="M18.5 16 C20 15,21.5 16,22.5 15"  fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M25.5 15 C26.5 16,28 15,29.5 16"  fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M18 19 C19.5 18,21 19,22.5 18"    fill="none" stroke="rgba(2,132,199,0.8)"  strokeWidth="1.0" strokeLinecap="round"/>
      <path d="M25.5 18 C27 19,28.5 18,30 19"    fill="none" stroke="rgba(2,132,199,0.8)"  strokeWidth="1.0" strokeLinecap="round"/>
      <path d="M18.5 22 C20 21,22 22,23 21"      fill="none" stroke="rgba(2,132,199,0.72)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M25 21 C26 22,28 21,29.5 22"      fill="none" stroke="rgba(2,132,199,0.72)" strokeWidth="0.9" strokeLinecap="round"/>

      {/* ? dot as glowing orb below brain */}
      <circle cx="24" cy="35" r="3" fill="url(#ic2-brain)"
        style={{ filter: "drop-shadow(0 0 5px rgba(56,189,248,0.9))" }}/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Ice Cube (Brain Forward)</p>
      <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon size={110}/>
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Actual size in header</p>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{ background:"linear-gradient(145deg,rgba(14,116,144,0.52),rgba(30,58,138,0.65))", border:"1px solid rgba(103,232,249,0.5)", boxShadow:"0 0 18px rgba(103,232,249,0.28)" }}>
          <Icon size={30}/>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide mt-1">Play</span>
      </div>
      <p className="text-white/30 text-[11px] text-center px-6">Brain prominent + ? as background glow, glassy cube frame</p>
    </div>
  );
}
