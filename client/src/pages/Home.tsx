import { useState, useEffect, useRef, useCallback } from "react";
import { savePhoto } from "@/lib/photoStore";
import icebergBg from "@assets/image_1773152998246.png";
import {
  Play, Pause, RotateCcw, Snowflake, History,
  Activity, AlarmClock, Flame, Target, Zap,
  Settings, Bell, Upload, Volume2,
  Camera, MapPin, Lock, ShieldAlert, Trophy, User, ChevronDown,
  Sparkles, Crown, CheckCircle2, RotateCcw as RestoreIcon, Compass, Info, Plus, Calendar, Trash2, Share2
} from "lucide-react";

import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { usePlunges, useCreatePlunge, useUpdatePlunge } from "@/hooks/use-plunges";
import { useLeaderboard, useSubmitLeaderboard, useDeleteLeaderboardEntry } from "@/hooks/use-leaderboard";
import { useProStatus } from "@/hooks/use-pro-status";
import { PlungeCard, buildShareText } from "@/components/PlungeCard";
import { Explore } from "@/pages/Explore";
import {
  PASSPORT_LOCATIONS, usePassportBadges, distanceMiles,
  DIFFICULTY_META, TIER_MASTER_META, STATE_EMOJI,
  computeStateBadges, computeTierBadges,
  type Difficulty,
} from "@/lib/passport";
import { useMutation } from "@tanstack/react-query";

import { type Plunge, type UserLocation } from "@shared/schema";

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

