import { Sparkles, MapPin, Share2 } from "lucide-react";

export function Current() {
  return (
    <div className="min-h-screen bg-[#0f1f3d] flex items-end justify-center font-sans">
      <div className="relative w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Plunge Complete
          </h3>
          <button className="text-blue-400 hover:text-white text-sm font-semibold transition-colors">Skip</button>
        </div>

        <div className="flex items-center gap-2 bg-blue-900/60 border border-blue-700/40 rounded-xl px-3 py-2">
          <span className="text-blue-400 text-xs flex-1">1-day streak!</span>
          <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-full px-2 py-0.5 font-bold">🥇 1</span>
          <span className="text-[10px] bg-slate-500/20 border border-slate-400/40 text-slate-300 rounded-full px-2 py-0.5 font-bold">#1</span>
        </div>

        <div className="bg-gradient-to-br from-cyan-950/80 to-blue-900/60 border border-cyan-400/30 rounded-2xl px-4 py-3">
          <div className="text-cyan-300/80 text-[10px] uppercase tracking-[0.25em] mb-1 font-semibold">
            ❄ Cold Take Unlocked
          </div>
          <p className="text-white text-sm font-medium leading-snug">
            Your nemesis: that little voice saying 'just get out.'
          </p>
        </div>

        <div className="bg-blue-900/50 border border-blue-700/40 rounded-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-300 font-semibold">Next badge: 🧊 First Frost</span>
            <span className="text-cyan-300 font-bold">6 days to go</span>
          </div>
          <div className="h-2.5 bg-blue-950 rounded-full overflow-hidden border border-blue-800/60">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-700"
              style={{ width: "14%" }}
            />
          </div>
          <div className="text-blue-500 text-[10px]">1 of 7 plunge days</div>
        </div>

        <div className="space-y-2">
          <label className="text-blue-300 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Tag a Location (optional)
          </label>
          <select className="w-full bg-blue-900/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-cyan-400" defaultValue="home">
            <option value="">— No location —</option>
            <option value="home">🏠 Home</option>
          </select>
          <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
            <div className="text-xs text-blue-300 leading-relaxed">
              <span className="font-semibold text-cyan-300">🏠 Home</span>
              {" — "}Private. Shows as "Home" when shared with friends.
            </div>
          </div>
        </div>

        <button className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30">
          Save
        </button>
        <button className="w-full py-2.5 rounded-2xl font-semibold text-sm border border-blue-600/60 text-blue-200 hover:text-white hover:border-cyan-400/60 transition-colors flex items-center justify-center gap-2">
          <Share2 className="w-4 h-4" /> Share with friends
        </button>
        <button className="w-full text-center text-xs font-semibold text-red-400/80 hover:text-red-300 transition-colors">
          Discard plunge
        </button>
      </div>
    </div>
  );
}
