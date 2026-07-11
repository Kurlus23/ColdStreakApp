import { SkipBack, SkipForward, Pause } from "lucide-react";
import "./_deep-glow.css";

function SiSpotify({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function DeepGlow() {
  return (
    <div className="w-[390px] h-[844px] min-h-screen bg-[#020617] flex flex-col items-center justify-between font-sans relative overflow-hidden mx-auto shadow-2xl">
      {/* Underwater Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.2),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.15),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }} />

      {/* Top Section */}
      <div className="w-full flex flex-col items-center pt-16 pb-4 z-10">
        <span
          className="text-xl font-black pointer-events-none select-none tracking-[0.2em] mb-4"
          style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #a5f3fc 60%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 12px rgba(8,145,178,0.6))",
          }}
        >
          COLDSTREAK
        </span>
        <div className="glass-panel px-4 py-1.5 rounded-full border border-cyan-500/30 text-cyan-300 text-[10px] font-bold uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          Stopwatch
        </div>
      </div>

      {/* Center Section - Timer */}
      <div className="flex-1 flex flex-col items-center justify-center w-full z-10 -mt-8">
        <div
          className="font-mono font-bold text-white leading-none tracking-tighter animate-pulse-glow"
          style={{ fontSize: "7.5rem" }}
        >
          1:47
        </div>
      </div>

      {/* Bottom Section */}
      <div className="w-full flex flex-col items-center gap-5 pb-10 z-10 px-6">
        {/* Stats Row */}
        <div className="flex items-center justify-between w-full px-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
              </span>
              <div className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">Live Temp</div>
            </div>
            <div className="text-white text-3xl font-bold tracking-tight">42°F</div>
          </div>
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <div className="text-cyan-400 text-[10px] uppercase tracking-widest mb-1 font-semibold">Cold Score</div>
            <div className="text-cyan-300 text-3xl font-bold tracking-tight animate-pulse-glow">7.4</div>
          </div>
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <div className="text-amber-400 text-[10px] uppercase tracking-widest mb-1 font-semibold">Personal Best</div>
            <div className="text-amber-400 text-3xl font-bold tracking-tight" style={{ textShadow: "0 0 15px rgba(251,191,36,0.3)" }}>12.6</div>
          </div>
        </div>

        {/* Cold Take */}
        <div className="glass-panel w-full px-6 py-5 rounded-3xl border border-cyan-500/20 text-center relative overflow-hidden animate-pulse-box-glow">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="text-cyan-400 text-[10px] uppercase tracking-[0.2em] mb-2 font-bold flex items-center justify-center gap-2">
              <span className="text-cyan-300">❄</span> Cold Take
            </div>
            <div className="text-slate-200 text-[15px] italic font-light leading-relaxed">
              "Your nemesis: that little voice saying 'just get out.'"
            </div>
          </div>
        </div>

        {/* Music Pill */}
        <div className="flex items-center gap-3 glass-panel rounded-full p-2 pr-4 w-full border border-white/10 shadow-lg">
          <div className="shrink-0 flex items-center justify-center w-10 h-10 bg-[#1db954]/20 rounded-full border border-[#1db954]/30">
            <SiSpotify className="w-5 h-5 text-[#1db954]" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-white text-sm font-medium truncate">Ice Bath Mix</span>
            <span className="text-slate-400 text-[10px] uppercase tracking-wider">Spotify</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-all">
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-black bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <Pause className="w-4 h-4 fill-current" />
            </button>
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-all">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Stop Button */}
        <button className="w-full relative group mt-2">
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative bg-gradient-to-b from-red-500 to-red-700 border border-red-400/50 text-white font-bold py-5 rounded-2xl text-xl tracking-wider transition-all active:scale-[0.98] shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]">
            STOP
          </div>
        </button>
      </div>
    </div>
  );
}