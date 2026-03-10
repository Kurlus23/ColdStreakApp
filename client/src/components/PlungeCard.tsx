import { format } from "date-fns";
import { Snowflake, Clock, Thermometer } from "lucide-react";
import { type Plunge } from "@shared/schema";

interface PlungeCardProps {
  plunge: Plunge;
}

export function PlungeCard({ plunge }: PlungeCardProps) {
  // Format seconds into MM:SS
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="group relative overflow-hidden bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-all duration-300 flex items-center justify-between">
      {/* Decorative gradient blob on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="flex items-center gap-4 z-10">
        <div className="bg-slate-900/80 p-3 rounded-xl shadow-inner border border-slate-700/50 text-cyan-400 group-hover:text-cyan-300 transition-colors group-hover:scale-110 duration-300">
          <Snowflake className="w-6 h-6" strokeWidth={2} />
        </div>
        
        <div>
          <div className="flex items-center gap-2 text-white font-display font-semibold text-lg">
            <Clock className="w-4 h-4 text-slate-400" />
            {formatTime(plunge.duration)}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">
            {format(new Date(plunge.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </div>
        </div>
      </div>

      <div className="z-10 text-right">
        <div className="flex items-start justify-end gap-1">
          <span className="text-2xl font-display font-bold text-white drop-shadow-sm">
            {plunge.temperature}
          </span>
          <span className="text-cyan-400 font-bold mt-1">°F</span>
        </div>
      </div>
    </div>
  );
}
