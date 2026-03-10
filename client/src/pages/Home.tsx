import { useState, useEffect, useRef, useCallback } from "react";
import icebergBg from "@assets/image_1773152998246.png";
import {
  Play, Pause, RotateCcw, Thermometer, Snowflake, History,
  Activity, AlarmClock, Flame, Target, Zap,
  Bluetooth, Watch, Heart, Settings, Bell, Upload, Volume2
} from "lucide-react";

import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { usePlunges, useCreatePlunge } from "@/hooks/use-plunges";
import { PlungeCard } from "@/components/PlungeCard";

import { type Plunge } from "@shared/schema";

const ALARM_PRESETS = [
  { id: "alarm_clock",   label: "Alarm Clock",    url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" },
  { id: "digital_watch", label: "Digital Watch",  url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" },
  { id: "bugle",         label: "Bugle Charge",   url: "https://actions.google.com/sounds/v1/alarms/bugle_charge.ogg" },
  { id: "bell",          label: "Bell",           url: "https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg" },
];

type Screen = "timer" | "history" | "settings";


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
  const [screen, setScreen] = useState<Screen>(
    () => (localStorage.getItem("defaultScreen") as Screen) || "timer"
  );

  // Stopwatch
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [temperature, setTemperature] = useState<number>(50);
  const [useCelsius, setUseCelsius] = useState(false);

  // Countdown
  const [countdownMode, setCountdownMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [minutesInput, setMinutesInput] = useState(3);
  const [secondsInput, setSecondsInput] = useState(0);
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState<number>(
    () => Number(localStorage.getItem("weeklyGoalMinutes") ?? 11)
  );

  // Alarm sound
  const [alarmUrl, setAlarmUrl] = useState<string>(
    () => localStorage.getItem("alarmUrl") ?? ALARM_PRESETS[0].url
  );
  const [alarmLabel, setAlarmLabel] = useState<string>(
    () => localStorage.getItem("alarmLabel") ?? ALARM_PRESETS[0].label
  );
  const [alarmIsCustom, setAlarmIsCustom] = useState<boolean>(
    () => localStorage.getItem("alarmIsCustom") === "true"
  );
  const alarmUploadRef = useRef<HTMLInputElement | null>(null);

  const selectPresetAlarm = (url: string, label: string) => {
    setAlarmUrl(url);
    setAlarmLabel(label);
    setAlarmIsCustom(false);
    localStorage.setItem("alarmUrl", url);
    localStorage.setItem("alarmLabel", label);
    localStorage.setItem("alarmIsCustom", "false");
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAlarmUrl(dataUrl);
      setAlarmLabel(file.name.replace(/\.[^.]+$/, ""));
      setAlarmIsCustom(true);
      localStorage.setItem("alarmUrl", dataUrl);
      localStorage.setItem("alarmLabel", file.name.replace(/\.[^.]+$/, ""));
      localStorage.setItem("alarmIsCustom", "true");
      toast({ title: "Alarm uploaded", description: `"${file.name.replace(/\.[^.]+$/, "")}" is now your alarm sound.` });
    };
    reader.readAsDataURL(file);
  };

  const previewAlarm = () => {
    const audio = new Audio(alarmUrl);
    audio.volume = 1;
    audio.play().catch(() => toast({ title: "Preview failed", description: "Tap the screen first to allow audio playback.", variant: "destructive" }));
    setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 3000);
  };

  // Biometrics
  const [hr, setHR] = useState<number>(0);
  const [spo2, setSpo2] = useState<number>(0);
  const [watchStatus, setWatchStatus] = useState<string>("Not connected");
  const [thermometerConnected, setThermometerConnected] = useState(false);

  const { toast } = useToast();
  const { data: plunges = [], isLoading } = usePlunges();
  const createPlunge = useCreatePlunge();

  const navTo = (s: Screen) => {
    setScreen(s);
    localStorage.setItem("defaultScreen", s);
  };

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    createPlunge.mutate(
      { duration: durationSec, temperature, score: String(score), hrAvg: hr > 0 ? hr : null, spo2Avg: spo2 > 0 ? spo2 : null },
      {
        onSuccess: () => {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#0ea5e9", "#ffffff", "#38bdf8", "#bae6fd"] });
          toast({ title: "Plunge Logged! ❄️", description: `Score: ${score} — ${formatTime(durationSec)} at ${temperature}°F` });
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, hr, spo2, createPlunge, toast]);

  // Stopwatch
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownRunning && countdown > 0) interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    if (countdownRunning && countdown === 0) {
      setCountdownRunning(false);
      const targetDuration = minutesInput * 60 + secondsInput;
      doLogPlunge(targetDuration);
      alarmRef.current = new Audio(alarmUrl);
      alarmRef.current.play().catch(() => {});
      toast({ title: "Time's up! ❄️", description: "Plunge complete — automatically logged!" });
    }
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRunning, countdown]);

  const handleStart = () => {
    if (countdownMode) {
      const total = minutesInput * 60 + secondsInput;
      if (total <= 0) { toast({ title: "Set a duration first", variant: "destructive" }); return; }
      setCountdown(total);
      setCountdownRunning(true);
    } else {
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    if (countdownMode) {
      if (countdownRunning) { setCountdownRunning(false); return; }
      if (countdown > 0) { resetCountdown(); return; }
    } else {
      if (isRunning && seconds > 0) { setIsRunning(false); doLogPlunge(seconds); setSeconds(0); }
      else { setIsRunning(false); }
    }
  };

  const handleReset = () => {
    if (countdownMode) { resetCountdown(); }
    else { setSeconds(0); setIsRunning(false); }
  };

  const resetCountdown = () => {
    setCountdownRunning(false);
    setCountdown(0);
    if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
  };

  const bluetoothCheck = (): boolean => {
    if (window.self !== window.top) {
      toast({ title: "Open in a new tab", description: "Bluetooth is blocked inside the preview pane. Tap the ↗ icon to open the app in its own tab, then try again.", variant: "destructive" });
      return false;
    }
    if (!("bluetooth" in navigator)) {
      toast({ title: "iPhone / iPad not supported", description: "Apple does not allow Web Bluetooth on iOS or iPadOS — in any browser. Bluetooth device pairing requires an Android phone or a desktop computer running Chrome or Edge.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const connectThermometer = async () => {
    if (!bluetoothCheck()) return;
    try {
      const device = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ["health_thermometer"] }] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("health_thermometer");
      const characteristic = await service.getCharacteristic("temperature_measurement");
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
        setTemperature(Math.round((value.getUint8(1) * 9) / 5 + 32));
        toast({ title: "Thermometer updated" });
      });
      setThermometerConnected(true);
      toast({ title: "Thermometer connected!", description: device.name || "Device paired" });
    } catch (err: any) {
      if (err?.name !== "NotFoundError") toast({ title: "Bluetooth error", description: "Could not connect.", variant: "destructive" });
    }
  };

  const connectSmartwatch = async () => {
    if (!bluetoothCheck()) return;
    try {
      setWatchStatus("Connecting…");
      const device = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      const server = await device.gatt.connect();
      try {
        const hrService = await server.getPrimaryService("heart_rate");
        const hrChar = await hrService.getCharacteristic("heart_rate_measurement");
        await hrChar.startNotifications();
        hrChar.addEventListener("characteristicvaluechanged", (event: Event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
          const flags = value.getUint8(0);
          setHR(flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1));
        });
      } catch {}
      setWatchStatus(`Connected: ${device.name || "Watch"}`);
      toast({ title: "Smartwatch connected!", description: `Live HR from ${device.name || "your watch"}` });
    } catch (err: any) {
      setWatchStatus("Not connected");
      if (err?.name !== "NotFoundError") toast({ title: "Watch error", description: "Could not connect.", variant: "destructive" });
    }
  };

  // Stats
  const todayString = new Date().toLocaleDateString();
  const todayPlunges = plunges.filter((p) => new Date(p.createdAt).toLocaleDateString() === todayString);
  const todayTotalSec = todayPlunges.reduce((sum, p) => sum + p.duration, 0);
  const todayScore = todayPlunges.reduce((sum, p) => sum + Number(p.score), 0);
  const last7Days = plunges.filter((p) => (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7);
  const weeklyMinutes = last7Days.reduce((sum, p) => sum + p.duration, 0) / 60;
  const weeklyPct = Math.min(100, (weeklyMinutes / weeklyGoalMinutes) * 100);
  const streak = getStreak(plunges);
  const watchConnected = watchStatus !== "Not connected" && watchStatus !== "Connecting…";

  const displaySeconds = countdownMode ? countdown : seconds;
  const isActive = countdownMode ? countdownRunning : isRunning;
  const displayScore = isActive && displaySeconds > 0 ? plungeScore(displaySeconds, temperature) : todayScore;

  const tempDisplay = useCelsius
    ? `${Math.round((temperature - 32) * 5 / 9)}°C`
    : `${temperature}°F`;

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden bg-blue-950">
      {/* Iceberg photo background */}
      <img
        src={icebergBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center center" }}
      />
      {/* Dark overlay so UI is readable over the bright photo */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 via-blue-900/20 to-blue-950/80" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-center px-5 pt-8 pb-2">
        <h1
          className="text-3xl font-extrabold italic text-white tracking-wide"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
          data-testid="header-title"
        >
          ColdStreak
        </h1>
      </header>

      {/* ─── TIMER SCREEN ─── */}
      {screen === "timer" && (
        <div className="absolute bottom-20 left-0 right-0 px-3 pb-2">

          {/* 3-column cards */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">

            {/* Water Temp */}
            <div
              className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col"
              data-testid="card-water-temp"
            >
              <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest mb-1">Water Temp</div>

              {/* Styled native select — looks like a big number, native picker on tap */}
              <div className="relative flex-1 flex items-center mb-2">
                <select
                  data-testid="select-temperature"
                  value={useCelsius ? Math.round((temperature - 32) * 5 / 9) : temperature}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTemperature(useCelsius ? Math.round(v * 9 / 5 + 32) : v);
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                >
                  {useCelsius
                    ? Array.from({ length: 35 }, (_, i) => 4 + i).map((c) => <option key={c} value={c}>{c}°C</option>)
                    : Array.from({ length: 61 }, (_, i) => 40 + i).map((f) => <option key={f} value={f}>{f}°F</option>)
                  }
                </select>
                <span className="text-white text-3xl font-bold leading-none pointer-events-none">{tempDisplay}</span>
              </div>

              {/* °F / °C toggle pill */}
              <div className="flex bg-blue-800/70 rounded-lg p-0.5 gap-0.5">
                <button
                  data-testid="button-unit-f"
                  onClick={() => setUseCelsius(false)}
                  className={`flex-1 text-[11px] py-1 rounded-md font-bold transition-all ${!useCelsius ? "bg-white text-blue-900" : "text-blue-300 hover:text-white"}`}
                >°F</button>
                <button
                  data-testid="button-unit-c"
                  onClick={() => setUseCelsius(true)}
                  className={`flex-1 text-[11px] py-1 rounded-md font-bold transition-all ${useCelsius ? "bg-white text-blue-900" : "text-blue-300 hover:text-white"}`}
                >●C</button>
              </div>
            </div>

            {/* Timer */}
            <div
              className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center"
              data-testid="card-timer"
            >
              <button
                data-testid="display-timer"
                onClick={() => {
                  if (isActive) { handleStop(); }
                  setCountdownMode(m => !m);
                  setSeconds(0);
                  setIsRunning(false);
                  setCountdown(0);
                  setCountdownRunning(false);
                }}
                className="flex flex-col items-center group focus:outline-none"
                title="Tap to switch mode"
              >
                <div className={`text-4xl font-mono font-bold tracking-tight leading-none mb-0.5 ${isActive ? "text-white" : "text-slate-200"}`}>
                  {formatTime(displaySeconds)}
                </div>
                <div className="flex items-center gap-1 text-blue-300 group-hover:text-cyan-300 transition-colors text-[10px] uppercase tracking-widest mb-3">
                  {countdownMode ? "Countdown" : "Stopwatch"}
                  <svg className="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </button>
              <div className="flex gap-1.5 w-full mt-auto">
                <button
                  data-testid="button-start"
                  onClick={handleStart}
                  disabled={isActive}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white rounded-xl py-2 text-sm font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/30"
                >Start</button>
                <button
                  data-testid="button-stop"
                  onClick={handleStop}
                  className="flex-1 bg-slate-600/80 hover:bg-slate-500/80 text-white rounded-xl py-2 text-sm font-bold border border-slate-500/50 transition-all active:scale-95"
                >Stop</button>
              </div>
              {displaySeconds > 0 && !isActive && (
                <button
                  data-testid="button-reset"
                  onClick={handleReset}
                  className="mt-1.5 text-[10px] text-blue-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Smartwatch */}
            <div
              className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center gap-2"
              data-testid="card-smartwatch"
            >
              <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest text-center leading-tight">
                Connect<br />Smartwatch
              </div>
              <Watch className={`w-9 h-9 ${watchConnected ? "text-green-400" : "text-blue-200"}`} />
              <button
                data-testid="button-smartwatch"
                onClick={connectSmartwatch}
                className={`w-full py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  watchConnected
                    ? "bg-green-500/30 text-green-300 border border-green-500/40"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {watchConnected ? "Connected" : "Connect"}
              </button>
            </div>
          </div>

          {/* Weekly goal / score row */}
          <div
            className="text-center text-white/90 text-sm font-semibold tracking-wide"
            data-testid="display-weekly"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
          >
            Weekly: {weeklyMinutes.toFixed(1)} / {weeklyGoalMinutes} min&nbsp;&nbsp;·&nbsp;&nbsp;
            {seconds > 0 || countdown > 0
              ? `Score: ${plungeScore(displaySeconds, temperature)}`
              : `Streak: ${streak} days`
            }
          </div>
        </div>
      )}

      {/* ─── HISTORY SCREEN ─── */}
      {screen === "history" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="bg-blue-950/90 backdrop-blur-sm rounded-3xl p-4 border border-blue-800/50 min-h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" /> Plunge History
              </h2>
              <button
                data-testid="button-close-history"
                onClick={() => navTo("timer")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
              >✕</button>
            </div>

            {/* Today summary */}
            {todayPlunges.length > 0 && (
              <div className="flex justify-between items-center bg-blue-900/60 rounded-2xl px-4 py-3 mb-4 border border-blue-700/40">
                <div>
                  <div className="text-[10px] text-blue-400 uppercase tracking-wider">Today</div>
                  <div className="text-white font-semibold">{(todayTotalSec / 60).toFixed(1)} min</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-blue-400 uppercase tracking-wider">Score</div>
                  <div className="text-cyan-400 font-bold text-lg">{todayScore.toFixed(2)}</div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-blue-900/40 rounded-2xl animate-pulse" />)}</div>
            ) : !plunges.length ? (
              <div className="text-center py-16">
                <Snowflake className="w-12 h-12 text-blue-700 mx-auto mb-3" />
                <p className="text-blue-400">No plunges yet. Brave the cold!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...plunges]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((plunge) => <PlungeCard key={plunge.id} plunge={plunge} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SETTINGS SCREEN ─── */}
      {screen === "settings" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="bg-blue-950/90 backdrop-blur-sm rounded-3xl p-5 border border-blue-800/50 space-y-6 min-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" /> Settings
              </h2>
              <button
                data-testid="button-close-settings"
                onClick={() => navTo("timer")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
              >✕</button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
                <div className="text-blue-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" /> Streak</div>
                <div className="text-white font-bold text-xl">{streak} <span className="text-sm font-normal text-blue-400">days</span></div>
              </div>
              <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
                <div className="text-blue-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-cyan-400" /> Today</div>
                <div className="text-white font-bold text-xl">{todayScore.toFixed(1)} <span className="text-sm font-normal text-blue-400">pts</span></div>
              </div>
              <div className="col-span-2 bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-2">
                <div className="flex justify-between items-center text-xs text-blue-400 uppercase tracking-wide">
                  <div className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Weekly Goal</div>
                  <span>{weeklyMinutes.toFixed(1)} / {weeklyGoalMinutes} min</span>
                </div>
                <div className="h-2 bg-blue-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-blue-400 text-xs">Goal</span>
                  <select
                    data-testid="select-weekly-goal"
                    value={weeklyGoalMinutes}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setWeeklyGoalMinutes(val);
                      localStorage.setItem("weeklyGoalMinutes", String(val));
                    }}
                    className="bg-blue-800/80 border border-blue-600 rounded-lg px-2 py-1 text-white text-xs font-semibold appearance-none focus:outline-none focus:border-cyan-400"
                  >
                    {Array.from({ length: 110 }, (_, i) => i + 11).map((m) => (
                      <option key={m} value={m}>{m} min / week</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Countdown timer mode */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-semibold flex items-center gap-2"><AlarmClock className="w-4 h-4 text-cyan-400" /> Timer Mode</div>
                <div className="flex bg-blue-800/80 rounded-lg p-0.5">
                  <button
                    onClick={() => setCountdownMode(false)}
                    data-testid="button-mode-stopwatch"
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${!countdownMode ? "bg-cyan-500 text-white" : "text-blue-400 hover:text-white"}`}
                  >Stopwatch</button>
                  <button
                    onClick={() => setCountdownMode(true)}
                    data-testid="button-mode-countdown"
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${countdownMode ? "bg-cyan-500 text-white" : "text-blue-400 hover:text-white"}`}
                  >Countdown</button>
                </div>
              </div>
              {countdownMode && (
                <div className="flex items-center gap-2">
                  <select data-testid="select-countdown-minutes" value={minutesInput} onChange={(e) => setMinutesInput(Number(e.target.value))}
                    className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white font-semibold appearance-none text-center focus:outline-none focus:border-cyan-400">
                    {Array.from({ length: 61 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
                  </select>
                  <span className="text-blue-400 font-bold">:</span>
                  <select data-testid="select-countdown-seconds" value={secondsInput} onChange={(e) => setSecondsInput(Number(e.target.value))}
                    className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white font-semibold appearance-none text-center focus:outline-none focus:border-cyan-400">
                    {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{i} sec</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Alarm Sound */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-cyan-400" /> Alarm Sound
                </div>
                <button
                  data-testid="button-preview-alarm"
                  onClick={previewAlarm}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white text-xs font-semibold transition-all active:scale-95"
                >
                  <Volume2 className="w-3 h-3" /> Preview
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ALARM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    data-testid={`button-alarm-${preset.id}`}
                    onClick={() => selectPresetAlarm(preset.url, preset.label)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                      !alarmIsCustom && alarmLabel === preset.label
                        ? "bg-cyan-500/30 border-cyan-400 text-cyan-200"
                        : "bg-blue-800/60 border-blue-600/50 text-blue-300 hover:text-white hover:border-blue-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <input
                ref={alarmUploadRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioUpload}
                data-testid="input-alarm-upload"
              />
              <button
                data-testid="button-upload-alarm"
                onClick={() => alarmUploadRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                  alarmIsCustom
                    ? "bg-cyan-500/30 border-cyan-400 text-cyan-200"
                    : "bg-blue-800/60 border-blue-600/50 text-blue-300 hover:text-white hover:border-blue-400"
                }`}
              >
                <Upload className="w-4 h-4" />
                {alarmIsCustom ? `Custom: ${alarmLabel}` : "Upload from Device"}
              </button>
            </div>

            {/* Devices */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="text-white font-semibold flex items-center gap-2"><Bluetooth className="w-4 h-4 text-cyan-400" /> Devices</div>

              <div className="bg-amber-900/40 border border-amber-600/50 rounded-xl px-3 py-2.5 text-amber-200 text-xs leading-relaxed space-y-1">
                <div><span className="font-bold text-amber-300">iPhone / iPad:</span> Apple blocks Web Bluetooth in all iOS browsers — this feature cannot work on iPhone or iPad regardless of which browser you use.</div>
                <div><span className="font-bold text-amber-300">Supported:</span> Chrome or Edge on <span className="font-semibold">Android</span> or a <span className="font-semibold">desktop/laptop</span> computer only.</div>
              </div>

              <button data-testid="button-bluetooth" onClick={connectThermometer}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold transition-all active:scale-95 ${
                  thermometerConnected
                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                    : "bg-blue-800/80 border-blue-600 text-blue-200 hover:text-white hover:border-cyan-400"
                }`}>
                <Thermometer className="w-4 h-4" /> {thermometerConnected ? "Thermometer Connected" : "Connect Thermometer"}
              </button>
              <button data-testid="button-smartwatch-settings" onClick={connectSmartwatch}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold transition-all active:scale-95 ${
                  watchConnected
                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                    : "bg-blue-800/80 border-blue-600 text-blue-200 hover:text-white hover:border-cyan-400"
                }`}>
                <Watch className="w-4 h-4" /> {watchConnected ? "Smartwatch Connected" : "Connect Smartwatch (BT)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/90 backdrop-blur-md border-t border-blue-800/60">
        <div className="flex items-center h-full max-w-xl mx-auto px-8">
          {/* History */}
          <button
            data-testid="nav-history"
            onClick={() => navTo("history")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "history" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <History className="w-5 h-5" />
            <span className="text-[11px] font-semibold">History</span>
          </button>

          {/* Cold Score — center */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              data-testid="nav-cold-score"
              onClick={() => toast({
                title: "What is Cold Score?",
                description: "Cold Score reflects the relative impact of your plunge based on duration × temperature factor. Colder water earns up to 2.3× multiplier. Higher scores mean more cold exposure and greater activation of cold shock proteins and brown fat.",
              })}
              className="flex items-center gap-1.5 bg-blue-800/60 hover:bg-blue-700/70 border border-blue-600/60 rounded-2xl px-3 py-1.5 transition-all active:scale-95"
            >
              <Snowflake className="w-4 h-4 text-cyan-300" />
              <div>
                <div className="text-[9px] text-blue-400 uppercase tracking-wider leading-none">Cold Score</div>
                <div className="text-white font-bold text-base leading-tight">
                  {displayScore > 0 ? displayScore.toFixed(0) : "—"}
                </div>
              </div>
            </button>
          </div>

          {/* Settings */}
          <button
            data-testid="nav-settings"
            onClick={() => navTo("settings")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "settings" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px] font-semibold">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
