import { useState, useEffect, useRef, useCallback } from "react";
import icebergBg from "@assets/image_1773152998246.png";
import {
  Play, Pause, RotateCcw, Thermometer, Snowflake, History,
  Activity, AlarmClock, Flame, Target, Zap,
  Bluetooth, Watch, Heart, Settings, Bell, Upload, Volume2,
  Camera, MapPin, Lock, ShieldAlert, Trophy, Medal, User, ChevronDown,
  Sparkles, Crown, CheckCircle2, RotateCcw as RestoreIcon, Compass
} from "lucide-react";

import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { usePlunges, useCreatePlunge, useUpdatePlunge } from "@/hooks/use-plunges";
import { useLeaderboard, useSubmitLeaderboard } from "@/hooks/use-leaderboard";
import { useProStatus } from "@/hooks/use-pro-status";
import { PlungeCard } from "@/components/PlungeCard";
import { Explore } from "@/pages/Explore";
import { PASSPORT_LOCATIONS, usePassportBadges } from "@/lib/passport";

import { type Plunge } from "@shared/schema";

async function resizeImageToBase64(file: File, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ALARM_PRESETS = [
  { id: "alarm_clock",   label: "Alarm Clock",    url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" },
  { id: "digital_watch", label: "Digital Watch",  url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" },
  { id: "bugle",         label: "Bugle Charge",   url: "https://actions.google.com/sounds/v1/alarms/bugle_charge.ogg" },
  { id: "bell",          label: "Bell",           url: "https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg" },
];

type Screen = "timer" | "history" | "explore" | "settings";


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
  const [temperature, setTemperature] = useState<number>(
    () => Number(localStorage.getItem("coldstreak-temperature") ?? 50)
  );
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

  useEffect(() => {
    localStorage.setItem("coldstreak-temperature", String(temperature));
  }, [temperature]);

  // Handle Stripe payment return — verify session_id in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    verifySession(sessionId).then((success) => {
      if (success) {
        toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "All Pro features are now unlocked." });
      } else {
        toast({ title: "Payment not confirmed", description: "If you completed payment, try Restore Purchase.", variant: "destructive" });
      }
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, []);

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

  // Photo / location prompt
  const [photoPromptId, setPhotoPromptId] = useState<number | null>(null);
  const [promptPhotoData, setPromptPhotoData] = useState<string | null>(null);
  const [promptLocationId, setPromptLocationId] = useState<string>("");
  const [promptCustomLocation, setPromptCustomLocation] = useState<string>("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptSubmitLeaderboard, setPromptSubmitLeaderboard] = useState(true);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Pro status
  const { isPro, proEmail, loading: proLoading, startCheckout, verifySession, restorePurchase } = useProStatus();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restoreEmailInput, setRestoreEmailInput] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Leaderboard
  const [leaderboardLocationId, setLeaderboardLocationId] = useState<string | null>(null);
  // Username (for leaderboard)
  const [username, setUsername] = useState<string>(
    () => localStorage.getItem("coldstreak-username") ?? ""
  );

  // Plunge data stored for leaderboard submission after save
  const promptPlungeRef = useRef<{ score: string; duration: number; temperature: number } | null>(null);

  const { toast } = useToast();
  const { data: plunges = [], isLoading } = usePlunges();
  const createPlunge = useCreatePlunge();
  const updatePlunge = useUpdatePlunge();
  const submitLeaderboard = useSubmitLeaderboard();
  const { badges, awardBadge, hasBadge } = usePassportBadges();
  const leaderboard = useLeaderboard(leaderboardLocationId);

  const navTo = (s: Screen) => {
    setScreen(s);
    localStorage.setItem("defaultScreen", s);
  };

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    createPlunge.mutate(
      { duration: durationSec, temperature, score: String(score), hrAvg: hr > 0 ? hr : null, spo2Avg: spo2 > 0 ? spo2 : null },
      {
        onSuccess: (newPlunge) => {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#0ea5e9", "#ffffff", "#38bdf8", "#bae6fd"] });
          toast({ title: "Plunge Logged! ❄️", description: `Score: ${score} — ${formatTime(durationSec)} at ${temperature}°F` });
          promptPlungeRef.current = { score: String(score), duration: durationSec, temperature };
          setPhotoPromptId(newPlunge.id);
          setPromptPhotoData(null);
          setPromptLocationId("");
          setPromptCustomLocation("");
          setPromptSubmitLeaderboard(true);
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
      // Show all nearby BLE devices — many watches only advertise heart_rate
      // when in workout mode, so we let the user pick any device and then
      // try to read the standard heart rate service from it.
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["heart_rate", "battery_service"],
      });
      const server = await device.gatt.connect();
      let hrFound = false;
      try {
        const hrService = await server.getPrimaryService("heart_rate");
        const hrChar = await hrService.getCharacteristic("heart_rate_measurement");
        await hrChar.startNotifications();
        hrChar.addEventListener("characteristicvaluechanged", (event: Event) => {
          const value = (event.target as BluetoothRemoteGATTCharacteristic).value!;
          const flags = value.getUint8(0);
          setHR(flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1));
        });
        hrFound = true;
      } catch {}
      setWatchStatus(`Connected: ${device.name || "Watch"}`);
      if (hrFound) {
        toast({ title: "Smartwatch connected!", description: `Live HR from ${device.name || "your watch"}` });
      } else {
        toast({
          title: `${device.name || "Device"} connected`,
          description: "Connected but no heart rate data found. Your watch may need to be in workout mode, or it may use a proprietary app.",
          variant: "destructive",
        });
      }
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
            ) : (() => {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              const sorted = [...plunges].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const visible = isPro ? sorted : sorted.filter((p) => new Date(p.createdAt) >= sevenDaysAgo);
              const locked = isPro ? [] : sorted.filter((p) => new Date(p.createdAt) < sevenDaysAgo);
              return (
                <div className="space-y-3">
                  {visible.map((plunge) => <PlungeCard key={plunge.id} plunge={plunge} />)}
                  {locked.length > 0 && (
                    <button
                      data-testid="banner-upgrade-history"
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full bg-gradient-to-r from-cyan-900/60 to-blue-900/60 border border-cyan-700/50 rounded-2xl p-4 text-center space-y-1 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center justify-center gap-2 text-cyan-300 font-bold">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        {locked.length} older plunge{locked.length !== 1 ? "s" : ""} hidden
                      </div>
                      <div className="text-blue-400 text-xs">Upgrade to Pro for unlimited history →</div>
                    </button>
                  )}
                  {visible.length === 0 && locked.length === 0 && (
                    <div className="text-center text-blue-500 py-8 text-sm">No plunges yet. Start your first session!</div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── EXPLORE SCREEN ─── */}
      {screen === "explore" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto">
          <Explore username={username} onClose={() => navTo("timer")} />
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

            {/* ColdStreak Pro */}
            {isPro ? (
              <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-2xl p-4 border border-cyan-600/50 space-y-1">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Crown className="w-4 h-4 text-yellow-400" /> ColdStreak Pro
                  <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
                </div>
                <div className="text-cyan-300 text-xs">Active · {proEmail}</div>
                <div className="text-blue-400 text-xs pt-1">Unlimited history · Plunge Passport · Advanced stats</div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-2xl p-4 border border-cyan-700/50 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Crown className="w-4 h-4 text-yellow-400" /> ColdStreak Pro
                  <span className="ml-auto text-yellow-400 text-sm font-bold">$7.99</span>
                </div>
                <ul className="space-y-1 text-blue-300 text-xs">
                  {["Unlimited plunge history", "Plunge Passport + leaderboards", "Advanced stats & personal bests", "CSV / Apple Health export", "No ads"].map((f) => (
                    <li key={f} className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />{f}</li>
                  ))}
                </ul>
                <button
                  data-testid="button-upgrade-settings"
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all active:scale-[0.98]"
                >
                  Upgrade to Pro — One-Time $7.99
                </button>
                <button
                  data-testid="button-restore-purchase"
                  onClick={async () => {
                    const email = prompt("Enter the email you used to purchase ColdStreak Pro:");
                    if (!email) return;
                    setRestoreLoading(true);
                    const ok = await restorePurchase(email);
                    setRestoreLoading(false);
                    if (ok) {
                      toast({ title: "✅ Pro restored!", description: "Welcome back to ColdStreak Pro." });
                    } else {
                      toast({ title: "Not found", description: "No Pro purchase found for that email.", variant: "destructive" });
                    }
                  }}
                  className="w-full py-2 rounded-xl border border-blue-600/50 text-blue-400 text-xs font-semibold transition-all active:scale-[0.98] hover:border-blue-400 flex items-center justify-center gap-1.5"
                >
                  <RestoreIcon className="w-3 h-3" /> Restore Purchase
                </button>
              </div>
            )}

            {/* Username */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <div className="text-white font-semibold flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-cyan-400" /> Leaderboard Name
              </div>
              <div className="flex items-center gap-2">
                <input
                  data-testid="input-settings-username"
                  type="text"
                  placeholder="Enter your display name…"
                  value={username}
                  maxLength={24}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    localStorage.setItem("coldstreak-username", e.target.value);
                  }}
                  className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <p className="text-blue-500 text-xs mt-2">This name appears on location leaderboards when you submit a plunge.</p>
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

            {/* Safety & Disclaimer */}
            <div
              data-testid="card-disclaimer"
              className="bg-red-950/40 rounded-2xl p-4 border border-red-800/50 space-y-3"
            >
              <div className="text-white font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" /> Safety &amp; Disclaimer
              </div>
              <p className="text-red-200 text-xs leading-relaxed">
                <span className="font-bold text-red-300">ASSUMPTION OF RISK:</span> Cold water immersion carries serious health risks including cold water shock, cardiac arrest, hypothermia, loss of consciousness, and drowning. By using ColdStreak, you acknowledge that you voluntarily assume all risks associated with cold plunge activities.
              </p>
              <p className="text-red-200 text-xs leading-relaxed">
                ColdStreak is a tracking tool only. It does not provide medical advice. Consult a physician before beginning cold exposure therapy, especially if you have heart conditions, high blood pressure, Raynaud's disease, or are pregnant.
              </p>
              <p className="text-red-200 text-xs leading-relaxed">
                <span className="font-bold text-red-300">Featured Locations:</span> USA locations listed in the Plunge Passport are spring-fed or managed facilities selected for relative safety and year-round access. Sliding Rock (NC) is listed as seasonal — lifeguards are only present May–Labor Day. Conditions at all locations can change without notice due to weather, drought, flooding, or closures. Always check current local conditions before visiting. Never plunge alone.
              </p>
              <p className="text-red-200/70 text-[10px] leading-relaxed">
                ColdStreak and its developers accept no liability for injury, illness, or death resulting from cold plunge activities. Use this app at your own risk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEADERBOARD MODAL ─── */}
      {leaderboardLocationId && (() => {
        const loc = PASSPORT_LOCATIONS.find((l) => l.id === leaderboardLocationId)!;
        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setLeaderboardLocationId(null)} />
            <div
              data-testid="sheet-leaderboard"
              className="relative z-10 w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{loc.flag}</span>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">{loc.name}</h3>
                    <p className="text-blue-400 text-xs">{loc.tempRange}</p>
                  </div>
                </div>
                <button
                  data-testid="button-close-leaderboard"
                  onClick={() => setLeaderboardLocationId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                >✕</button>
              </div>

              {/* Title */}
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-semibold text-sm">Top Plungers</span>
                {hasBadge(loc.id) && (
                  <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full font-semibold">You've been here!</span>
                )}
              </div>

              {/* Leaderboard entries */}
              <div className="overflow-y-auto flex-1">
                {leaderboard.isLoading ? (
                  <div className="space-y-2">
                    {[1,2,3].map((i) => <div key={i} className="h-12 bg-blue-900/40 rounded-xl animate-pulse" />)}
                  </div>
                ) : !leaderboard.data?.length ? (
                  <div className="text-center py-10">
                    <Trophy className="w-10 h-10 text-blue-700 mx-auto mb-2" />
                    <p className="text-blue-400 text-sm">No entries yet.</p>
                    <p className="text-blue-600 text-xs mt-1">Be the first to plunge here and submit your score!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.data.map((entry, i) => {
                      const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
                      const rankIcons = ["🥇", "🥈", "🥉"];
                      const isTop3 = i < 3;
                      return (
                        <div
                          key={entry.id}
                          data-testid={`leaderboard-entry-${i}`}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                            i === 0
                              ? "bg-yellow-500/10 border-yellow-500/30"
                              : "bg-blue-900/40 border-blue-700/30"
                          }`}
                        >
                          <div className={`text-lg font-bold w-7 text-center shrink-0 ${isTop3 ? rankColors[i] : "text-blue-500"}`}>
                            {isTop3 ? rankIcons[i] : `${i + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-semibold text-sm truncate">{entry.username}</div>
                            <div className="text-blue-400 text-xs">
                              {Math.floor(entry.duration / 60)}:{String(entry.duration % 60).padStart(2, "0")} · {entry.temperature}°F
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`font-bold text-base ${i === 0 ? "text-yellow-400" : "text-cyan-300"}`}>
                              {Number(entry.score).toFixed(1)}
                            </div>
                            <div className="text-blue-500 text-[10px]">pts</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-blue-600 text-[10px] text-center mt-3 shrink-0">
                Tag this location after a plunge to submit your score
              </p>
            </div>
          </div>
        );
      })()}

      {/* ─── PHOTO / LOCATION PROMPT ─── */}
      {photoPromptId !== null && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPhotoPromptId(null)}
          />
          <div
            data-testid="sheet-photo-prompt"
            className="relative z-10 w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" /> Add Photo &amp; Location
              </h3>
              <button
                data-testid="button-skip-photo"
                onClick={() => setPhotoPromptId(null)}
                className="text-blue-400 hover:text-white text-sm font-semibold transition-colors"
              >Skip</button>
            </div>

            {/* Photo picker */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="input-photo-upload"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await resizeImageToBase64(file);
                  setPromptPhotoData(data);
                } catch {
                  toast({ title: "Could not load photo", variant: "destructive" });
                }
              }}
            />
            <button
              data-testid="button-pick-photo"
              onClick={() => photoInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
                promptPhotoData
                  ? "border-cyan-500/60 p-0"
                  : "border-blue-600/50 hover:border-cyan-500/50 py-8 flex flex-col items-center gap-2"
              }`}
            >
              {promptPhotoData ? (
                <img
                  src={promptPhotoData}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-blue-500" />
                  <span className="text-blue-400 text-sm font-semibold">Tap to add a photo</span>
                  <span className="text-blue-600 text-xs">From camera roll or take a photo</span>
                </>
              )}
            </button>
            {promptPhotoData && (
              <button
                onClick={() => setPromptPhotoData(null)}
                className="text-xs text-blue-500 hover:text-red-400 transition-colors -mt-2"
              >Remove photo</button>
            )}

            {/* Location picker */}
            <div className="space-y-2">
              <label className="text-blue-300 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Tag a Location (optional)
              </label>
              <select
                data-testid="select-location"
                value={promptLocationId}
                onChange={(e) => {
                  setPromptLocationId(e.target.value);
                  setPromptCustomLocation("");
                }}
                className="w-full bg-blue-900/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-cyan-400"
              >
                <option value="">— No location —</option>
                <optgroup label="International">
                  {PASSPORT_LOCATIONS.filter((l) => l.country !== "USA").map((l) => (
                    <option key={l.id} value={l.id}>{l.flag} {l.name}, {l.country}</option>
                  ))}
                </optgroup>
                <optgroup label="USA">
                  {PASSPORT_LOCATIONS.filter((l) => l.country === "USA").map((l) => (
                    <option key={l.id} value={l.id}>{l.flag} {l.name}</option>
                  ))}
                </optgroup>
                <option value="custom">📍 Somewhere else…</option>
              </select>

              {promptLocationId === "custom" && (
                <input
                  data-testid="input-custom-location"
                  type="text"
                  placeholder="Type location name…"
                  value={promptCustomLocation}
                  onChange={(e) => setPromptCustomLocation(e.target.value)}
                  className="w-full bg-blue-900/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                />
              )}

              {promptLocationId && promptLocationId !== "custom" && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
                  {(() => {
                    const loc = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId)!;
                    return (
                      <div className="text-xs text-blue-300 leading-relaxed">
                        <span className="font-semibold text-cyan-300">{loc.flag} {loc.name}</span>
                        {" — "}{loc.safetyNote}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Leaderboard submission toggle — only for passport locations */}
            {promptLocationId && promptLocationId !== "custom" && (
              <div className="bg-blue-900/50 rounded-2xl p-3 border border-blue-700/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    Submit to Leaderboard
                  </div>
                  <button
                    data-testid="button-toggle-leaderboard"
                    onClick={() => setPromptSubmitLeaderboard((v) => !v)}
                    className={`w-11 h-6 rounded-full border-2 transition-all relative ${
                      promptSubmitLeaderboard
                        ? "bg-cyan-500 border-cyan-400"
                        : "bg-blue-800 border-blue-600"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${promptSubmitLeaderboard ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                {promptSubmitLeaderboard && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <input
                      data-testid="input-username"
                      type="text"
                      placeholder="Your name on the leaderboard…"
                      value={username}
                      maxLength={24}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        localStorage.setItem("coldstreak-username", e.target.value);
                      }}
                      className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Save */}
            <button
              data-testid="button-save-photo"
              disabled={promptSaving || (!promptPhotoData && !promptLocationId)}
              onClick={async () => {
                if (!photoPromptId) return;
                const finalLocationId = promptLocationId !== "custom" ? promptLocationId : undefined;
                const finalLocationName = promptLocationId === "custom"
                  ? promptCustomLocation.trim()
                  : promptLocationId
                    ? PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId)?.name
                    : undefined;

                if (!promptPhotoData && !finalLocationName) {
                  setPhotoPromptId(null);
                  return;
                }

                setPromptSaving(true);
                updatePlunge.mutate(
                  {
                    id: photoPromptId,
                    patch: {
                      photoData: promptPhotoData ?? undefined,
                      locationName: finalLocationName ?? undefined,
                      locationId: finalLocationId ?? undefined,
                    },
                  },
                  {
                    onSuccess: () => {
                      const isNewBadge = finalLocationId && !hasBadge(finalLocationId);
                      if (finalLocationId) awardBadge(finalLocationId);
                      if (isNewBadge) {
                        const loc = PASSPORT_LOCATIONS.find((l) => l.id === finalLocationId)!;
                        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ["#fbbf24", "#f59e0b", "#ffffff", "#0ea5e9"] });
                        toast({ title: "🏅 Passport Badge Unlocked!", description: `${loc.flag} ${loc.name} — added to your Plunge Passport!` });
                      } else {
                        toast({ title: "Plunge updated!" });
                      }

                      // Submit to leaderboard if opted in
                      if (finalLocationId && promptSubmitLeaderboard && username.trim() && promptPlungeRef.current) {
                        const { score, duration, temperature: temp } = promptPlungeRef.current;
                        submitLeaderboard.mutate({
                          locationId: finalLocationId,
                          username: username.trim(),
                          score,
                          duration,
                          temperature: temp,
                        });
                      }

                      setPhotoPromptId(null);
                      setPromptSaving(false);
                    },
                    onError: () => {
                      toast({ title: "Failed to save", variant: "destructive" });
                      setPromptSaving(false);
                    },
                  }
                );
              }}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30"
            >
              {promptSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/90 backdrop-blur-md border-t border-blue-800/60">
        <div className="flex items-center h-full max-w-xl mx-auto px-4">
          {/* History */}
          <button
            data-testid="nav-history"
            onClick={() => navTo("history")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "history" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <History className="w-5 h-5" />
            <span className="text-[11px] font-semibold">History</span>
          </button>

          {/* Explore */}
          <button
            data-testid="nav-explore"
            onClick={() => navTo("explore")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "explore" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[11px] font-semibold">Explore</span>
          </button>

          {/* Cold Score — center */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              data-testid="nav-cold-score"
              onClick={() => toast({
                title: "What is Cold Score?",
                description: "Cold Score reflects the relative impact of your plunge based on duration × temperature factor. Colder water earns up to 2.3× multiplier. Higher scores mean more cold exposure and greater activation of cold shock proteins and brown fat.",
              })}
              className="flex items-center gap-1.5 bg-blue-800/60 hover:bg-blue-700/70 border border-blue-600/60 rounded-2xl px-2 py-1.5 transition-all active:scale-95"
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-300" />
              <div>
                <div className="text-[9px] text-blue-400 uppercase tracking-wider leading-none">Score</div>
                <div className="text-white font-bold text-sm leading-tight">
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

      {/* ─── UPGRADE MODAL ─── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gradient-to-b from-blue-950 to-slate-950 rounded-t-3xl border border-blue-700/50 shadow-2xl p-6 pb-10 space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                <span className="text-white font-bold text-xl">ColdStreak Pro</span>
              </div>
              <button
                data-testid="button-close-upgrade"
                onClick={() => setShowUpgradeModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white transition-all text-lg font-bold"
              >✕</button>
            </div>

            <div className="text-center">
              <div className="text-3xl font-black text-white">$7.99</div>
              <div className="text-blue-400 text-sm">One-time payment · No subscription</div>
            </div>

            <ul className="space-y-2.5">
              {[
                { icon: "📅", text: "Unlimited plunge history" },
                { icon: "🗺️", text: "Plunge Passport — earn badges at iconic locations" },
                { icon: "🏆", text: "Per-location leaderboards" },
                { icon: "📈", text: "Advanced stats & personal bests" },
                { icon: "📤", text: "CSV & Apple Health export" },
                { icon: "🚫", text: "No ads, ever" },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white text-sm">
                  <span className="text-lg w-7 shrink-0 text-center">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>

            <button
              data-testid="button-checkout"
              onClick={() => { setShowUpgradeModal(false); startCheckout(); }}
              disabled={proLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-black text-lg shadow-lg shadow-cyan-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {proLoading ? "Loading…" : "Upgrade Now — $7.99"}
            </button>

            <div className="space-y-2">
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-blue-800" />
                <span className="px-3 text-blue-500 text-xs">already purchased?</span>
                <div className="flex-1 border-t border-blue-800" />
              </div>
              <div className="flex gap-2">
                <input
                  data-testid="input-restore-email"
                  type="email"
                  placeholder="Email used at checkout"
                  value={restoreEmailInput}
                  onChange={(e) => setRestoreEmailInput(e.target.value)}
                  className="flex-1 bg-blue-900/60 border border-blue-700 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  data-testid="button-restore-modal"
                  disabled={restoreLoading || !restoreEmailInput.trim()}
                  onClick={async () => {
                    setRestoreLoading(true);
                    const ok = await restorePurchase(restoreEmailInput.trim());
                    setRestoreLoading(false);
                    if (ok) {
                      setShowUpgradeModal(false);
                      toast({ title: "✅ Pro restored!", description: "Welcome back to ColdStreak Pro." });
                    } else {
                      toast({ title: "Not found", description: "No Pro purchase found for that email.", variant: "destructive" });
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-blue-600 text-blue-300 text-sm font-semibold disabled:opacity-40 hover:border-cyan-400 hover:text-cyan-300 transition-all"
                >
                  {restoreLoading ? "…" : "Restore"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
