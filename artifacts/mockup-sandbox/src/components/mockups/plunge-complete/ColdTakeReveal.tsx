import React, { useState } from "react";
import { Sparkles, MapPin, Share2, ChevronDown, Droplets, Thermometer, Trophy, X, ChevronRight } from "lucide-react";

export function ColdTakeReveal() {
  const [showLocation, setShowLocation] = useState(false);

  return (
    <div className="w-[430px] h-[820px] bg-slate-950 flex flex-col justify-end font-sans overflow-hidden relative border border-slate-800">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="relative w-full bg-slate-900/80 backdrop-blur-2xl border-t border-cyan-500/30 rounded-t-[32px] pt-6 pb-8 px-5 flex flex-col gap-6 shadow-[0_-10px_40px_-10px_rgba(6,182,212,0.15)]">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-white font-bold tracking-tight">Plunge Complete</span>
          </div>
          <button className="text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1">
            Skip <X className="w-3 h-3" />
          </button>
        </div>

        {/* The Star: Cold Take Reveal Card */}
        <div className="relative group cursor-pointer">
          {/* Card glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
          
          <div className="relative bg-slate-950 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center overflow-hidden min-h-[180px]">
            {/* Inner texture */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>
            
            <span className="text-cyan-400/80 text-[10px] uppercase tracking-[0.3em] font-bold mb-4 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
              New Cold Take
            </span>
            
            <p className="text-white text-lg font-serif italic font-medium leading-snug px-2 drop-shadow-md">
              "Your nemesis: that little voice saying <span className="text-cyan-200">`just get out.`</span>"
            </p>

            {/* Share prompt floating inside */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-white/10 backdrop-blur-md rounded-full p-1.5 border border-white/20">
                <Share2 className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Condensed Stats & Progress Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Quick Stats Pill */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center gap-1.5">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-300">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-semibold">2:30</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300">
                  <Thermometer className="w-3 h-3 text-blue-400" />
                  <span className="text-xs font-semibold">48°F</span>
                </div>
             </div>
             <div className="flex items-center justify-between mt-1">
               <span className="text-xs text-slate-400 font-medium">1-day streak</span>
               <div className="flex items-center gap-1">
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 rounded px-1.5 font-bold">🥇 1</span>
               </div>
             </div>
          </div>

          {/* Badge Progress Pill */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3 text-cyan-400" /> First Frost
              </span>
              <span className="text-[10px] text-slate-400">1/7</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: '14%' }}></div>
            </div>
          </div>
        </div>

        {/* Minimized Location */}
        <button 
          onClick={() => setShowLocation(!showLocation)}
          className="flex items-center justify-between px-4 py-2.5 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:bg-slate-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Home</span>
            <span className="text-xs text-slate-500">(Optional)</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showLocation ? 'rotate-90' : ''}`} />
        </button>

        {showLocation && (
          <div className="px-1 text-xs text-slate-400 animate-in slide-in-from-top-2">
            Shows as "Home" to friends. <span className="text-cyan-400 cursor-pointer">Change location</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex gap-3">
            <button className="flex-1 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              Save Plunge
            </button>
            <button className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
          <button className="py-2 text-xs font-medium text-slate-500 hover:text-red-400 transition-colors">
            Discard plunge
          </button>
        </div>

      </div>
    </div>
  );
}
