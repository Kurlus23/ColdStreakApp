import { History, Compass, ShoppingCart, Trophy, Settings, Bluetooth, BluetoothOff, Snowflake, Heart } from "lucide-react";

export function DevicesScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="relative w-[390px] h-[780px] bg-slate-900 rounded-[44px] overflow-hidden shadow-2xl border border-slate-700/50" style={{ fontFamily: "system-ui, sans-serif" }}>

        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 z-20 bg-blue-950/90">
          <span className="text-white text-xs font-semibold">9:41</span>
          <span className="text-white text-xs font-semibold">ColdStreak</span>
          <span className="text-white text-xs font-semibold">🔋</span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-blue-950 to-slate-950" />

        {/* Devices screen content */}
        <div className="absolute top-12 bottom-24 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="bg-blue-950/90 backdrop-blur rounded-3xl p-4 border border-blue-800/50 min-h-full space-y-4">

            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-cyan-400" /> Bluetooth Devices
            </h2>

            {/* Thermometer — connected */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-white font-semibold text-sm">Water Thermometer</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Connected
                </span>
              </div>
              <p className="text-blue-400/80 text-xs leading-relaxed">
                Connect a BLE thermometer (e.g. ThermoPro TP25) to automatically read your water temperature during a plunge.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                  <span className="text-green-300 text-sm font-medium flex-1">TP25 Probe 1</span>
                  <span className="text-green-400/80 text-xs font-bold">50°F</span>
                </div>
                <button className="w-full py-2 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-2">
                  <BluetoothOff className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>

            {/* HR Monitor — connected */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-white font-semibold text-sm">Heart Rate Monitor</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Connected
                </span>
              </div>
              <p className="text-blue-400/80 text-xs leading-relaxed">
                Connect a Bluetooth heart rate monitor or smartwatch. Supports any device using the standard BLE Heart Rate Profile.
              </p>
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2">
                <p className="text-yellow-400/70 text-[10px] leading-relaxed">
                  ⌚ Smartwatch tip: Start a workout on your watch <em>before</em> connecting to activate live HR broadcasting.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                  <span className="text-green-300 text-sm font-medium flex-1">Amazfit T-Rex 2</span>
                  <span className="text-red-300 text-sm font-bold">72 <span className="text-xs font-normal text-red-300/70">BPM</span></span>
                </div>
                <button className="w-full py-2 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-2">
                  <BluetoothOff className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>

            <p className="text-blue-600/70 text-[10px] text-center px-2 pb-1">
              No BLE device? You can always type your water temperature manually on the timer screen.
            </p>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-blue-950/95 backdrop-blur border-t border-blue-800/60 flex items-center px-2">
          {[
            { icon: <History className="w-5 h-5" />, label: "History" },
            { icon: <Compass className="w-5 h-5" />, label: "Explore" },
            { icon: <ShoppingCart className="w-5 h-5" />, label: "Gear" },
            { icon: <Trophy className="w-5 h-5" />, label: "Badges" },
            { icon: (
              <div className="relative">
                <Bluetooth className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-blue-950" />
              </div>
            ), label: "Devices" },
            { icon: <Settings className="w-5 h-5" />, label: "Settings" },
          ].map((item, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center gap-1 ${i === 4 ? "text-white" : "text-blue-500"}`}>
              {item.icon}
              <span className="text-[9px] font-semibold">{item.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
