import { Sparkles, MapPin, Share2, Flame, Clock, Thermometer, ChevronRight, Share, X } from "lucide-react";

export function CelebrationFirst() {
  return (
    <div className="min-h-screen bg-[#020814] flex flex-col justify-end font-sans relative overflow-hidden">
      {/* Background illustration / texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#020814] to-[#020814]"></div>

      {/* Main Sheet */}
      <div className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#0a1428] to-[#060c18] border-t border-cyan-500/30 rounded-t-[2.5rem] pt-8 pb-10 px-6 shadow-[0_-20px_60px_-15px_rgba(6,182,212,0.2)]">
        
        {/* Glow edge indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-cyan-400 rounded-full blur-[2px] opacity-70"></div>
        
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-400/30">
               <Sparkles className="w-4 h-4 text-cyan-300" />
             </div>
             <span className="text-cyan-400 font-bold text-sm tracking-widest uppercase">Plunge Complete</span>
           </div>
           <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:text-white transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
           <div className="flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group shadow-inner">
             <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <Thermometer className="w-5 h-5 text-cyan-400 mb-2" />
             <span className="text-3xl font-black text-white tracking-tight">48°</span>
             <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Temp</span>
           </div>
           <div className="flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group shadow-inner">
             <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <Clock className="w-5 h-5 text-blue-400 mb-2" />
             <span className="text-3xl font-black text-white tracking-tight">2:30</span>
             <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Time</span>
           </div>
           <div className="flex flex-col items-center justify-center py-5 px-2 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group shadow-inner">
             <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <Flame className="w-5 h-5 text-orange-400 mb-2" />
             <span className="text-3xl font-black text-white tracking-tight">2.2</span>
             <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Score</span>
           </div>
        </div>

        {/* Rewards / Badges */}
        <div className="space-y-3 mb-8">
          <div className="flex gap-3">
             <div className="flex-1 bg-gradient-to-r from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">🔥</span>
                  <div className="flex flex-col">
                    <span className="text-orange-400 font-extrabold text-sm tracking-wide">1-Day Streak!</span>
                    <span className="text-orange-500/70 text-[10px] uppercase font-bold tracking-wider mt-0.5">Kept it alive</span>
                  </div>
                </div>
             </div>
          </div>
          
          <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/20 border border-cyan-500/20 rounded-xl p-5 flex flex-col gap-2 relative overflow-hidden">
             <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-500/10 blur-[30px] rounded-full translate-x-10 -translate-y-10"></div>
             <div className="flex items-center justify-between relative z-10 mb-1">
                <span className="text-cyan-300/80 text-[10px] uppercase tracking-[0.2em] font-bold flex items-center gap-2">
                  Cold Take Unlocked
                </span>
             </div>
             <p className="text-white text-base font-medium leading-snug relative z-10 italic">
               "Your nemesis: that little voice saying 'just get out.'"
             </p>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl grayscale opacity-80">🧊</span>
                  <span className="text-white/80 font-bold text-sm">First Frost Badge</span>
                </div>
                <span className="text-white/50 text-xs font-medium">1 / 7 days</span>
             </div>
             <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-white/20 to-white/60 rounded-full" style={{ width: '14%' }}></div>
             </div>
             <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest text-right">6 days to go</p>
          </div>
        </div>

        {/* Location & Actions */}
        <div className="space-y-4">
           <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                   <MapPin className="w-4 h-4 text-white/50 group-hover:text-cyan-400 transition-colors" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-white/90 text-sm font-semibold">Home</span>
                   <span className="text-white/40 text-xs font-medium mt-0.5">Private location</span>
                 </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
           </div>

           <div className="grid grid-cols-4 gap-3 pt-2">
              <button className="col-span-3 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-[#020814] font-black text-lg transition-all active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2">
                Save Plunge
              </button>
              <button className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors active:scale-[0.98]">
                <Share2 className="w-5 h-5" />
              </button>
           </div>
           
           <div className="text-center pt-3">
             <button className="text-white/30 hover:text-red-400/80 text-xs font-bold uppercase tracking-wider transition-colors">
               Discard Plunge
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
