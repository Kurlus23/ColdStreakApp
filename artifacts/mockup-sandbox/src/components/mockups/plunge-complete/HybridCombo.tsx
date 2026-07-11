import React from "react";
import { 
  Sparkles, 
  MapPin, 
  Share2, 
  ChevronRight, 
  Flame, 
  X,
  Droplets,
  ThermometerSnowflake,
  Activity
} from "lucide-react";

export function HybridCombo() {
  return (
    <div className="w-[430px] h-[820px] bg-[#060c18] flex flex-col justify-end font-sans relative overflow-hidden mx-auto border border-slate-800">
      {/* Background illustration / texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#060c18] to-[#060c18]"></div>

      {/* Main Sheet — full screen, no internal scroll */}
      <div className="relative w-full bg-[#0a1122] border-t border-cyan-500/30 pt-7 pb-8 px-6 shadow-[0_-10px_40px_rgba(6,182,212,0.15)] flex flex-col h-full">
        
        {/* Glow edge indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-cyan-400 rounded-full blur-[2px] opacity-70"></div>
        
        {/* Header (LevelUp style) */}
        <div className="flex items-center justify-between mb-5 shrink-0">
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

        <div className="flex-1 flex flex-col justify-start min-h-0">
          {/* Stats Row (LevelUp tiles) */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
              <ThermometerSnowflake className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">48°F</span>
              <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Temp</span>
            </div>
            <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">2:30</span>
              <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Time</span>
            </div>
            <div className="flex-1 bg-blue-950/40 border border-blue-800/50 rounded-2xl p-3 flex flex-col items-center justify-center gap-1">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-white font-bold text-sm">2.2</span>
              <span className="text-blue-400 text-[10px] uppercase tracking-wider font-semibold">Score</span>
            </div>
          </div>

          {/* Streak Banner (CelebrationFirst Layout) */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-orange-500/15 to-amber-500/5 border border-orange-500/20 rounded-xl p-3.5 flex items-center justify-between shadow-[0_0_15px_rgba(249,115,22,0.1)]">
               <div className="flex items-center gap-3">
                 <span className="text-xl drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">🔥</span>
                 <div className="flex flex-col">
                   <span className="text-orange-400 font-extrabold text-sm tracking-wide">1-Day Streak!</span>
                   <span className="text-orange-500/70 text-[10px] uppercase font-bold tracking-wider mt-0.5">Keep it alive</span>
                 </div>
               </div>
            </div>
          </div>

          {/* The Star: Cold Take Reveal Card */}
          <div className="relative group cursor-pointer mb-6">
            {/* Card glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
            
            <div className="relative bg-[#0d172e] border border-cyan-900/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center overflow-hidden min-h-[160px]">
              {/* Inner texture */}
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>
              
              <span className="text-cyan-400/80 text-[10px] uppercase tracking-[0.3em] font-bold mb-4 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                Cold Take Unlocked
              </span>
              
              <p className="text-white text-lg font-serif italic font-medium leading-snug px-2 drop-shadow-md">
                "Your nemesis: that little voice saying <span className="text-cyan-200">'just get out.'</span>"
              </p>

              {/* Share prompt floating inside */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/10 backdrop-blur-md rounded-full p-1.5 border border-white/20">
                  <Share2 className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Badge Progress Section (LevelUp Style Colors) */}
          <div className="bg-gradient-to-b from-blue-900/30 to-blue-950/20 border border-blue-800/60 rounded-2xl p-4 relative overflow-hidden mb-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="flex items-start justify-between mb-3 relative z-10">
              <div>
                <h3 className="text-white font-bold text-sm">Next Badge: First Frost</h3>
                <p className="text-blue-300 text-xs font-medium mt-0.5">6 days to go</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl grayscale opacity-80">🧊</span>
                <span className="text-cyan-400 text-[10px] font-bold mt-1">1 / 7 days</span>
              </div>
            </div>

            {/* Large Progress Bar */}
            <div className="h-2 bg-blue-950 rounded-full overflow-hidden border border-blue-900/50 shadow-inner relative z-10">
              <div 
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300 rounded-full relative"
                style={{ width: "14%" }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/40 blur-[2px] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Location & Actions */}
        <div className="space-y-4 shrink-0 pt-2 border-t border-blue-900/30 mt-2">
           <div className="flex items-center justify-between p-3 rounded-xl bg-blue-950/30 border border-blue-900/50 hover:bg-blue-900/40 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-800/50">
                   <MapPin className="w-4 h-4 text-blue-400 group-hover:text-cyan-400 transition-colors" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-white/90 text-sm font-semibold">Home</span>
                   <span className="text-blue-400/60 text-xs font-medium mt-0.5">Private location</span>
                 </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-500/50" />
           </div>

           <div className="grid grid-cols-4 gap-3">
              <button className="col-span-3 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 text-white font-black text-lg transition-all active:scale-[0.98] shadow-[0_0_30px_-10px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2">
                Save Plunge
              </button>
              <button className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-2xl bg-blue-900/40 hover:bg-blue-800/40 border border-blue-800/50 text-blue-300 transition-colors active:scale-[0.98]">
                <Share2 className="w-5 h-5" />
              </button>
           </div>
           
           <div className="text-center pt-1">
             <button className="text-blue-400/40 hover:text-red-400 text-xs font-bold uppercase tracking-wider transition-colors">
               Discard Plunge
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
