// Ice Cube 1 — Glassy cube, brain + ? mark glowing inside (faithful to Grok #2)
export function IceCube1() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 52 52" width={size} height={size}>
      <defs>
        <linearGradient id="ic1-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.08"/>
        </linearGradient>
        <linearGradient id="ic1-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="ic1-glow" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85"/>
        </linearGradient>
      </defs>

      {/* ── Ice cube body — front face ── */}
      {/* Front face fill */}
      <rect x="4" y="8" width="40" height="40" rx="5" fill="url(#ic1-face)"/>
      {/* Front face border — thick glassy edge */}
      <rect x="4" y="8" width="40" height="40" rx="5"
        fill="none" stroke="url(#ic1-edge)" strokeWidth="2.2"
        style={{ filter: "drop-shadow(0 0 6px rgba(186,230,253,0.6))" }}/>
      {/* Top face (isometric hint) */}
      <path d="M 6 8 L 14 2 L 50 2 L 44 8 Z"
        fill="rgba(186,230,253,0.12)" stroke="rgba(186,230,253,0.65)" strokeWidth="1.2"/>
      {/* Right face */}
      <path d="M 44 8 L 50 2 L 50 42 L 44 48 Z"
        fill="rgba(125,211,252,0.08)" stroke="rgba(125,211,252,0.55)" strokeWidth="1.2"/>

      {/* Inner frost particles */}
      {[[12,16],[38,14],[10,36],[40,38],[24,12],[26,44],[8,26],[42,24]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="0.8" fill="rgba(186,230,253,0.5)"/>
      ))}

      {/* ── Brain + ? mark glowing inside the cube ── */}
      {/* ? mark — ghostly glow behind brain */}
      <text x="26" y="35" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="28"
        fill="none" stroke="rgba(125,211,252,0.35)" strokeWidth="2"
        style={{ filter: "drop-shadow(0 0 8px rgba(56,189,248,0.9))" }}>?</text>

      {/* Brain blob overlaid on the ? */}
      <path d="M26 20 C25 19,22 19,20 20.5 C18 22,18.5 25,20 26 C18 27,18.5 29.5,21 29.5 C22.5 29.5,24.5 29,26 28.5 C27.5 29,29.5 29.5,31 29.5 C33.5 29.5,34 27,32 26 C33.5 25,34 22,32 20.5 C30 19,27 19,26 20 Z"
        fill="url(#ic1-glow)"
        style={{ filter: "drop-shadow(0 0 5px rgba(56,189,248,0.7))" }}/>
      {/* Brain center groove */}
      <line x1="26" y1="20" x2="26" y2="24" stroke="rgba(2,132,199,0.9)" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Brain folds */}
      <path d="M20.5 22.5 C21.5 21.5,23 22.5,24 21.5" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M28 21.5 C29 22.5,30.5 21.5,31.5 22.5" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M20 25 C21 24,22.5 25,24 24" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M28 24 C29.5 25,31 24,32 25" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>

      {/* ? dot below brain */}
      <circle cx="26" cy="34" r="2.2" fill="url(#ic1-glow)"
        style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.8))" }}/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Ice Cube (Faithful)</p>
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
      <p className="text-white/30 text-[11px] text-center px-6">Brain + ? glowing inside a glassy ice cube</p>
    </div>
  );
}
