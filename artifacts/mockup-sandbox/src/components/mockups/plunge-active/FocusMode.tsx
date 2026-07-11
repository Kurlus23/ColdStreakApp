import { SkipBack, SkipForward, Pause } from "lucide-react";
import "./_focus-mode.css";

function SiSpotify({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function FocusMode() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between py-12 font-sans relative overflow-hidden">
      {/* Background breathing glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-cyan-900/30 rounded-full blur-[80px] animate-breathe pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col items-center gap-1 z-10 w-full pt-6">
        <span className="text-xl font-medium tracking-[0.2em] text-slate-400 select-none">
          COLDSTREAK
        </span>
        <div className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">
          Stopwatch
        </div>
      </div>

      {/* Timer Section */}
      <div className="flex flex-col items-center justify-center flex-1 w-full z-10 relative">
        {/* Breathing ring behind timer */}
        <div className="absolute w-[260px] h-[260px] rounded-full border border-cyan-500/20 animate-pulse-ring pointer-events-none" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-cyan-500/10 animate-pulse-ring pointer-events-none" style={{ animationDelay: '1s' }} />
        
        <div
          className="font-mono text-slate-50 font-light tracking-tighter"
          style={{ fontSize: "5.5rem", fontVariantNumeric: "tabular-nums" }}
        >
          1:47
        </div>
      </div>

      {/* Info & Controls */}
      <div className="flex flex-col items-center gap-8 w-full px-6 z-10">
        {/* Stats */}
        <div className="flex items-center justify-between w-full max-w-[320px] px-2">
          <div className="flex flex-col items-center gap-1">
            <div className="text-slate-500 text-[9px] uppercase tracking-widest">Water Temp</div>
            <div className="text-slate-200 text-xl font-light">42°F</div>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700/60 to-transparent" />
          <div className="flex flex-col items-center gap-1">
            <div className="text-slate-500 text-[9px] uppercase tracking-widest">Cold Score</div>
            <div className="text-cyan-400/90 text-xl font-light">7.4</div>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700/60 to-transparent" />
          <div className="flex flex-col items-center gap-1">
            <div className="text-slate-500 text-[9px] uppercase tracking-widest">Personal Best</div>
            <div className="text-amber-400/80 text-xl font-light">12.6</div>
          </div>
        </div>

        {/* Music Pill */}
        <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-full pl-2 pr-1 py-1 w-fit">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800/50">
            <SiSpotify className="w-4 h-4 text-emerald-500/80" />
          </div>
          <span className="text-slate-300 text-[11px] font-medium truncate max-w-[90px]">Ice Bath Mix</span>
          <div className="flex items-center pl-1">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors">
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors">
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors">
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Cold Take */}
        <div className="w-full text-center px-4">
          <div className="text-cyan-500/40 text-[9px] uppercase tracking-[0.2em] mb-2 font-medium">
            ❄ Cold Take
          </div>
          <div className="text-slate-400 text-sm font-light leading-relaxed max-w-[280px] mx-auto italic">
            "Your nemesis: that little voice saying 'just get out.'"
          </div>
        </div>

        {/* Stop Button */}
        <button className="w-[85%] max-w-[320px] h-14 mt-4 rounded-[2rem] bg-slate-800/60 border border-slate-700/50 text-slate-300 font-medium tracking-wider hover:bg-slate-700/80 hover:text-white hover:border-slate-600 active:scale-[0.98] transition-all backdrop-blur-xl shadow-lg shadow-black/20">
          Stop
        </button>
      </div>
    </div>
  );
}
