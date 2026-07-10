import { 
  Sparkles, 
  MapPin, 
  Share2, 
  ChevronRight, 
  Trophy, 
  Flame, 
  X,
  Droplets,
  ThermometerSnowflake,
  Activity
} from "lucide-react";

export function LevelUp() {
  return (
    <div className="min-h-screen bg-[#060c18] flex items-end justify-center font-sans overflow-hidden">
      {/* Background elements to look like a game environment */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#060c18] to-[#060c18]"></div>
      
      {/* The Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-[#0a1122] border-t border-cyan-500/30 rounded-t-[32px] p-6 pb-10 shadow-[0_-10px_40px_rgba(6,182,212,0.15)] flex flex-col gap-6">
        
        {/* Header - Game-like summary */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-cyan-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3" /> Plunge Complete
            </div>
            <h2 className="text-white font-black text-2xl tracking-tight">Level Up Your Mind</h2>
          </div>
          <button className="w-8 h-8 rounded-full bg-blue-950/50 flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row - RPG style */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">2:30</span>
            <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Time</span>
          </div>
          <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
            <ThermometerSnowflake className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">48°F</span>
            <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Temp</span>
          </div>
          <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-sm">2.2</span>
            <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Score</span>
          </div>
        </div>

        {/* Progress Section - The Core "Level Up" Mechanic */}
        <div className="bg-gradient-to-b from-blue-900/30 to-blue-950/20 border border-blue-800/60 rounded-3xl p-5 relative overflow-hidden">
          {/* Subtle glow behind the badge */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3 h-3" /> 1-Day Streak
                </span>
              </div>
              <h3 className="text-white font-bold text-lg">Next: First Frost</h3>
              <p className="text-blue-300 text-xs font-medium">Keep the momentum. 6 days to go.</p>
            </div>
            <div className="w-12 h-12 bg-blue-900/80 border border-blue-700 rounded-xl flex items-center justify-center text-2xl shadow-inner">
              🧊
            </div>
          </div>

          {/* Large Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              <span>Day 1</span>
              <span>Day 7</span>
            </div>
            <div className="h-3 bg-blue-950 rounded-full overflow-hidden border border-blue-900/50 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 rounded-full relative"
                style={{ width: "14%" }}
              >
                {/* Glow tip */}
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-sm rounded-full"></div>
              </div>
            </div>
            <p className="text-right text-[10px] text-cyan-500 font-bold mt-1 animate-pulse">+1 Day Earned!</p>
          </div>
        </div>

        {/* Cold Take Bonus Drop */}
        <div className="relative bg-gradient-to-r from-[#0d172e] to-[#121c38] border border-cyan-900/50 rounded-2xl p-4 flex gap-4 items-center group cursor-pointer hover:border-cyan-700/50 transition-colors">
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
          
          <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-800 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-cyan-400" />
          </div>
          
          <div className="flex-1">
            <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Bonus Drop Unlocked</div>
            <p className="text-white text-sm font-medium leading-snug italic">"Your nemesis: that little voice saying 'just get out.'"</p>
          </div>
        </div>

        {/* Minimized Location */}
        <button className="flex items-center justify-between bg-blue-950/30 border border-blue-900/50 rounded-xl px-4 py-3 hover:bg-blue-900/40 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-blue-200 text-sm font-medium">Location: Home</span>
          </div>
          <ChevronRight className="w-4 h-4 text-blue-500" />
        </button>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button className="w-full py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all active:scale-[0.98]">
            Claim XP & Save
          </button>
          
          <div className="flex gap-3">
            <button className="flex-1 py-3 rounded-2xl font-bold text-sm bg-blue-900/40 text-blue-300 border border-blue-800/50 hover:bg-blue-800/40 hover:text-white transition-colors flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" /> Share Stats
            </button>
            <button className="flex-1 py-3 rounded-2xl font-bold text-sm text-red-400/80 hover:bg-red-950/30 hover:text-red-400 transition-colors">
              Discard
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
