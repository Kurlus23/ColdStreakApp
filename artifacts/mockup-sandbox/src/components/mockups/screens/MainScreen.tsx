// Main (idle) timer screen — corrected number alignment, no weekly line

export function MainScreen() {
  return (
    <div className="w-[390px] h-[844px] relative overflow-hidden font-sans select-none bg-[#0c1a2e]">
      {/* Background — mountain/lake scene approximation */}
      <div className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, rgba(30,58,100,0.9) 0%, #0c1a2e 70%)",
        }}
      />
      <div className="absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, rgba(8,30,60,0.6) 40%, rgba(5,20,45,0.95) 75%, #0c1a2e 100%)",
        }}
      />
      {/* Simulated mountain silhouette */}
      <svg className="absolute bottom-[22%] left-0 right-0 w-full opacity-40" viewBox="0 0 390 200" preserveAspectRatio="none">
        <path d="M0,200 L0,120 L60,60 L120,100 L180,30 L240,80 L300,50 L360,90 L390,70 L390,200 Z" fill="#0d2040" />
        <path d="M0,200 L0,150 L80,110 L160,140 L220,100 L290,130 L390,100 L390,200 Z" fill="#0a1830" />
      </svg>
      {/* Water reflection shimmer */}
      <div className="absolute left-0 right-0 opacity-20"
        style={{ top: "52%", height: "22%", background: "linear-gradient(to bottom, rgba(100,160,220,0.3), transparent)" }}
      />

      {/* Status bar */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-5 pt-3">
        <span className="text-white text-sm font-semibold">10:12</span>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-px items-end">
            {[3,4,4,5].map((h,i) => <div key={i} style={{height: h*3, width: 3}} className="bg-white/70 rounded-sm" />)}
          </div>
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white/70"><path d="M1 7l3.5 3.5C6.5 8.5 9.1 7.5 12 7.5s5.5 1 7.5 3L23 7C20 4 16.2 2.5 12 2.5S4 4 1 7zm5.5 5.5L12 18l5.5-5.5C16 11 14.1 10 12 10s-4 1-5.5 2.5zM12 15l-2-2a2.8 2.8 0 0 1 4 0l-2 2z"/></svg>
          <div className="flex items-center gap-0.5">
            <div className="w-6 h-3 rounded-sm border border-white/50 flex items-center px-0.5"><div className="h-2 flex-1 bg-white/80 rounded-sm" /></div>
          </div>
        </div>
      </div>

      {/* Music widget */}
      <div className="absolute left-3 right-3 top-14">
        <div className="bg-blue-900/80 backdrop-blur-md rounded-2xl border border-blue-700/40 px-3 py-2 flex items-center gap-2 shadow-lg shadow-black/30">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shrink-0 text-white text-xs">♫</div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">Road Rage</p>
            <p className="text-blue-300 text-[10px] truncate">Apple Music</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center text-blue-200">⏮</button>
            <button className="w-7 h-7 flex items-center justify-center bg-cyan-500 rounded-full text-white shadow-lg shadow-cyan-500/40">▶</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-200">⏭</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-200">■</button>
          </div>
        </div>
      </div>

      {/* 3-card grid — bottom section */}
      <div className="absolute bottom-20 left-0 right-0 px-3 pb-2">
        <div className="grid grid-cols-3 gap-2.5">

          {/* Water Temp */}
          <div className="bg-blue-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col">
            {/* Header — always 2-row height */}
            <div className="mb-1">
              <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest">Water Temp</div>
              {/* Live indicator row — always takes space */}
              <div className="flex items-center justify-end gap-1 w-full mt-0.5 invisible">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                <span className="text-green-400 text-[9px] font-semibold">Live</span>
              </div>
            </div>
            {/* Number */}
            <div className="flex-1 flex items-center mb-2">
              <span className="text-white text-3xl font-bold leading-none">44°F</span>
            </div>
            {/* F/C toggle */}
            <div className="flex bg-blue-800/70 rounded-lg p-0.5 gap-0.5">
              <button className="flex-1 text-[11px] py-1 rounded-md font-bold bg-white text-blue-900">°F</button>
              <button className="flex-1 text-[11px] py-1 rounded-md font-bold text-blue-300">●C</button>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-blue-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center">
            {/* Label — min-h matches 2-row headers */}
            <div className="flex items-center justify-center gap-1 text-blue-300 text-[9px] uppercase tracking-widest min-h-[2.5em] leading-tight w-full">
              Stopwatch
              <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            {/* Number */}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-white text-3xl leading-none font-mono font-bold">0:00</span>
            </div>
            {/* Buttons */}
            <div className="flex gap-1 w-full">
              <button className="flex-1 bg-blue-500 text-white rounded-xl py-1.5 text-xs font-bold">Start</button>
              <button className="flex-1 bg-slate-600/80 text-white rounded-xl py-1.5 text-xs font-bold border border-slate-500/50">Stop</button>
            </div>
          </div>

          {/* Cold Score */}
          <div className="bg-blue-900/80 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center">
            {/* 2-line label — matches header height of other cards */}
            <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest text-center leading-tight min-h-[2.5em] flex items-center">
              Cold<br />Score
            </div>
            {/* Number — same text-3xl as others */}
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <span className="text-cyan-300 font-bold text-3xl leading-none">11.4</span>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636 5.636 18.364" />
              </svg>
            </div>
            <div className="text-blue-400 text-[10px]">today</div>
          </div>

        </div>
        {/* No weekly/streak line */}
      </div>

      {/* Nav bar */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/95 border-t border-blue-800/60 flex items-center justify-around px-1">
        {[
          { icon: "🕐", label: "History" },
          { icon: "🧭", label: "Explore" },
          { icon: "🛒", label: "Gear" },
          { icon: "👤", label: "Profile" },
          { icon: "👥", label: "Friends" },
          { icon: "⚙️", label: "Settings" },
        ].map((item, i) => (
          <button key={i} className={`flex flex-col items-center gap-1 py-2 px-2 rounded-xl ${i === 0 ? "text-cyan-300" : "text-blue-500"}`}>
            <span className="text-base">{item.icon}</span>
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
