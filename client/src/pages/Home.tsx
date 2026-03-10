import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Thermometer, Droplets, History, Activity, Snowflake } from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { usePlunges, useCreatePlunge } from "@/hooks/use-plunges";
import { PlungeCard } from "@/components/PlungeCard";

export default function Home() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState<string>("50");
  
  const { toast } = useToast();
  const { data: plunges, isLoading } = usePlunges();
  const createPlunge = useCreatePlunge();

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Handlers
  const toggleTimer = () => setIsRunning(!isRunning);
  
  const resetTimer = () => {
    setIsRunning(false);
    setSeconds(0);
  };

  const handleLogPlunge = () => {
    if (seconds === 0) {
      toast({
        title: "No duration recorded",
        description: "Start the timer before logging your plunge!",
        variant: "destructive",
      });
      return;
    }

    const tempVal = parseInt(temperature, 10);
    if (isNaN(tempVal) || tempVal < -100 || tempVal > 200) {
      toast({
        title: "Invalid Temperature",
        description: "Please enter a valid temperature in °F.",
        variant: "destructive",
      });
      return;
    }

    createPlunge.mutate(
      { duration: seconds, temperature: tempVal },
      {
        onSuccess: () => {
          // Celebrate!
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#0ea5e9', '#ffffff', '#38bdf8', '#bae6fd']
          });
          
          toast({
            title: "Plunge Logged! ❄️",
            description: `You survived ${formatTime(seconds)} at ${tempVal}°F. Incredible!`,
          });
          
          resetTimer();
        },
      }
    );
  };

  // Format Helper
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen pb-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto flex flex-col pt-12 md:pt-20">
      
      {/* Header */}
      <header className="flex items-center justify-center gap-3 mb-10">
        <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
          <Droplets className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
          OpenPlunge
        </h1>
      </header>

      {/* Main Timer Card */}
      <div className="glass-panel p-8 md:p-12 mb-12 relative overflow-hidden group">
        {/* Subtle decorative background glow inside the card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          
          {/* Temperature Input */}
          <div className="mb-8 flex flex-col items-center">
            <label className="text-slate-400 text-sm font-medium mb-3 uppercase tracking-wider flex items-center gap-2">
              <Thermometer className="w-4 h-4" /> Water Temp
            </label>
            <div className="relative w-36 group/input">
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full bg-slate-900/80 border-2 border-slate-700/80 rounded-2xl py-3 pl-6 pr-10 text-white font-display font-semibold text-2xl focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all text-center placeholder:text-slate-600"
                placeholder="50"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-cyan-500 font-bold text-xl pointer-events-none group-focus-within/input:text-cyan-400 transition-colors">
                °F
              </span>
            </div>
          </div>

          {/* The Clock */}
          <div className="mb-10 text-center">
            <h2 className={`text-[6rem] md:text-[8rem] leading-none font-display font-bold timer-nums transition-colors duration-500 ${isRunning ? 'text-white text-glow' : 'text-slate-200'}`}>
              {formatTime(seconds)}
            </h2>
          </div>

          {/* Controls */}
          <div className="flex flex-col w-full max-w-sm gap-4">
            <div className="flex gap-4 w-full">
              <button
                onClick={toggleTimer}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all duration-300 active:scale-95 ${
                  isRunning 
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 hover:bg-slate-700/80 shadow-inner' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5'
                }`}
              >
                {isRunning ? (
                  <><Pause className="w-5 h-5 fill-current" /> Pause</>
                ) : (
                  <><Play className="w-5 h-5 fill-current" /> Start Timer</>
                )}
              </button>
              
              <button
                onClick={resetTimer}
                disabled={seconds === 0}
                className="w-16 h-16 shrink-0 flex items-center justify-center bg-slate-800 text-slate-400 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-slate-400 active:scale-95"
                title="Reset Timer"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </div>

            <button
              onClick={handleLogPlunge}
              disabled={createPlunge.isPending || seconds === 0}
              className="w-full py-4 rounded-2xl bg-slate-800 text-white font-semibold text-lg border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 shadow-lg shadow-black/20"
            >
              {createPlunge.isPending ? (
                <Activity className="w-5 h-5 animate-pulse" />
              ) : (
                <Activity className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              )}
              {createPlunge.isPending ? "Logging..." : "Log Plunge"}
            </button>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
        <div className="flex items-center gap-2 mb-6 px-2">
          <History className="w-5 h-5 text-cyan-500" />
          <h3 className="text-xl font-display font-semibold text-white">Plunge History</h3>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-800/50 rounded-2xl animate-pulse border border-slate-700/30"></div>
            ))}
          </div>
        ) : !plunges?.length ? (
          <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-3xl p-10 text-center">
            <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Snowflake className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-300 font-medium text-lg mb-1">No plunges yet</p>
            <p className="text-slate-500 text-sm">Your history will appear here once you brave the cold.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Display newest first */}
            {[...plunges]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((plunge) => (
                <PlungeCard key={plunge.id} plunge={plunge} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
