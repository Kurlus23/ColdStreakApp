import { useState, useEffect, useRef, useCallback } from "react";
import "@/styles/iceberg.css";
import {
  Play, Pause, RotateCcw, Thermometer, Droplets, History,
  Activity, Snowflake, Timer, AlarmClock, Flame, Target, Zap,
  Bluetooth, Watch, Heart
} from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { usePlunges, useCreatePlunge } from "@/hooks/use-plunges";
import { PlungeCard } from "@/components/PlungeCard";
import { type Plunge } from "@shared/schema";

type Screen = "timer" | "countdown" | "history" | "temperature";

const WEEKLY_GOAL_MINUTES = 11;

function plungeScore(durationSeconds: number, tempF: number): number {
  const minutes = durationSeconds / 60;
  let coldFactor = 1;
  if (tempF <= 55) coldFactor = 1.2;
  if (tempF <= 50) coldFactor = 1.5;
  if (tempF <= 45) coldFactor = 1.9;
  if (tempF <= 40) coldFactor = 2.3;
  return Number((minutes * coldFactor).toFixed(2));
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getStreak(plunges: Plunge[]): number {
  if (!plunges.length) return 0;
  const dates = [...new Set(plunges.map((p) => new Date(p.createdAt).toLocaleDateString()))];
  const sorted = dates.map((d) => new Date(d)).sort((a, b) => b.getTime() - a.getTime());
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const d of sorted) {
    const dCopy = new Date(d);
    dCopy.setHours(0, 0, 0, 0);
    const diff = Math.round((current.getTime() - dCopy.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; current = dCopy; } else break;
  }
  return streak;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("timer");

  // Stopwatch
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState<number>(50);
  const [useCelsius, setUseCelsius] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [minutesInput, setMinutesInput] = useState(3);
  const [secondsInput, setSecondsInput] = useState(0);
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  // Smartwatch / biometrics
  const [hr, setHR] = useState<number>(0);
  const [spo2, setSpo2] = useState<number>(0);
  const [watchStatus, setWatchStatus] = useState<string>("Not connected");

  const { toast } = useToast();
  const { data: plunges = [], isLoading } = usePlunges();
  const createPlunge = useCreatePlunge();

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    createPlunge.mutate(
      {
        duration: durationSec,
        temperature: temperature,
        score: String(score),
        hrAvg: hr > 0 ? hr : null,
        spo2Avg: spo2 > 0 ? spo2 : null,
      },
      {
        onSuccess: () => {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#0ea5e9", "#ffffff", "#38bdf8", "#bae6fd"] });
          toast({ title: "Plunge Logged! ❄️", description: `Score: ${score} — ${formatTime(durationSec)} at ${temperature}°F` });
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, hr, spo2, createPlunge, toast]);

  // Stopwatch effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownRunning && countdown > 0) interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    if (countdownRunning && countdown === 0) {
      setCountdownRunning(false);
      const targetDuration = minutesInput * 60 + secondsInput;
      doLogPlunge(targetDuration);
      if (!alarmRef.current) alarmRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
      alarmRef.current.play().catch(() => {});
      toast({ title: "Time's up! ❄️", description: "Plunge complete — automatically logged!" });
    }
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRunning, countdown]);

  const handlePauseAndLog = () => {
    if (isRunning && seconds > 0) {
      setIsRunning(false);
      doLogPlunge(seconds);
      setSeconds(0);
    } else {
      setIsRunning(false);
    }
  };

  const handleLogPlunge = () => {
    if (seconds === 0) { toast({ title: "No duration recorded", description: "Start the timer first.", variant: "destructive" }); return; }
    doLogPlunge(seconds);
    setSeconds(0);
    setIsRunning(false);
  };

  const startCountdown = () => {
    const total = minutesInput * 60 + secondsInput;
    if (total <= 0) { toast({ title: "Set a duration", description: "Choose minutes or seconds first.", variant: "destructive" }); return; }
    setCountdown(total);
    setCountdownRunning(true);
  };

  const resetCountdown = () => {
    setCountdownRunning(false);
    setCountdown(0);
    if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
  };

  // Bluetooth thermometer
  const connectThermometer = async () => {
    if (!("bluetooth" in navigator)) { toast({ title: "Bluetooth not supported", description: "Try Chrome or Edge on desktop.", variant: "destructive" }); return; }
    try {
      const device = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ["health_thermometer"] }] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("health_thermometer");
      const characteristic = await service.getCharacteristic("temperature_measurement");
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
        const tempC = value.getUint8(1);
        setTemperature(Math.round((tempC * 9) / 5 + 32));
        toast({ title: "Temperature updated", description: `Thermometer reading updated` });
      });
      toast({ title: "Thermometer connected!", description: device.name || "Device paired" });
    } catch (err: any) {
      if (err?.name !== "NotFoundError") toast({ title: "Bluetooth error", description: "Could not connect to thermometer.", variant: "destructive" });
    }
  };

  // Smartwatch via Web Bluetooth HRS (Heart Rate Service)
  const connectSmartwatch = async () => {
    if (!("bluetooth" in navigator)) { toast({ title: "Bluetooth not supported", description: "Try Chrome or Edge on desktop.", variant: "destructive" }); return; }
    try {
      setWatchStatus("Connecting…");
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
        optionalServices: ["health_thermometer"],
      });
      const server = await device.gatt.connect();

      // Heart rate
      try {
        const hrService = await server.getPrimaryService("heart_rate");
        const hrChar = await hrService.getCharacteristic("heart_rate_measurement");
        await hrChar.startNotifications();
        hrChar.addEventListener("characteristicvaluechanged", (event: Event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
          const flags = value.getUint8(0);
          const heartRate = flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
          setHR(heartRate);
        });
      } catch {}

      setWatchStatus(`Connected: ${device.name || "Watch"}`);
      toast({ title: "Smartwatch connected!", description: `Live HR data streaming from ${device.name || "your watch"}` });
    } catch (err: any) {
      setWatchStatus("Not connected");
      if (err?.name !== "NotFoundError") toast({ title: "Watch error", description: "Could not connect to smartwatch.", variant: "destructive" });
    }
  };

  // Stats
  const todayString = new Date().toLocaleDateString();
  const todayPlunges = plunges.filter((p) => new Date(p.createdAt).toLocaleDateString() === todayString);
  const todayTotalSec = todayPlunges.reduce((sum, p) => sum + p.duration, 0);
  const todayScore = todayPlunges.reduce((sum, p) => sum + Number(p.score), 0);
  const last7Days = plunges.filter((p) => (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7);
  const weeklyMinutes = last7Days.reduce((sum, p) => sum + p.duration, 0) / 60;
  const weeklyPct = Math.min(100, (weeklyMinutes / WEEKLY_GOAL_MINUTES) * 100);
  const streak = getStreak(plunges);

  const navItems: { id: Screen; label: string; icon: React.ReactNode }[] = [
    { id: "timer", label: "Timer", icon: <Timer className="w-4 h-4" /> },
    { id: "countdown", label: "Countdown", icon: <AlarmClock className="w-4 h-4" /> },
    { id: "temperature", label: "Temp", icon: <Thermometer className="w-4 h-4" /> },
    { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
  ];

  const watchConnected = watchStatus !== "Not connected" && watchStatus !== "Connecting…";

  return (
    <div className="min-h-screen">
      <div className="arctic-bg">
        <div className="arctic-aurora" />
        <div className="arctic-iceberg" />
      </div>
    <div className="relative z-10 min-h-screen pb-24 px-4 sm:px-6 max-w-xl mx-auto flex flex-col pt-10 md:pt-16">

      {/* Header */}
      <header className="flex items-center justify-center gap-3 mb-8">
        <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
          <Droplets className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
          ArcticPlunge
        </h1>
      </header>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-3" data-testid="stat-streak">
          <div className="bg-orange-500/20 p-2 rounded-xl"><Flame className="w-5 h-5 text-orange-400" /></div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Streak</div>
            <div className="text-xl font-bold text-white">{streak} <span className="text-sm font-normal text-slate-400">days</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-3" data-testid="stat-today-score">
          <div className="bg-cyan-500/20 p-2 rounded-xl"><Zap className="w-5 h-5 text-cyan-400" /></div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Today's Score</div>
            <div className="text-xl font-bold text-white">{todayScore.toFixed(2)}</div>
          </div>
        </div>

        <div className="col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4" data-testid="stat-weekly">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wide">Weekly Exposure</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {weeklyMinutes.toFixed(1)} <span className="text-slate-400">/ {WEEKLY_GOAL_MINUTES} min</span>
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-800/60 border border-slate-700/50 rounded-2xl p-1 mb-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => { setScreen(item.id); localStorage.setItem("defaultScreen", item.id); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              screen === item.id
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      {/* Timer Screen */}
      {screen === "timer" && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-cyan-500/3 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">

            {/* Biometrics bar */}
            {watchConnected && (
              <div className="w-full flex items-center justify-center gap-4 mb-5 bg-slate-900/60 border border-slate-700/50 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-white font-bold">{hr > 0 ? `${hr}` : "—"}</span>
                  <span className="text-slate-400 text-xs">bpm</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-400 font-bold text-sm">O₂</span>
                  <span className="text-white font-bold">{spo2 > 0 ? `${spo2}%` : "—"}</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Live</span>
                </div>
              </div>
            )}

            {/* Current temperature badge — tap to go to Temp screen */}
            <button
              data-testid="badge-temperature"
              onClick={() => setScreen("temperature")}
              className="mb-5 flex items-center gap-2 bg-slate-900/70 border border-slate-700/60 rounded-2xl px-5 py-2.5 hover:border-cyan-500/40 transition-all active:scale-95"
              title="Tap to change water temperature"
            >
              <Thermometer className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-semibold text-lg">
                {useCelsius ? `${Math.round((temperature - 32) * 5 / 9)}°C` : `${temperature}°F`}
              </span>
              <span className="text-slate-500 text-xs">water temp</span>
              {watchConnected && (
                <>
                  <span className="text-slate-600 mx-1">·</span>
                  <Watch className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 text-xs">Watch</span>
                </>
              )}
            </button>

            {/* Clock */}
            <div className="mb-8 text-center">
              <div
                data-testid="display-timer"
                className={`text-[5.5rem] md:text-[7rem] leading-none font-mono font-bold transition-colors duration-500 ${isRunning ? "text-white" : "text-slate-200"}`}
              >
                {formatTime(seconds)}
              </div>
              {seconds > 0 && (
                <div className="text-cyan-400 text-sm mt-2 font-medium">
                  Score preview: {plungeScore(seconds, temperature)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col w-full max-w-xs gap-3">
              <div className="flex gap-3 w-full">
                <button
                  data-testid="button-start"
                  onClick={() => setIsRunning(true)}
                  disabled={isRunning}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold active:scale-95 hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-current" /> Start
                </button>
                <button
                  data-testid="button-pause-log"
                  onClick={handlePauseAndLog}
                  disabled={!isRunning}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 text-cyan-400 border border-slate-600 font-bold active:scale-95 hover:bg-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pause className="w-4 h-4 fill-current" /> Pause & Log
                </button>
                <button
                  data-testid="button-reset"
                  onClick={() => { setSeconds(0); setIsRunning(false); }}
                  disabled={seconds === 0 && !isRunning}
                  className="w-14 h-14 shrink-0 flex items-center justify-center bg-slate-800 text-slate-400 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
              {seconds > 0 && !isRunning && (
                <button
                  data-testid="button-log-plunge"
                  onClick={handleLogPlunge}
                  disabled={createPlunge.isPending}
                  className="w-full py-3.5 rounded-2xl bg-slate-800 text-white font-semibold border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95"
                >
                  <Activity className={`w-4 h-4 text-cyan-400 ${createPlunge.isPending ? "animate-pulse" : ""}`} />
                  {createPlunge.isPending ? "Logging..." : "Log Plunge"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Countdown Screen */}
      {screen === "countdown" && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 flex flex-col items-center">
          {!countdownRunning && countdown === 0 && (
            <div className="mb-6 flex items-center gap-3">
              <div className="flex flex-col items-center">
                <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Minutes</label>
                <select
                  data-testid="select-countdown-minutes"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(Number(e.target.value))}
                  className="bg-slate-900/80 border-2 border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-lg focus:outline-none focus:border-cyan-500 transition-colors appearance-none text-center w-24"
                >
                  {Array.from({ length: 61 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
                </select>
              </div>
              <span className="text-slate-400 text-2xl font-bold mt-5">:</span>
              <div className="flex flex-col items-center">
                <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Seconds</label>
                <select
                  data-testid="select-countdown-seconds"
                  value={secondsInput}
                  onChange={(e) => setSecondsInput(Number(e.target.value))}
                  className="bg-slate-900/80 border-2 border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-lg focus:outline-none focus:border-cyan-500 transition-colors appearance-none text-center w-24"
                >
                  {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{i} sec</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="mb-8 text-center">
            <div
              data-testid="display-countdown"
              className={`text-[5.5rem] md:text-[7rem] leading-none font-mono font-bold transition-colors duration-500 ${countdownRunning ? "text-white" : countdown > 0 ? "text-cyan-300" : "text-slate-200"}`}
            >
              {formatTime(countdown)}
            </div>
            {countdownRunning && <div className="text-slate-400 text-sm mt-2">Stay in the cold — plunge auto-logs when done!</div>}
          </div>

          <div className="flex gap-3 w-full max-w-xs">
            {!countdownRunning && countdown === 0 ? (
              <button data-testid="button-countdown-start" onClick={startCountdown} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold active:scale-95 hover:shadow-lg hover:shadow-cyan-500/25 transition-all">
                <Play className="w-4 h-4 fill-current" /> Start Countdown
              </button>
            ) : countdownRunning ? (
              <>
                <button data-testid="button-countdown-pause" onClick={() => setCountdownRunning(false)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 text-cyan-400 border border-slate-600 font-bold active:scale-95 transition-all">
                  <Pause className="w-4 h-4 fill-current" /> Pause
                </button>
                <button data-testid="button-countdown-reset" onClick={resetCountdown} className="w-14 h-14 shrink-0 flex items-center justify-center bg-slate-800 text-slate-400 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-colors active:scale-95">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <button data-testid="button-countdown-resume" onClick={() => setCountdownRunning(true)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold active:scale-95 transition-all">
                  <Play className="w-4 h-4 fill-current" /> Resume
                </button>
                <button data-testid="button-countdown-reset-paused" onClick={resetCountdown} className="w-14 h-14 shrink-0 flex items-center justify-center bg-slate-800 text-slate-400 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-colors active:scale-95">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Temperature Screen */}
      {screen === "temperature" && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="bg-cyan-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
              <Thermometer className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Water Temperature</h2>
            <p className="text-slate-400 text-sm mt-1">Set the temperature before your plunge</p>
          </div>

          {/* Big temp display */}
          <div className="text-6xl font-mono font-bold text-white">
            {useCelsius ? `${Math.round((temperature - 32) * 5 / 9)}°C` : `${temperature}°F`}
          </div>

          {/* Dropdown + unit toggle */}
          <div className="flex items-center gap-3">
            <select
              data-testid="select-temperature"
              value={useCelsius ? Math.round((temperature - 32) * 5 / 9) : temperature}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTemperature(useCelsius ? Math.round(v * 9 / 5 + 32) : v);
              }}
              className="bg-slate-900/80 border-2 border-slate-700/80 rounded-2xl py-2.5 px-4 text-white font-semibold text-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all appearance-none text-center"
            >
              {useCelsius
                ? Array.from({ length: 35 }, (_, i) => 4 + i).map((c) => (
                    <option key={c} value={c}>{c}°C</option>
                  ))
                : Array.from({ length: 61 }, (_, i) => 40 + i).map((f) => (
                    <option key={f} value={f}>{f}°F</option>
                  ))
              }
            </select>
            <button
              data-testid="button-unit-toggle"
              onClick={() => setUseCelsius((u) => !u)}
              title="Switch temperature unit"
              className="px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-500/40 font-semibold transition-all active:scale-95"
            >
              {useCelsius ? "→ °F" : "→ °C"}
            </button>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-slate-700/50" />

          {/* Bluetooth thermometer */}
          <div className="w-full flex flex-col gap-3">
            <p className="text-slate-400 text-xs uppercase tracking-wider text-center">Or connect a device</p>
            <button
              data-testid="button-bluetooth"
              onClick={connectThermometer}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 font-semibold transition-all active:scale-95"
            >
              <Bluetooth className="w-5 h-5" />
              Connect Bluetooth Thermometer
            </button>
            <button
              data-testid="button-smartwatch"
              onClick={connectSmartwatch}
              className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border font-semibold transition-all active:scale-95 ${
                watchConnected
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:text-red-400 hover:border-red-500/40"
              }`}
            >
              <Watch className="w-5 h-5" />
              {watchConnected ? `Watch Connected (${watchStatus.replace("Connected: ", "")})` : "Connect Smartwatch (HR / SpO₂)"}
            </button>
          </div>
        </div>
      )}

      {/* History Screen */}
      {screen === "history" && (
        <div>
          {todayPlunges.length > 0 && (
            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-2xl p-4 mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Today</div>
                <div className="text-white font-semibold">{(todayTotalSec / 60).toFixed(1)} min total</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Score</div>
                <div className="text-cyan-400 font-bold text-lg">{todayScore.toFixed(2)}</div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-800/50 rounded-2xl animate-pulse border border-slate-700/30" />)}</div>
          ) : !plunges.length ? (
            <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-3xl p-10 text-center">
              <div className="bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Snowflake className="w-8 h-8 text-slate-500" /></div>
              <p className="text-slate-300 font-medium text-lg mb-1">No plunges yet</p>
              <p className="text-slate-500 text-sm">Your history will appear here once you brave the cold.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...plunges]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((plunge) => <PlungeCard key={plunge.id} plunge={plunge} />)}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
