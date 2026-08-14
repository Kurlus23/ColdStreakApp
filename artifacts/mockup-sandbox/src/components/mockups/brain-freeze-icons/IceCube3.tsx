// Ice Cube 3 — ? mark prominent, brain subtle inside, cracked ice texture on cube edges
export function IceCube3() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <defs>
        <linearGradient id="ic3-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.08"/>
        </linearGradient>
        <linearGradient id="ic3-border" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>
        <linearGradient id="ic3-q" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.97"/>
          <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.92"/>
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9"/>
        </linearGradient>
      </defs>

      {/* Cube body */}
      <rect x="3" y="3" width="42" height="42" rx="7" fill="url(#ic3-body)"/>

      {/* Cracked ice border — slightly irregular path instead of clean rect */}
      <path d="M 10 3 L 38 3 Q 45 3 45 10 L 45 38 Q 45 45 38 45 L 10 45 Q 3 45 3 38 L 3 10 Q 3 3 10 3 Z"
        fill="none" stroke="url(#ic3-border)" strokeWidth="2.2"
        style={{ filter: "drop-shadow(0 0 8px rgba(186,230,253,0.65))" }}/>

      {/* Ice crack texture on edges */}
      <path d="M 12 3 L 10 8 L 15 11" fill="none" stroke="rgba(186,230,253,0.45)" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 36 3 L 38 8 L 34 12" fill="none" stroke="rgba(186,230,253,0.4)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 3 32 L 8 30 L 6 36" fill="none" stroke="rgba(186,230,253,0.35)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M 45 18 L 40 20 L 43 26" fill="none" stroke="rgba(186,230,253,0.35)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Frost bubbles */}
      {[[10,14],[38,12],[8,36],[40,38],[22,8],[28,40]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="0.9" fill="rgba(186,230,253,0.4)"/>
      ))}

      {/* Brain — lightly glowing inside */}
      <path d="M24 16 C23.2 15.3,21 15.3,19.5 16.5 C18 18,18.5 20,19.5 21 C18 22,18.5 24,20.5 24 C21.5 24,23 23.5,24 23.2 C25 23.5,26.5 24,27.5 24 C29.5 24,30 22,28.5 21 C29.5 20,30 18,28.5 16.5 C27 15.3,24.8 15.3,24 16 Z"
        fill="rgba(56,189,248,0.35)"
        stroke="rgba(125,211,252,0.6)" strokeWidth="0.7"
        style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>
      <line x1="24" y1="16" x2="24" y2="19.5" stroke="rgba(125,211,252,0.6)" strokeWidth="1.0" strokeLinecap="round"/>
      <path d="M19.5 18.5 C20.5 17.5,22 18.5,23 17.5" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M25 17.5 C26 18.5,27.5 17.5,28.5 18.5" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="0.8" strokeLinecap="round"/>

      {/* ? mark — large, bold, front and center */}
      <path d="M17 22 C17 18,20 15.5,24 15.5 C28 15.5,31 18,31 22 C31 26,27 28,25.5 30 C24.5 31.5,24.5 33,24.5 34 L23.5 34 C23.5 33,23.5 31.5,24.5 30 C26 28,30 26,30 22 C30 18.5,27.3 16.5,24 16.5 C20.7 16.5,18 18.5,18 22 Z"
        fill="url(#ic3-q)"
        style={{ filter: "drop-shadow(0 0 5px rgba(125,211,252,0.7))" }}/>
      {/* ? stem + dot */}
      <rect x="23.5" y="34" width="1" height="3.5" rx="0.5" fill="url(#ic3-q)"/>
      <circle cx="24" cy="40" r="2" fill="url(#ic3-q)"
        style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.8))" }}/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Ice Cube (? Forward)</p>
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
      <p className="text-white/30 text-[11px] text-center px-6">? prominent + brain ghosted inside, cracked ice cube frame</p>
    </div>
  );
}
