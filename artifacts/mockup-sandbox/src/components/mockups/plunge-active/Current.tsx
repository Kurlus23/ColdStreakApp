import { SkipBack, SkipForward, Pause } from "lucide-react";

function SiSpotify({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function Current() {
  return (
    <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center gap-8 font-sans relative overflow-hidden">
      <div className="absolute top-8 flex items-center justify-center">
        <span
          className="text-2xl font-black pointer-events-none select-none"
          style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #67e8f9 60%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.7))",
            letterSpacing: "0.12em",
          }}
        >
          COLDSTREAK
        </span>
      </div>

      <div className="text-blue-400 text-xs font-semibold uppercase tracking-widest -mb-4">
        Stopwatch
      </div>

      <div
        className="font-mono font-bold text-white leading-none"
        style={{ fontSize: "28vw" }}
      >
        1:47
      </div>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">Water Temp</div>
          <div className="text-white text-2xl font-bold">42°F</div>
        </div>
        <div className="w-px h-8 bg-blue-700/50" />
        <div className="text-center">
          <div className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">Cold Score</div>
          <div className="text-cyan-300 text-2xl font-bold">7.4</div>
        </div>
        <div className="w-px h-8 bg-blue-700/50" />
        <div className="text-center">
          <div className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">Personal Best</div>
          <div className="text-yellow-400 text-2xl font-bold">12.6</div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-blue-900/60 backdrop-blur-md border border-blue-700/40 rounded-full px-3 py-2 shadow-lg shadow-black/30">
        <div className="shrink-0 flex items-center justify-center w-6 h-6">
          <SiSpotify className="w-4 h-4 text-green-400" />
        </div>
        <span className="text-blue-200 text-xs font-medium truncate max-w-[110px]">Ice Bath Mix</span>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-800/60 active:scale-95 transition-all">
          <SkipBack className="w-4 h-4 fill-current" />
        </button>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-800/60 active:scale-95 transition-all">
          <Pause className="w-4 h-4 fill-current" />
        </button>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-800/60 active:scale-95 transition-all">
          <SkipForward className="w-4 h-4 fill-current" />
        </button>
      </div>

      <div className="max-w-md mx-4 px-5 py-3 rounded-2xl bg-blue-950/70 backdrop-blur-sm border border-cyan-400/20 shadow-lg shadow-black/30 text-center">
        <div className="text-cyan-300/80 text-[10px] uppercase tracking-[0.25em] mb-1.5 font-semibold">
          ❄ Cold Take
        </div>
        <div className="text-white text-base italic font-light leading-snug">
          "Your nemesis: that little voice saying 'just get out.'"
        </div>
      </div>

      <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-20 py-4 rounded-2xl text-xl transition-all active:scale-95 shadow-lg shadow-blue-600/30">
        Stop
      </button>
    </div>
  );
}