function estimateCalories(durationSeconds: number, tempF: number, weightLbs: number): number {
  const durationMin = durationSeconds / 60;
  const tempC = (tempF - 32) * 5 / 9;
  const deltaT = Math.max(0, 37 - tempC);
  const weightKg = weightLbs / 2.205;
  return Math.max(0, durationMin * deltaT * weightKg * 0.0077);
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
    () => Math.min(60, Math.max(25, Number(localStorage.getItem("coldstreak-temperature") ?? 50)))
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
  const [showAchievements, setShowAchievements] = useState(() => {
    return localStorage.getItem("coldstreak-achievements-open") !== "false";
  });
  const [scoreView, setScoreView] = useState<"today" | "week" | "kcal" | "kcal-week">("today");
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const nowTimeStr = new Date().toTimeString().slice(0, 5);
  const [manualDate, setManualDate] = useState(todayDateStr);
  const [manualTime, setManualTime] = useState(nowTimeStr);
  const [manualMins, setManualMins] = useState(3);
  const [manualSecs, setManualSecs] = useState(0);
  const [manualTempF, setManualTempF] = useState(50);
  // Manual entry — location
  const [manualLocSel, setManualLocSel] = useState(""); // "", "community-N", "custom", "new"
  const [manualLocCustom, setManualLocCustom] = useState("");
  const [manualLocGeo, setManualLocGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLocGeoLoading, setManualLocGeoLoading] = useState(false);
  const [manualNewName, setManualNewName] = useState("");
  const [manualNewCountry, setManualNewCountry] = useState("USA");
  const [manualNewState, setManualNewState] = useState("");
  const [manualNewCity, setManualNewCity] = useState("");

  const createCommunitySpot = useMutation({
    mutationFn: async (loc: { name: string; country: string; state?: string; city?: string }) => {
      const res = await fetch("/api/community-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create location");
      return res.json() as Promise<UserLocation>;
    },
    onSuccess: (newLoc) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setManualLocSel(`community-${newLoc.id}`);
      setManualNewName(""); setManualNewCountry("USA"); setManualNewState(""); setManualNewCity("");
      toast({ title: "Spot created!", description: `${newLoc.name} added to community spots.` });
    },
  });
  const [bodyWeightLbs, setBodyWeightLbs] = useState<number>(
    () => Number(localStorage.getItem("coldstreak-body-weight") ?? 154)
  );
  const [restoreEmailInput, setRestoreEmailInput] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [settingsRestoreEmail, setSettingsRestoreEmail] = useState("");
  const [showSettingsRestore, setShowSettingsRestore] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(true);
  const [safetySeen] = useState(() => !!localStorage.getItem("coldstreak-safety-seen"));
  const [safetyOpen, setSafetyOpen] = useState(() => !localStorage.getItem("coldstreak-safety-seen"));
  const [tosOpen, setTosOpen] = useState(false);

  // Leaderboard
  const [leaderboardLocationId, setLeaderboardLocationId] = useState<string | null>(null);
  const [leaderboardLocName, setLeaderboardLocName] = useState<string>("");
  const { data: communityLocs = [] } = useQuery<UserLocation[]>({ queryKey: ["/api/community-locations"] });
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
  const deleteLeaderboard = useDeleteLeaderboardEntry();
  const { badges, awardBadge, hasBadge } = usePassportBadges();
  const leaderboard = useLeaderboard(leaderboardLocationId);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<number | null>(null);

  const navTo = (s: Screen) => {
    setScreen(s);
    localStorage.setItem("defaultScreen", s);
  };

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    createPlunge.mutate(
      { duration: durationSec, temperature, score: String(score), hrAvg: null, spo2Avg: null },
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
  }, [temperature, createPlunge, toast]);

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
    }
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRunning, countdown]);

  // Screen Wake Lock — keep display on while timer is running
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const isActive = countdownMode ? countdownRunning : isRunning;
    const acquire = async () => {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      } catch {}
    };
    const release = () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
    if (isActive) {
      acquire();
    } else {
      release();
    }
    // Re-acquire if tab becomes visible again while timer is still running
    const onVisibility = () => { if (document.visibilityState === "visible" && isActive) acquire(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [isRunning, countdownRunning, countdownMode]);

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
      if (countdownRunning) {
        setCountdownRunning(false);
        const totalDuration = minutesInput * 60 + secondsInput;
        const elapsed = totalDuration - countdown;
        if (elapsed > 0) {
          doLogPlunge(elapsed);
          setCountdown(0);
        } else {
          resetCountdown();
        }
        return;
      }
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

  // Stats
  const todayString = new Date().toLocaleDateString();
  const todayPlunges = plunges.filter((p) => new Date(p.createdAt).toLocaleDateString() === todayString);
  const todayTotalSec = todayPlunges.reduce((sum, p) => sum + p.duration, 0);
  const todayScore = todayPlunges.reduce((sum, p) => sum + Number(p.score), 0);
  const last7Days = plunges.filter((p) => (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7);
  const weeklyMinutes = last7Days.reduce((sum, p) => sum + p.duration, 0) / 60;
  const weeklyScore = last7Days.reduce((sum, p) => sum + Number(p.score), 0);
  const todayCalories = todayPlunges.reduce((sum, p) => sum + estimateCalories(p.duration, p.temperature, bodyWeightLbs), 0);
  const weeklyCalories = last7Days.reduce((sum, p) => sum + estimateCalories(p.duration, p.temperature, bodyWeightLbs), 0);
  const allTimeCalories = plunges.reduce((sum, p) => sum + estimateCalories(p.duration, p.temperature, bodyWeightLbs), 0);
  const weeklyPct = Math.min(100, (weeklyMinutes / weeklyGoalMinutes) * 100);
  const streak = getStreak(plunges);

  // Total unique days plunged in the current calendar year
  const thisYear = new Date().getFullYear();
  const totalPlungeDaysThisYear = new Set(
    plunges
      .filter((p) => new Date(p.createdAt).getFullYear() === thisYear)
      .map((p) => new Date(p.createdAt).toDateString())
  ).size;

  // Inline badge elements shown next to username
  const StreakBadge = streak > 0 ? (
    <span
      data-testid="badge-streak"
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-500/25 border border-yellow-400/50 text-yellow-300 text-[10px] font-bold leading-none shrink-0"
      title={`${streak}-day streak`}
    >🔥{streak}</span>
  ) : null;

  const DaysBadge = totalPlungeDaysThisYear > 0 ? (
    <span
      data-testid="badge-total-days"
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-400/20 border border-slate-400/40 text-slate-300 text-[10px] font-bold leading-none shrink-0"
      title={`${totalPlungeDaysThisYear} days plunged this year`}
    >#{totalPlungeDaysThisYear}</span>
  ) : null;

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
      <header className="absolute z-10 inset-x-0 top-0 flex items-center justify-center px-5 pt-6 pb-2 pointer-events-none">
        <h1
          className="text-2xl font-extrabold italic tracking-wide text-white/90"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}
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
                    ? Array.from({ length: 21 }, (_, i) => -4 + i).map((c) => <option key={c} value={c}>{c}°C</option>)
                    : Array.from({ length: 36 }, (_, i) => 25 + i).map((f) => <option key={f} value={f}>{f}°F</option>)
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

            {/* Cold Score — tappable, cycles today → week → kcal (daily) → kcal (weekly) */}
            <div className="relative w-full">
              {/* Info button — top-right corner */}
              <button
                data-testid="button-score-info"
                onClick={(e) => { e.stopPropagation(); setScoreInfoOpen(v => !v); }}
                className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-blue-800/70 border border-blue-600/50 text-blue-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all text-[10px] font-bold"
              >ℹ</button>

              {/* Info popup */}
              {scoreInfoOpen && (
                <div className="absolute top-8 right-2 z-20 w-52 bg-blue-950 border border-blue-600/60 rounded-xl p-3 shadow-2xl shadow-black/60">
                  <button
                    onClick={() => setScoreInfoOpen(false)}
                    className="absolute top-1.5 right-2 text-blue-500 hover:text-white text-xs"
                  >✕</button>
                  <p className="text-blue-200 text-[10px] leading-relaxed">
                    <span className="text-cyan-300 font-bold">Cold Score</span> = duration (min) × temperature factor.<br />
                    40°F = <span className="text-cyan-300 font-bold">2.3×</span> · 50°F = <span className="text-cyan-300 font-bold">1.7×</span> · 60°F = <span className="text-cyan-300 font-bold">1.0×</span>
                  </p>
                  <p className="text-blue-200 text-[10px] leading-relaxed mt-2">
                    <span className="text-orange-300 font-bold">Calories</span> = thermogenesis model based on temp, duration &amp; body weight. Set your weight in Settings.
                  </p>
                </div>
              )}

              <button
                data-testid="card-cold-score"
                onClick={() => {
                  setScoreInfoOpen(false);
                  setScoreView(v => v === "today" ? "week" : v === "week" ? "kcal" : v === "kcal" ? "kcal-week" : "today");
                }}
                className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 hover:border-cyan-500/50 w-full"
              >
                {scoreView === "kcal" || scoreView === "kcal-week" ? (
                  <>
                    <div className="text-orange-300 text-[10px] font-semibold uppercase tracking-widest text-center leading-tight">
                      Calories<br />Burned
                    </div>
                    <Flame className="w-7 h-7 text-orange-400" />
                    <div className="text-orange-300 font-bold text-2xl leading-none">
                      {scoreView === "kcal"
                        ? (todayCalories > 0 ? Math.round(todayCalories) : "—")
                        : (weeklyCalories > 0 ? Math.round(weeklyCalories) : "—")
                      }
                    </div>
                    <div className="text-orange-400/70 text-[10px]">
                      {scoreView === "kcal" ? "kcal today" : "kcal this week"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest text-center leading-tight">
                      Cold<br />Score
                    </div>
                    <Snowflake className="w-7 h-7 text-cyan-400" />
                    <div className="text-cyan-300 font-bold text-2xl leading-none">
                      {scoreView === "today"
                        ? (displayScore > 0 ? displayScore.toFixed(1) : "—")
                        : (weeklyScore > 0 ? weeklyScore.toFixed(1) : "—")
                      }
                    </div>
                    <div className="text-blue-400 text-[10px]">
                      {scoreView === "today" ? (isActive ? "live" : "today") : "this week"}
                    </div>
                  </>
                )}
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
              <div className="flex items-center gap-2">
                <button
                  data-testid="button-manual-plunge"
                  onClick={() => {
                    setManualDate(new Date().toISOString().slice(0, 10));
                    setManualTime(new Date().toTimeString().slice(0, 5));
                    setManualMins(3);
                    setManualSecs(0);
                    setManualTempF(50);
                    setManualLocSel(""); setManualLocCustom(""); setManualLocGeo(null);
                    setManualNewName(""); setManualNewCountry("USA"); setManualNewState(""); setManualNewCity("");
                    setShowManualEntry(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/60 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Manually
                </button>
                <button
                  data-testid="button-close-history"
                  onClick={() => navTo("timer")}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                >✕</button>
              </div>
            </div>

            {/* Manual entry modal */}
            {showManualEntry && (() => {
              // Sort community spots by distance if GPS is available
              const sortedLocs = manualLocGeo
                ? [...communityLocs].sort((a, b) => {
                    const aLat = a.latitude ? Number(a.latitude) : null;
                    const aLng = a.longitude ? Number(a.longitude) : null;
                    const bLat = b.latitude ? Number(b.latitude) : null;
                    const bLng = b.longitude ? Number(b.longitude) : null;
                    if (aLat === null || aLng === null) return 1;
                    if (bLat === null || bLng === null) return -1;
                    return distanceMiles(manualLocGeo.lat, manualLocGeo.lng, aLat, aLng)
                         - distanceMiles(manualLocGeo.lat, manualLocGeo.lng, bLat, bLng);
                  })
                : communityLocs;

              const selCommunityId = manualLocSel.startsWith("community-")
                ? Number(manualLocSel.replace("community-", ""))
                : null;
              const selCommunityLoc = selCommunityId !== null
                ? communityLocs.find((l) => l.id === selCommunityId)
                : null;

              return (
              <div className="mb-4 bg-blue-900/80 border border-cyan-600/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-cyan-400" /> Log a Past Plunge
                  </div>
                  <button onClick={() => setShowManualEntry(false)} className="text-blue-400 hover:text-white text-lg leading-none">✕</button>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-blue-400 text-[10px] uppercase tracking-wide mb-1">Date</div>
                    <input
                      data-testid="input-manual-date"
                      type="date"
                      value={manualDate}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <div className="text-blue-400 text-[10px] uppercase tracking-wide mb-1">Time</div>
                    <input
                      data-testid="input-manual-time"
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <div className="text-blue-400 text-[10px] uppercase tracking-wide mb-1">Duration</div>
                  <div className="flex items-center gap-2">
                    <select
                      data-testid="select-manual-minutes"
                      value={manualMins}
                      onChange={(e) => setManualMins(Number(e.target.value))}
                      className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                    >
                      {Array.from({ length: 61 }, (_, i) => i).map((m) => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                    <span className="text-blue-400 text-sm">:</span>
                    <select
                      data-testid="select-manual-seconds"
                      value={manualSecs}
                      onChange={(e) => setManualSecs(Number(e.target.value))}
                      className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                        <option key={s} value={s}>{String(s).padStart(2, "0")} sec</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Temperature */}
                <div>
                  <div className="text-blue-400 text-[10px] uppercase tracking-wide mb-1">Water Temp</div>
                  <select
                    data-testid="select-manual-temp"
                    value={manualTempF}
                    onChange={(e) => setManualTempF(Number(e.target.value))}
                    className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  >
                    {Array.from({ length: 36 }, (_, i) => 25 + i).map((f) => (
                      <option key={f} value={f}>{f}°F</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-blue-400 text-[10px] uppercase tracking-wide">Location (optional)</div>
                    <button
                      data-testid="button-manual-near-me"
                      disabled={manualLocGeoLoading}
                      onClick={() => {
                        if (manualLocGeo) { setManualLocGeo(null); return; }
                        setManualLocGeoLoading(true);
                        navigator.geolocation?.getCurrentPosition(
                          (pos) => { setManualLocGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setManualLocGeoLoading(false); },
                          () => { setManualLocGeoLoading(false); toast({ title: "Location unavailable", variant: "destructive" }); }
                        );
                      }}
                      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all ${
                        manualLocGeo ? "bg-cyan-500/30 border border-cyan-400/50 text-cyan-300" : "bg-blue-800/60 border border-blue-600/50 text-blue-400 hover:text-cyan-300"
                      }`}
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      {manualLocGeoLoading ? "Locating…" : manualLocGeo ? "Near me ✓" : "Near me"}
                    </button>
                  </div>

                  <select
                    data-testid="select-manual-location"
                    value={manualLocSel}
                    onChange={(e) => { setManualLocSel(e.target.value); setManualLocCustom(""); }}
                    className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">— No location —</option>
                    {sortedLocs.length > 0 && (
                      <optgroup label="Community Spots">
                        {sortedLocs.map((l) => {
                          const lat = l.latitude ? Number(l.latitude) : null;
                          const lng = l.longitude ? Number(l.longitude) : null;
                          const dist = manualLocGeo && lat !== null && lng !== null
                            ? ` (${distanceMiles(manualLocGeo.lat, manualLocGeo.lng, lat, lng).toFixed(1)} mi)`
                            : "";
                          return (
                            <option key={l.id} value={`community-${l.id}`}>
                              📍 {l.name}{l.city ? `, ${l.city}` : ""}{dist}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <option value="custom">📍 Somewhere else…</option>
                    <option value="new">➕ Add new location…</option>
                  </select>

                  {/* Custom location text input */}
                  {manualLocSel === "custom" && (
                    <input
                      data-testid="input-manual-loc-custom"
                      type="text"
                      placeholder="Type location name…"
                      value={manualLocCustom}
                      onChange={(e) => setManualLocCustom(e.target.value)}
                      className="mt-2 w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                    />
                  )}

                  {/* Selected community spot info */}
                  {selCommunityLoc && (
                    <div className="mt-1.5 text-[11px] text-blue-300 px-1">
                      📍 {[selCommunityLoc.city, selCommunityLoc.state, selCommunityLoc.country].filter(Boolean).join(", ")}
                      {selCommunityLoc.description ? ` — ${selCommunityLoc.description}` : ""}
                    </div>
                  )}

                  {/* New location mini-form */}
                  {manualLocSel === "new" && (
                    <div className="mt-2 space-y-2 bg-blue-800/50 border border-blue-600/50 rounded-xl p-3">
                      <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-wide">New Community Spot</div>
                      <input
                        data-testid="input-manual-new-name"
                        type="text"
                        placeholder="Location name *"
                        value={manualNewName}
                        onChange={(e) => setManualNewName(e.target.value)}
                        className="w-full bg-blue-900/60 border border-blue-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          data-testid="select-manual-new-country"
                          value={manualNewCountry}
                          onChange={(e) => setManualNewCountry(e.target.value)}
                          className="bg-blue-900/60 border border-blue-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                        >
                          {["USA","Canada","Iceland","Norway","Switzerland","Australia","UK","Germany","Japan","Other"].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          data-testid="input-manual-new-state"
                          type="text"
                          placeholder="State / Region"
                          value={manualNewState}
                          onChange={(e) => setManualNewState(e.target.value)}
                          className="bg-blue-900/60 border border-blue-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none"
                        />
                      </div>
                      <input
                        data-testid="input-manual-new-city"
                        type="text"
                        placeholder="City"
                        value={manualNewCity}
                        onChange={(e) => setManualNewCity(e.target.value)}
                        className="w-full bg-blue-900/60 border border-blue-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none"
                      />
                      <button
                        data-testid="button-manual-create-spot"
                        disabled={!manualNewName.trim() || createCommunitySpot.isPending}
                        onClick={() => createCommunitySpot.mutate({
                          name: manualNewName.trim(),
                          country: manualNewCountry,
                          state: manualNewState.trim() || undefined,
                          city: manualNewCity.trim() || undefined,
                        })}
                        className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        {createCommunitySpot.isPending ? "Creating…" : "Create & Select"}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  data-testid="button-submit-manual-plunge"
                  disabled={createPlunge.isPending || (manualMins === 0 && manualSecs === 0) || (manualLocSel === "new")}
                  onClick={() => {
                    const durationSec = manualMins * 60 + manualSecs;
                    if (durationSec === 0) return;
                    const isoDate = new Date(`${manualDate}T${manualTime}:00`).toISOString();
                    const score = plungeScore(durationSec, manualTempF);
                    const finalLocId = manualLocSel.startsWith("community-") ? manualLocSel : undefined;
                    const finalLocName = manualLocSel.startsWith("community-")
                      ? (communityLocs.find((l) => l.id === Number(manualLocSel.replace("community-", "")))?.name)
                      : manualLocSel === "custom" ? (manualLocCustom.trim() || undefined)
                      : undefined;
                    createPlunge.mutate(
                      { duration: durationSec, temperature: manualTempF, score: String(score), hrAvg: null, spo2Avg: null, createdAt: isoDate, locationId: finalLocId, locationName: finalLocName },
                      {
                        onSuccess: () => {
                          setShowManualEntry(false);
                          setManualLocSel(""); setManualLocCustom(""); setManualLocGeo(null);
                          const locPart = finalLocName ? ` at ${finalLocName}` : "";
                          toast({ title: "Plunge logged! ❄️", description: `${manualMins}m ${manualSecs}s at ${manualTempF}°F${locPart} — added to history.` });
                        }
                      }
                    );
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-sm transition-all active:scale-[0.98]"
                >
                  {createPlunge.isPending ? "Saving…" : "Save Plunge"}
                </button>
              </div>
              );
            })()}

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
                  {visible.map((plunge) => <PlungeCard key={plunge.id} plunge={plunge} bodyWeightLbs={bodyWeightLbs} username={username} streak={streak} />)}
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
          <Explore
            username={username}
            onClose={() => navTo("timer")}
            onUpgrade={() => setShowUpgradeModal(true)}
            onViewLeaderboard={(locationId, name) => {
              setLeaderboardLocationId(locationId);
              setLeaderboardLocName(name);
            }}
          />
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
                <div className="text-blue-400 text-xs pt-1">Unlimited history · Chill Places · Advanced stats</div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-2xl p-4 border border-cyan-700/50 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Crown className="w-4 h-4 text-yellow-400" /> ColdStreak Pro
                  <span className="ml-auto text-yellow-400 text-sm font-bold">$7.99</span>
                </div>
                <ul className="space-y-1 text-blue-300 text-xs">
                  {["Unlimited plunge history", "Chill Places + leaderboards", "Advanced stats & personal bests", "CSV / Apple Health export", "No ads"].map((f) => (
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
                {!showSettingsRestore ? (
                  <button
                    data-testid="button-restore-purchase"
                    onClick={() => setShowSettingsRestore(true)}
                    className="w-full py-2 rounded-xl border border-blue-600/50 text-blue-400 text-xs font-semibold transition-all active:scale-[0.98] hover:border-blue-400 flex items-center justify-center gap-1.5"
                  >
                    <RestoreIcon className="w-3 h-3" /> Restore Purchase
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-blue-400 text-xs text-center">Enter the email you used at checkout:</p>
                    <div className="flex gap-2">
                      <input
                        data-testid="input-settings-restore-email"
                        type="email"
                        autoFocus
                        placeholder="your@email.com"
                        value={settingsRestoreEmail}
                        onChange={(e) => setSettingsRestoreEmail(e.target.value)}
                        className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        data-testid="button-settings-restore-submit"
                        disabled={restoreLoading || !settingsRestoreEmail.trim()}
                        onClick={async () => {
                          setRestoreLoading(true);
                          const ok = await restorePurchase(settingsRestoreEmail.trim());
                          setRestoreLoading(false);
                          if (ok) {
                            setShowSettingsRestore(false);
                            setSettingsRestoreEmail("");
                            toast({ title: "✅ Pro restored!", description: "Welcome back to ColdStreak Pro." });
                          } else {
                            toast({ title: "Not found", description: "No Pro purchase found for that email.", variant: "destructive" });
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-40 transition-all"
                      >
                        {restoreLoading ? "…" : "Go"}
                      </button>
                      <button
                        data-testid="button-settings-restore-cancel"
                        onClick={() => { setShowSettingsRestore(false); setSettingsRestoreEmail(""); }}
                        className="px-3 py-2 rounded-xl border border-blue-700 text-blue-400 text-xs font-semibold hover:border-blue-500 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Username */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <div className="text-white font-semibold flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-cyan-400" /> Leaderboard Name
              </div>
              {/* Badge preview */}
              {(StreakBadge || DaysBadge) && (
                <div className="flex items-center gap-2 mb-3 bg-blue-800/40 rounded-xl px-3 py-2 border border-blue-700/30">
                  <span className="text-blue-400 text-xs truncate">{username || "You"}</span>
                  {StreakBadge}
                  {DaysBadge}
                </div>
              )}
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

            {/* Achievements */}
            {(() => {
              const allStates = [...new Set(PASSPORT_LOCATIONS.map((l) => l.state))].sort();
              const allTiers: Difficulty[] = ["cold","ice-bath","extreme","arctic"];
              const earnedStates = new Set(computeStateBadges(badges));
              const earnedTiers = new Set(computeTierBadges(badges));
              const totalAchievements = earnedStates.size + earnedTiers.size;
              return (
                <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40">
                  <button
                    data-testid="button-toggle-badges"
                    onClick={() => setBadgesOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">Achievements</span>
                      <span className="text-cyan-500 text-xs">({totalAchievements} earned)</span>
                    </div>
                    <span className={`text-blue-400 text-xs transition-transform duration-200 ${badgesOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {badgesOpen && <div className="px-4 pb-4 space-y-4 border-t border-blue-700/30 pt-3">
                  {/* Tier Master Badges */}
                  <div>
                    <div className="text-blue-400 text-[11px] uppercase tracking-widest mb-2">
                      Tier Badges
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allTiers.map((tier) => {
                        const earned = earnedTiers.has(tier);
                        const meta = DIFFICULTY_META[tier];
                        const master = TIER_MASTER_META[tier];
                        return (
                          <div
                            key={tier}
                            data-testid={`achievement-tier-${tier}`}
                            title={earned ? master.award : `Complete all ${meta.label} spots to earn "${master.title}"`}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              earned
                                ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300"
                                : "bg-blue-800/40 border border-blue-700/30 text-blue-600"
                            }`}
                          >
                            <span>{meta.emoji}</span>
                            <span>{earned ? master.title : meta.label}</span>
                            {earned && <span className="text-[10px] text-cyan-400">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* State Badges */}
                  <div>
                    <div className="text-blue-400 text-[11px] uppercase tracking-widest mb-2">State Badges</div>
                    <div className="flex flex-wrap gap-1.5">
                      {allStates.map((state) => {
                        const earned = earnedStates.has(state);
                        const emoji = STATE_EMOJI[state] ?? "🏆";
                        const count = PASSPORT_LOCATIONS.filter((l) => l.state === state).length;
                        return (
                          <div
                            key={state}
                            data-testid={`achievement-state-${state.replace(/[\s/]/g, "-").toLowerCase()}`}
                            title={earned ? `${state} — all ${count} spot${count > 1 ? "s" : ""} completed!` : `Complete all ${count} ${state} spot${count > 1 ? "s" : ""} to earn this badge`}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              earned
                                ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-200"
                                : "bg-blue-800/40 border border-blue-700/30 text-blue-600"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{state}</span>
                            {earned && <span className="text-[10px] text-yellow-400">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>}
                </div>
              );
            })()}

            {/* Body Weight */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <div className="text-white font-semibold flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-orange-400" /> Body Weight
              </div>
              <div className="flex items-center gap-2">
                <input
                  data-testid="input-body-weight"
                  type="number"
                  min={50}
                  max={500}
                  value={bodyWeightLbs}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val > 0) setBodyWeightLbs(val);
                  }}
                  onBlur={(e) => {
                    const clamped = Math.min(500, Math.max(50, Number(e.target.value) || 154));
                    setBodyWeightLbs(clamped);
                    localStorage.setItem("coldstreak-body-weight", String(clamped));
                  }}
                  className="w-24 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 text-center font-bold"
                />
                <span className="text-blue-400 text-sm">lbs</span>
                <span className="text-blue-500 text-xs ml-1">({Math.round(bodyWeightLbs / 2.205)} kg)</span>
              </div>
              <p className="text-blue-500 text-xs mt-2">Used to estimate calories burned per plunge.</p>
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

              {/* Calorie stats row */}
              <div className="col-span-2 bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
                <div className="text-blue-400 text-xs uppercase tracking-wide mb-3 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" /> Est. Calories Burned
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-orange-300 font-bold text-lg leading-none">{Math.round(todayCalories) || "—"}</div>
                    <div className="text-blue-500 text-[10px] mt-0.5">today</div>
                  </div>
                  <div className="border-x border-blue-800">
                    <div className="text-orange-300 font-bold text-lg leading-none">{Math.round(weeklyCalories) || "—"}</div>
                    <div className="text-blue-500 text-[10px] mt-0.5">this week</div>
                  </div>
                  <div>
                    <div className="text-orange-300 font-bold text-lg leading-none">{Math.round(allTimeCalories) || "—"}</div>
                    <div className="text-blue-500 text-[10px] mt-0.5">all time</div>
                  </div>
                </div>
                <p className="text-blue-600 text-[10px] mt-3 leading-relaxed">
                  Estimated via thermogenesis model. Cold water forces your body to generate heat, burning extra calories beyond your normal resting rate.
                </p>
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

            {/* Safety & Disclaimer */}
            <div
              data-testid="card-disclaimer"
              className="bg-red-950/40 rounded-2xl border border-red-800/50"
            >
              <button
                data-testid="button-toggle-safety"
                onClick={() => setSafetyOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span className="text-white font-semibold text-sm">Safety &amp; Disclaimer</span>
                  {!safetySeen && <span className="text-[10px] bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full font-semibold">Please read</span>}
                </div>
                <span className={`text-red-400 text-xs transition-transform duration-200 ${safetyOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {safetyOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-red-800/40 pt-3">
                  <p className="text-red-200 text-xs leading-relaxed">
                    <span className="font-bold text-red-300">ASSUMPTION OF RISK:</span> Cold water immersion carries serious health risks including cold water shock, cardiac arrest, hypothermia, loss of consciousness, and drowning. By using ColdStreak, you acknowledge that you voluntarily assume all risks associated with cold plunge activities.
                  </p>
                  <p className="text-red-200 text-xs leading-relaxed">
                    ColdStreak is a tracking tool only. It does not provide medical advice. Consult a physician before beginning cold exposure therapy, especially if you have heart conditions, high blood pressure, Raynaud's disease, or are pregnant.
                  </p>
                  <p className="text-red-200 text-xs leading-relaxed">
                    <span className="font-bold text-red-300">Featured Locations:</span> USA locations listed in Chill Places are spring-fed or managed facilities selected for relative safety and year-round access. Sliding Rock (NC) is listed as seasonal — lifeguards are only present May–Labor Day. Conditions at all locations can change without notice due to weather, drought, flooding, or closures. Always check current local conditions before visiting. Never plunge alone.
                  </p>
                  <p className="text-red-200/70 text-[10px] leading-relaxed">
                    ColdStreak and its developers accept no liability for injury, illness, or death resulting from cold plunge activities. Use this app at your own risk.
                  </p>
                  {!safetySeen && (
                    <button
                      data-testid="button-acknowledge-safety"
                      onClick={() => {
                        localStorage.setItem("coldstreak-safety-seen", "true");
                        setSafetyOpen(false);
                      }}
                      className="w-full py-2 rounded-xl bg-red-800/60 border border-red-600/50 text-red-200 text-xs font-semibold hover:bg-red-700/60 transition-all active:scale-95"
                    >
                      I understand — collapse
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Terms of Service */}
            <div
              data-testid="card-tos"
              className="bg-blue-900/40 rounded-2xl border border-blue-700/40"
            >
              <button
                data-testid="button-toggle-tos"
                onClick={() => setTosOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-semibold text-sm">Terms &amp; Legal</span>
                </div>
                <span className={`text-blue-400 text-xs transition-transform duration-200 ${tosOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {tosOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-blue-700/30 pt-3">

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Terms of Service</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      By using ColdStreak you agree to these terms. ColdStreak is provided "as is" for personal health tracking purposes only. We reserve the right to modify or discontinue the service at any time without notice. Continued use of the app constitutes acceptance of any updated terms.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Privacy Policy</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      ColdStreak stores your plunge history and settings locally on your device. When you submit a leaderboard entry, your chosen display name and plunge score are stored on our servers. We do not sell or share your personal data with third parties. Your email address (used for Pro verification) is stored securely and used only to verify your purchase.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">No Medical Advice</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      Nothing in ColdStreak constitutes medical advice, diagnosis, or treatment. Cold exposure scores, calorie estimates, and wellness metrics are approximations for informational purposes only. Always consult a qualified healthcare provider before starting any cold exposure regimen.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Purchases &amp; Refunds</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      ColdStreak Pro is a one-time purchase that unlocks additional features. All purchases are final and non-refundable except where required by applicable law. If you experience issues with your purchase, contact us through the app.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Limitation of Liability</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      To the fullest extent permitted by law, ColdStreak and its developers shall not be liable for any indirect, incidental, special, or consequential damages arising from use of the app or from cold plunge activities undertaken in connection with it. Your sole remedy for dissatisfaction is to stop using the app.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">User-Submitted Content</p>
                    <p className="text-blue-200 text-xs leading-relaxed">
                      By submitting a community spot or leaderboard entry, you confirm the information is accurate to the best of your knowledge and that you grant ColdStreak a non-exclusive license to display it within the app. We reserve the right to remove any content that is inaccurate, inappropriate, or in violation of these terms.
                    </p>
                  </div>

                  <p className="text-blue-500 text-[10px]">Last updated: March 2026. For questions, contact us via the App Store listing.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── LEADERBOARD MODAL ─── */}
      {leaderboardLocationId && (() => {
        const passportLoc = PASSPORT_LOCATIONS.find((l) => l.id === leaderboardLocationId);
        const isCommunity = leaderboardLocationId.startsWith("community-");
        const displayFlag = passportLoc?.flag ?? "📍";
        const displayName = leaderboardLocName || passportLoc?.name || leaderboardLocationId;
        const displaySub = passportLoc?.tempRange ?? (isCommunity ? "Community spot" : "");
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
                  <span className="text-3xl">{displayFlag}</span>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">{displayName}</h3>
                    <p className="text-blue-400 text-xs">{displaySub}</p>
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
                {!isCommunity && hasBadge(leaderboardLocationId) && (
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
                      const isMyEntry = entry.username === username;
                      const isConfirming = confirmDeleteEntryId === entry.id;
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
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="text-white font-semibold text-sm truncate">{entry.username}</span>
                              {isMyEntry && StreakBadge}
                              {isMyEntry && !streak && DaysBadge}
                            </div>
                            <div className="text-blue-400 text-xs">
                              {Math.floor(entry.duration / 60)}:{String(entry.duration % 60).padStart(2, "0")} · {entry.temperature}°F
                            </div>
                          </div>
                          {isMyEntry && (
                            <div className="flex items-center gap-1 shrink-0">
                              {isConfirming ? (
                                <>
                                  <button
                                    data-testid={`button-confirm-delete-entry-${entry.id}`}
                                    onClick={() => {
                                      deleteLeaderboard.mutate({ id: entry.id, locationId: leaderboardLocationId! });
                                      setConfirmDeleteEntryId(null);
                                    }}
                                    className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-lg font-bold active:scale-95"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    data-testid={`button-cancel-delete-entry-${entry.id}`}
                                    onClick={() => setConfirmDeleteEntryId(null)}
                                    className="text-[10px] px-2 py-1 bg-blue-800 text-blue-300 rounded-lg active:scale-95"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  data-testid={`button-delete-entry-${entry.id}`}
                                  onClick={() => setConfirmDeleteEntryId(entry.id)}
                                  className="p-1.5 text-blue-600 hover:text-red-400 transition-colors rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
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

            {/* Badge earned celebration */}
            {(StreakBadge || DaysBadge) && (
              <div className="flex items-center gap-2 bg-blue-900/60 border border-blue-700/40 rounded-xl px-3 py-2">
                <span className="text-blue-400 text-xs flex-1">
                  {streak > 0 ? `${streak}-day streak!` : `${totalPlungeDaysThisYear} days this year`}
                </span>
                {StreakBadge}
                {DaysBadge}
              </div>
            )}

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
                {communityLocs.length > 0 && (
                  <optgroup label="Community Spots">
                    {communityLocs.map((l) => (
                      <option key={`community-${l.id}`} value={`community-${l.id}`}>📍 {l.name}{l.city ? `, ${l.city}` : ""}{l.state ? `, ${l.state}` : ""}</option>
                    ))}
                  </optgroup>
                )}
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
                    if (promptLocationId.startsWith("community-")) {
                      const cid = Number(promptLocationId.replace("community-", ""));
                      const cloc = communityLocs.find((l) => l.id === cid);
                      return (
                        <div className="text-xs text-blue-300 leading-relaxed">
                          <span className="font-semibold text-cyan-300">📍 {cloc?.name ?? "Community Spot"}</span>
                          {cloc?.description ? ` — ${cloc.description}` : ""}
                        </div>
                      );
                    }
                    const loc = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId);
                    if (!loc) return null;
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
                const isCommunityPick = promptLocationId.startsWith("community-");
                const finalLocationId = promptLocationId && promptLocationId !== "custom" ? promptLocationId : undefined;
                let finalLocationName: string | undefined;
                if (promptLocationId === "custom") {
                  finalLocationName = promptCustomLocation.trim() || undefined;
                } else if (isCommunityPick) {
                  const cid = Number(promptLocationId.replace("community-", ""));
                  finalLocationName = communityLocs.find((l) => l.id === cid)?.name;
                } else if (promptLocationId) {
                  finalLocationName = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId)?.name;
                }

                if (!promptPhotoData && !finalLocationName) {
                  setPhotoPromptId(null);
                  return;
                }

                setPromptSaving(true);
                updatePlunge.mutate(
                  {
                    id: photoPromptId,
                    patch: {
                      locationName: finalLocationName ?? undefined,
                      locationId: finalLocationId ?? undefined,
                    },
                  },
                  {
                    onSuccess: async () => {
                      if (promptPhotoData && photoPromptId) {
                        await savePhoto(photoPromptId, promptPhotoData).catch(() => {});
                      }
                      // Passport badge — only for official Chill Places
                      if (finalLocationId && !isCommunityPick) {
                        const isNewBadge = !hasBadge(finalLocationId);
                        awardBadge(finalLocationId);
                        if (isNewBadge) {
                          const loc = PASSPORT_LOCATIONS.find((l) => l.id === finalLocationId);
                          if (loc) {
                            confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ["#fbbf24", "#f59e0b", "#ffffff", "#0ea5e9"] });
                            toast({ title: "🏅 Chill Place Unlocked!", description: `${loc.flag} ${loc.name} — added to your Chill Places!` });
                          } else {
                            toast({ title: "Plunge updated!" });
                          }
                        } else {
                          toast({ title: "Plunge updated!" });
                        }
                      } else {
                        toast({ title: "Plunge updated!" });
                      }

                      // Submit to leaderboard if opted in (works for both passport and community)
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

            {/* Share button */}
            {promptPlungeRef.current && (
              <button
                data-testid="button-share-after-plunge"
                onClick={async () => {
                  if (!promptPlungeRef.current) return;
                  let locationName: string | undefined;
                  if (promptLocationId === "custom") {
                    locationName = promptCustomLocation.trim() || undefined;
                  } else if (promptLocationId.startsWith("community-")) {
                    const cid = Number(promptLocationId.replace("community-", ""));
                    locationName = communityLocs.find((l) => l.id === cid)?.name;
                  } else if (promptLocationId) {
                    locationName = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId)?.name;
                  }
                  const text = buildShareText({
                    username,
                    temperature: promptPlungeRef.current.temperature,
                    duration: promptPlungeRef.current.duration,
                    streak,
                    locationName,
                  });
                  if (navigator.share) {
                    if (promptPhotoData) {
                      try {
                        const res = await fetch(promptPhotoData);
                        const blob = await res.blob();
                        const file = new File([blob], "coldstreak-plunge.jpg", { type: blob.type || "image/jpeg" });
                        if (navigator.canShare?.({ files: [file] })) {
                          await navigator.share({ files: [file], text });
                          return;
                        }
                      } catch (e: any) {
                        if (e?.name === "AbortError") return;
                      }
                    }
                    try {
                      await navigator.share({ title: "ColdStreak Plunge", text });
                      return;
                    } catch (e: any) {
                      if (e?.name === "AbortError") return;
                    }
                  }
                  try {
                    await navigator.clipboard.writeText(text);
                    toast({ title: "Copied!", description: "Paste to share with friends." });
                  } catch {
                    toast({ title: "Could not copy", variant: "destructive" });
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-blue-600/60 text-blue-300 text-sm font-semibold hover:border-cyan-500/60 hover:text-cyan-300 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" /> Share with friends
              </button>
            )}
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
                { icon: "🗺️", text: "Chill Places — earn badges at iconic locations" },
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
