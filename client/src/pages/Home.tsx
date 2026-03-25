import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { savePhoto } from "@/lib/photoStore";
import icebergBg from "@assets/image_1773152998246.png";
import {
  Play, Pause, RotateCcw, Snowflake, History,
  Activity, AlarmClock, Flame, Target, Zap,
  Settings, Bell, Upload, Volume2, FileText,
  Camera, MapPin, Lock, ShieldAlert, Trophy, User, ChevronDown,
  Sparkles, Crown, CheckCircle2, RotateCcw as RestoreIcon, Compass, Info, Plus, Calendar, Trash2, Share2, AlertCircle, Download, ShoppingCart, Navigation, Building2, Bluetooth, BluetoothOff, Heart, X
} from "lucide-react";

import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePlunges, useCreatePlunge, useUpdatePlunge, useDeletePlunge } from "@/hooks/use-plunges";
import { useLeaderboard, useSubmitLeaderboard, useDeleteLeaderboardEntry, type LeaderboardEntryWithBadge } from "@/hooks/use-leaderboard";
import { useProStatus, PENDING_CHECKOUT_KEY } from "@/hooks/use-pro-status";
import { PlungeCard, buildShareText } from "@/components/PlungeCard";
import { BannerAd, FeedAd, InterstitialAd } from "@/components/AdUnit";
import Onboarding, { hasCompletedOnboarding } from "@/components/Onboarding";
import { Analytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { getClientId } from "@/hooks/use-plunges";
import { buildShareImage, dataUrlToBlob, loadImage, buildShareBlobFromPreloaded } from "@/lib/shareImage";
import { isNative, nativeShare } from "@/lib/nativeShare";
import { saveCustomAlarmUrl, loadCustomAlarmUrl, clearCustomAlarmUrl } from "@/lib/alarm-storage";
import { Explore, GEAR_ITEMS, type GearCategory } from "@/pages/Explore";
import {
  PASSPORT_LOCATIONS, usePassportBadges, distanceMiles,
  DIFFICULTY_META, STATE_EMOJI,
  computeStateBadges,
  TEMP_TIERS,
  DAYS_TIERS,
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
  { id: "alarm_clock",   label: "Alarm Clock",    url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",           gain: 1.0 },
  { id: "digital_watch", label: "Digital Watch",  url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg", gain: 3.0 },
  { id: "bell",          label: "Bell",           url: "https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg", gain: 1.0 },
];
const CUSTOM_ALARM_DURATION_MS = 5000;

interface AlarmHandle { stop: () => void }

// Synthesised digital-watch beep — no network request, no CORS issues, works in all WebViews
function playDigitalWatchSynth(durationMs: number): AlarmHandle {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return { stop: () => {} };
  let ctx: AudioContext | null;
  try { ctx = new AC(); } catch { return { stop: () => {} }; }

  const start = ctx.currentTime;
  const end = start + durationMs / 1000;
  const beepDur = 0.08; const beepGap = 0.06; const groupPause = 0.35; const freq = 1760;
  let t = start;
  while (t < end) {
    for (let i = 0; i < 4 && t < end; i++) {
      const osc = ctx.createOscillator();
      const gn = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t);
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(0.4, t + 0.005);
      gn.gain.setValueAtTime(0.4, t + beepDur - 0.01);
      gn.gain.linearRampToValueAtTime(0, t + beepDur);
      osc.connect(gn); gn.connect(ctx.destination);
      osc.start(t); osc.stop(t + beepDur);
      t += beepDur + beepGap;
    }
    t += groupPause;
  }
  const stop = () => { try { ctx?.close(); ctx = null; } catch {} };
  setTimeout(stop, durationMs + 200);
  return { stop };
}

function playAlarm(url: string, label: string, isCustom: boolean, stopAfterMs?: number): AlarmHandle {
  // Digital watch: always synthesise — Google Sound URLs block via CORS when run through AudioContext
  if (!isCustom && label === "Digital Watch") {
    return playDigitalWatchSynth(stopAfterMs ?? 5000);
  }
  const audio = new Audio(url);
  audio.volume = 1;
  audio.play().catch(() => {});
  const handle: AlarmHandle = { stop: () => { audio.pause(); audio.currentTime = 0; } };
  if (stopAfterMs) setTimeout(() => handle.stop(), stopAfterMs);
  return handle;
}

type Screen = "timer" | "history" | "explore" | "gear" | "settings" | "legal" | "achievements" | "devices";


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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function openDirections(lat: number | string, lng: number | string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank", "noopener,noreferrer");
}

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());
  const auth = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [rememberEmail, setRememberEmail] = useState<boolean>(() => localStorage.getItem("coldstreak-remember-email") === "true");
  const [authEmail, setAuthEmail] = useState(() => localStorage.getItem("coldstreak-remember-email") === "true" ? (localStorage.getItem("coldstreak-saved-email") ?? "") : "");
  const [authPassword, setAuthPassword] = useState("");
  const [syncDone, setSyncDone] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resendSent, setResendSent] = useState(false);

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

  // Bluetooth thermometer
  const [btConnected, setBtConnected] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState("");
  const [btOffsetVisible, setBtOffsetVisible] = useState(false);
  const btOffsetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [btThermoTimedOut, setBtThermoTimedOut] = useState(false);
  const btDeviceRef = useRef<string | null>(null); // stores deviceId (string)
  const btKeepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const btProtocolRef = useRef<"gatt" | "govee" | "tp25" | null>(null);
  const thermoReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thermoReconnectCountRef = useRef(0);
  const [savedDevicesKey, setSavedDevicesKey] = useState(0); // bump to re-render saved device rows
  // HR custom scanner
  const [hrScanActive, setHrScanActive] = useState(false);
  const [hrScanDone, setHrScanDone] = useState(false);
  const [hrScanDevices, setHrScanDevices] = useState<{deviceId: string; name: string; rssi: number}[]>([]);
  // HR manual address entry
  const [hrManualEntry, setHrManualEntry] = useState(false);
  const [hrManualAddress, setHrManualAddress] = useState("");
  const [hrManualName, setHrManualName] = useState("");
  // Temperature calibration offset in °F (persisted, user-adjustable)
  const [btTempOffset, setBtTempOffset] = useState<number>(
    () => Number(localStorage.getItem("coldstreak-bt-temp-offset") ?? 0)
  );
  // Ref copy so BLE callbacks (closures) always see the latest offset
  const btTempOffsetRef = useRef<number>(Number(localStorage.getItem("coldstreak-bt-temp-offset") ?? 0));

  // Heart rate monitor (separate BLE connection)
  const [hrConnected, setHrConnected] = useState(false);
  const [hrConnecting, setHrConnecting] = useState(false);
  const [hrDeviceName, setHrDeviceName] = useState("");
  const hrDeviceIdRef = useRef<string | null>(null);
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [hrPeak, setHrPeak] = useState<number | null>(null);
  const hrReadingsRef = useRef<number[]>([]);

  // Countdown
  const [countdownMode, setCountdownMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownElapsed, setCountdownElapsed] = useState(0);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  const [minutesInput, setMinutesInput] = useState(3);
  const [secondsInput, setSecondsInput] = useState(0);
  const alarmRef = useRef<AlarmHandle | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const countdownTotalRef = useRef<number>(0);

  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState<number>(
    () => Number(localStorage.getItem("weeklyGoalMinutes") ?? 11)
  );

  useEffect(() => {
    localStorage.setItem("coldstreak-temperature", String(temperature));
  }, [temperature]);

  useEffect(() => {
    localStorage.setItem("coldstreak-bt-temp-offset", String(btTempOffset));
    btTempOffsetRef.current = btTempOffset;
  }, [btTempOffset]);

  // Keep the calibration offset visible for 10 s after a disconnect so the
  // brief reconnect cycle doesn't flash it in and out
  useEffect(() => {
    if (btConnected) {
      if (btOffsetTimerRef.current) clearTimeout(btOffsetTimerRef.current);
      setBtOffsetVisible(true);
    } else {
      btOffsetTimerRef.current = setTimeout(() => setBtOffsetVisible(false), 10_000);
    }
    return () => {
      if (btOffsetTimerRef.current) clearTimeout(btOffsetTimerRef.current);
    };
  }, [btConnected]);

  // Handle Stripe payment return — verify session_id in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    localStorage.removeItem(PENDING_CHECKOUT_KEY);
    verifySession(sessionId).then((success) => {
      if (success) {
        toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "All Pro features are now unlocked." });
      } else {
        toast({ title: "Payment not confirmed", description: "If you completed payment, try Restore Purchase.", variant: "destructive" });
      }
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, []);


  // Handle business listing verification return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const businessSessionId = params.get("business_session_id");
    const businessLocationId = params.get("business_location_id");
    if (!businessSessionId || !businessLocationId) return;
    window.history.replaceState({}, "", window.location.pathname);
    fetch(`/api/stripe/business-verify?session_id=${businessSessionId}&location_id=${businessLocationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.verified) {
          queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
          navTo("explore");
          toast({ title: "✓ Business Verified!", description: "Your listing now shows a Verified Business badge." });
        }
      })
      .catch(() => {
        toast({ title: "Verification issue", description: "Could not confirm your listing. Please contact support.", variant: "destructive" });
      });
  }, []);

  // Alarm sound
  const [alarmUrl, setAlarmUrl] = useState<string>(() => {
    // Legacy: if a data URL was stored directly in localStorage, use it (will be migrated to IndexedDB below)
    const stored = localStorage.getItem("alarmUrl");
    if (stored && stored.startsWith("data:")) return stored;
    return ALARM_PRESETS[0].url;
  });
  const [alarmLabel, setAlarmLabel] = useState<string>(
    () => localStorage.getItem("alarmLabel") ?? ALARM_PRESETS[0].label
  );
  const [alarmGain, setAlarmGain] = useState<number>(
    () => Number(localStorage.getItem("alarmGain") || ALARM_PRESETS[0].gain)
  );
  const [alarmIsCustom, setAlarmIsCustom] = useState<boolean>(
    () => localStorage.getItem("alarmIsCustom") === "true"
  );
  const [alarmCustomLabel, setAlarmCustomLabel] = useState<string>(
    () => localStorage.getItem("alarmCustomLabel") ?? ""
  );
  const alarmUploadRef = useRef<HTMLInputElement | null>(null);

  // On mount: load custom alarm from IndexedDB (or migrate from old localStorage format)
  useEffect(() => {
    const isCustom = localStorage.getItem("alarmIsCustom") === "true";
    if (!isCustom) return;
    const legacyUrl = localStorage.getItem("alarmUrl");
    if (legacyUrl && legacyUrl.startsWith("data:")) {
      // Migrate: move large data URL from localStorage into IndexedDB
      saveCustomAlarmUrl(legacyUrl).then(() => {
        localStorage.removeItem("alarmUrl");
      });
      // Already in state from init, nothing else to do
      return;
    }
    // Normal load from IndexedDB
    loadCustomAlarmUrl().then((url) => {
      if (url) setAlarmUrl(url);
    });
  }, []);

  const selectPresetAlarm = (url: string, label: string, gain: number) => {
    setAlarmUrl(url);
    setAlarmLabel(label);
    setAlarmGain(gain);
    setAlarmIsCustom(false);
    localStorage.setItem("alarmUrl", url);
    localStorage.setItem("alarmLabel", label);
    localStorage.setItem("alarmGain", String(gain));
    localStorage.setItem("alarmIsCustom", "false");
    clearCustomAlarmUrl();
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const defaultName = file.name.replace(/\.[^.]+$/, "");
      setAlarmUrl(dataUrl);
      setAlarmLabel(defaultName);
      setAlarmGain(1.0);
      setAlarmIsCustom(true);
      setAlarmCustomLabel(defaultName);
      // Save audio data to IndexedDB (no size limit), metadata to localStorage
      await saveCustomAlarmUrl(dataUrl);
      localStorage.setItem("alarmLabel", defaultName);
      localStorage.setItem("alarmGain", "1");
      localStorage.setItem("alarmIsCustom", "true");
      localStorage.setItem("alarmCustomLabel", defaultName);
      // Remove any stale data URL from localStorage to free space
      localStorage.removeItem("alarmUrl");
      toast({ title: "Custom alarm saved", description: `Tap the label to rename it.` });
    };
    reader.readAsDataURL(file);
  };

  const saveCustomLabel = (name: string) => {
    const trimmed = name.trim() || "Custom";
    setAlarmCustomLabel(trimmed);
    setAlarmLabel(trimmed);
    localStorage.setItem("alarmCustomLabel", trimmed);
    localStorage.setItem("alarmLabel", trimmed);
  };

  const previewAlarm = () => {
    try {
      playAlarm(alarmUrl, alarmLabel, alarmIsCustom, alarmIsCustom ? CUSTOM_ALARM_DURATION_MS : 3000);
    } catch {
      toast({ title: "Preview failed", description: "Tap the screen first to allow audio playback.", variant: "destructive" });
    }
  };

  // Photo / location prompt
  const [photoPromptId, setPhotoPromptId] = useState<number | null>(null);
  const [promptPhotoData, setPromptPhotoData] = useState<string | null>(null);
  const [promptLocationId, setPromptLocationId] = useState<string>("");
  const [promptCustomLocation, setPromptCustomLocation] = useState<string>("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptSharing, setPromptSharing] = useState(false);
  const [gpsLocationName, setGpsLocationName] = useState<string | null>(null);
  const [gpsLocationLoading, setGpsLocationLoading] = useState(false);
  const [privateLocs, setPrivateLocs] = useState<Array<{id: string; name: string}>>(() => {
    try { return JSON.parse(localStorage.getItem("coldstreak-private-locs") || "[]"); } catch { return []; }
  });
  const [savePrivateOpen, setSavePrivateOpen] = useState(false);
  const [savePrivateName, setSavePrivateName] = useState("");
  const sharingLockRef = useRef(false);
  const weightHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weightHoldCountRef = useRef(0);
  const [promptSubmitLeaderboard, setPromptSubmitLeaderboard] = useState(true);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const preloadedPhotoRef = useRef<HTMLImageElement | null>(null);
  const preloadedLogoRef = useRef<HTMLImageElement | null>(null);

  const startWebCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      webStreamRef.current = stream;
      setShowWebCamera(true);
      setTimeout(() => { if (webVideoRef.current) webVideoRef.current.srcObject = stream; }, 50);
    } catch {
      photoInputRef.current?.click();
    }
  }, []);

  const stopWebCamera = useCallback(() => {
    webStreamRef.current?.getTracks().forEach(t => t.stop());
    webStreamRef.current = null;
    setShowWebCamera(false);
  }, []);

  const captureWebPhoto = useCallback(() => {
    if (!webVideoRef.current) return;
    const v = webVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    setPromptPhotoData(canvas.toDataURL("image/jpeg", 0.8));
    stopWebCamera();
  }, [stopWebCamera]);

  // Pro status
  const { isPro, proEmail, proPlan, promoExpiresAt, loading: proLoading, isFoundingPlunger, startCheckout, verifySession, restorePurchase, redeemPromo, clearPro, verifyProForEmail } = useProStatus();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pendingRestoreEmail, setPendingRestoreEmail] = useState<string | null>(null);

  // Native app: handle deep link return from Stripe checkout via Android App Links.
  // Covers both fresh-launch (getLaunchUrl) and resume (appUrlOpen) cases.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleStripeUrl = async (urlStr: string) => {
      try {
        const url = new URL(urlStr);
        const sessionId = url.searchParams.get("session_id");
        if (sessionId) {
          localStorage.removeItem(PENDING_CHECKOUT_KEY);
          const success = await verifySession(sessionId);
          if (success) {
            toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "All Pro features are now unlocked." });
          } else {
            toast({ title: "Payment not confirmed", description: "If you completed payment, try Restore Purchase.", variant: "destructive" });
          }
          return;
        }
        const pendingEmail = localStorage.getItem(PENDING_CHECKOUT_KEY);
        if (!pendingEmail) return;
        if (pendingEmail !== "unknown") {
          const result = await restorePurchase(pendingEmail);
          if (result.success && result.planType === "lifetime") {
            localStorage.removeItem(PENDING_CHECKOUT_KEY);
            toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "Lifetime access unlocked." });
            return;
          } else if (result.success && result.planType !== "lifetime") {
            // Still monthly — keep the key so we keep retrying on next return
            return;
          }
        }
        localStorage.removeItem(PENDING_CHECKOUT_KEY);
        setPendingRestoreEmail(pendingEmail === "unknown" ? "" : pendingEmail);
      } catch {}
    };

    // Check launch URL (app opened fresh via deep link — event fires before React mounts)
    CapApp.getLaunchUrl().then((result) => {
      if (result?.url) handleStripeUrl(result.url);
    });

    // Also listen for resume via deep link (app already running)
    let listenerHandle: { remove: () => void } | null = null;
    CapApp.addListener("appUrlOpen", (data: { url: string }) => {
      handleStripeUrl(data.url);
    }).then((h: { remove: () => void }) => { listenerHandle = h; });

    return () => { listenerHandle?.remove(); };
  }, [verifySession, restorePurchase]);

  // Native app: fallback restore via visibility change (for non-App-Link returns)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const pendingEmail = localStorage.getItem(PENDING_CHECKOUT_KEY);
      if (!pendingEmail) return;
      if (pendingEmail !== "unknown") {
        const result = await restorePurchase(pendingEmail);
        if (result.success && result.planType === "lifetime") {
          // Successfully upgraded to lifetime — clear key and celebrate
          localStorage.removeItem(PENDING_CHECKOUT_KEY);
          toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "Lifetime access unlocked." });
          return;
        }
        // Either still monthly (payment in progress) or restore failed — keep key to retry
        return;
      }
      // Unknown email — show the manual entry dialog
      localStorage.removeItem(PENDING_CHECKOUT_KEY);
      setPendingRestoreEmail("");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [restorePurchase]);

  const { data: fpCountData } = useQuery<{ count: number; remaining: number; limit: number }>({
    queryKey: ["/api/founding-plunger-count"],
    enabled: showUpgradeModal,
    staleTime: 30_000,
  });
  const { data: lifetimePriceData } = useQuery<{ phase: number; price: number; label: string; fpRemaining: number; nextPrice: number | null }>({
    queryKey: ["/api/lifetime-price"],
    enabled: showUpgradeModal,
    staleTime: 30_000,
  });
  const lifetimePrice = lifetimePriceData?.price ?? 19.99;
  const lifetimeLabel = lifetimePriceData?.label ?? "Early Adopter";
  const lifetimePhase = lifetimePriceData?.phase ?? 1;
  const lifetimeNextPrice = lifetimePriceData?.nextPrice ?? null;
  const [showPostSessionAd, setShowPostSessionAd] = useState(false);
  const [gearCategory, setGearCategory] = useState<GearCategory>("plunges");
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
  const [manualLocSel, setManualLocSel] = useState("home"); // "home", "community-N", "custom", "new"
  const [manualLocCustom, setManualLocCustom] = useState("");
  const [manualLocGeo, setManualLocGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLocGeoLoading, setManualLocGeoLoading] = useState(false);
  const [manualNewName, setManualNewName] = useState("");
  const [manualNewCountry, setManualNewCountry] = useState("USA");
  const [manualNewState, setManualNewState] = useState("");
  const [manualNewCity, setManualNewCity] = useState("");
  const [manualNewIsBusiness, setManualNewIsBusiness] = useState(false);
  const [manualNewWebsite, setManualNewWebsite] = useState("");

  const createCommunitySpot = useMutation({
    mutationFn: async (loc: { name: string; country: string; state?: string; city?: string; isBusiness?: boolean; websiteUrl?: string }) => {
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
      setManualNewIsBusiness(false); setManualNewWebsite("");
      toast({ title: "Spot created!", description: `${newLoc.name} added to community spots.` });
    },
  });
  const [bodyWeightLbs, setBodyWeightLbs] = useState<number>(() => {
    if (!localStorage.getItem("coldstreak-auth-token")) {
      localStorage.removeItem("coldstreak-body-weight");
      return 150;
    }
    return Number(localStorage.getItem("coldstreak-body-weight") || 150);
  });
  const [restoreEmailInput, setRestoreEmailInput] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [settingsRestoreEmail, setSettingsRestoreEmail] = useState("");
  const [showSettingsRestore, setShowSettingsRestore] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [badgeDetailModal, setBadgeDetailModal] = useState<
    | { type: "days"; tierId: string }
    | { type: "temp-tier"; tierId: string }
    | { type: "state"; state: string }
    | null
  >(null);
  const [showTempTier, setShowTempTier] = useState<boolean>(
    () => localStorage.getItem("coldstreak-show-temp-tier") !== "false"
  );
  const [showDaysBadge, setShowDaysBadge] = useState<boolean>(
    () => localStorage.getItem("coldstreak-show-days-badge") !== "false"
  );
  const [featuredStateIds, setFeaturedStateIds] = useState<string[]>(() => {
    const raw: string[] = JSON.parse(localStorage.getItem("coldstreak-featured-badges") ?? "[]");
    return raw.filter((id: string) => !TEMP_TIERS.some(t => t.id === id) && !DAYS_TIERS.some(t => t.id === id));
  });
  const [openSections, setOpenSections] = useState({ tier: true, days: true, states: true, featured: true });
  const [userOpen, setUserOpen] = useState(true);
  const [homeLabel, setHomeLabel] = useState(() => localStorage.getItem("coldstreak-home-label") || "Home");
  const [safetySeen] = useState(() => !!localStorage.getItem("coldstreak-safety-seen"));
  const [safetyOpen, setSafetyOpen] = useState(() => !localStorage.getItem("coldstreak-safety-seen"));
  const [legalAgreed, setLegalAgreed] = useState(() => !!localStorage.getItem("coldstreak-legal-agreed"));
  const [legalCheckbox, setLegalCheckbox] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const [communityDisclaimerOpen, setCommunityDisclaimerOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [notifDismissed, setNotifDismissed] = useState(() =>
    !!localStorage.getItem("coldstreak-notif-dismissed")
  );
  const pushEndpointRef = useRef<string | null>(null);

  // Leaderboard
  const [leaderboardLocationId, setLeaderboardLocationId] = useState<string | null>(null);
  const [leaderboardLocName, setLeaderboardLocName] = useState<string>("");
  const [legendTip, setLegendTip] = useState<string | null>(null);
  const { data: communityLocs = [] } = useQuery<UserLocation[]>({ queryKey: ["/api/community-locations"] });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem("coldstreak-username") ?? "";
  });
  // Plunge data stored for leaderboard submission after save
  const promptPlungeRef = useRef<{ score: string; duration: number; temperature: number; timerUsed: boolean } | null>(null);

  const { toast } = useToast();
  const { data: plunges = [], isLoading } = usePlunges();
  const createPlunge = useCreatePlunge();
  const updatePlunge = useUpdatePlunge();
  const deletePlunge = useDeletePlunge();
  const submitLeaderboard = useSubmitLeaderboard();
  const deleteLeaderboard = useDeleteLeaderboardEntry();
  const { badges, awardBadge, hasBadge } = usePassportBadges();
  const leaderboard = useLeaderboard(leaderboardLocationId);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<number | null>(null);

  // Compute featured badge IDs: highest earned temp tier + highest earned days tier + selected state badges
  const _fbtOrd = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
  const _fbtEarned = new Set<string>();
  let _fbtCas = false;
  for (const _t of _fbtOrd) {
    if (!_fbtCas) _fbtCas = plunges.some(p => p.temperature >= _t.minTemp && p.temperature <= _t.maxTemp);
    if (_fbtCas) _fbtEarned.add(_t.id);
  }
  const highestEarnedTempTier = _fbtOrd.find(t => _fbtEarned.has(t.id)) ?? null;
  const _fbtUniqueDays = new Set(plunges.map(p => new Date(p.createdAt).toLocaleDateString())).size;
  const highestEarnedDaysTier = [...DAYS_TIERS].sort((a, b) => b.days - a.days).find(t => _fbtUniqueDays >= t.days) ?? null;
  const featuredBadgeIds = [
    ...(showTempTier && highestEarnedTempTier ? [highestEarnedTempTier.id] : []),
    ...(showDaysBadge && highestEarnedDaysTier ? [highestEarnedDaysTier.id] : []),
    ...featuredStateIds,
  ];

  const navTo = (s: Screen) => {
    const next = screen === s ? "timer" : s;
    // Stop any active HR scan when leaving devices screen
    if (screen === "devices" && next !== "devices" && hrScanActive) {
      BleClient.stopLEScan().catch(() => {});
      setHrScanActive(false);
      setHrScanDevices([]);
    }
    setScreen(next);
    localStorage.setItem("defaultScreen", next);
  };

  const handleForgotPassword = async () => {
    if (!authEmail) return;
    await apiRequest("POST", "/api/auth/forgot-password", { email: authEmail });
    setForgotSent(true);
  };

  const LAST_SYNC_KEY = "coldstreak-last-sync";

  const backgroundSync = useCallback(async () => {
    const ok = await auth.syncLocalData(getClientId());
    if (ok) {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      queryClient.invalidateQueries({ queryKey: ["/api/plunges"] });
    }
  }, [auth]);

  const syncBadgeProfile = useCallback(async () => {
    if (!username) return;
    const uniqueDays = new Set(plunges.map((p) => new Date(p.createdAt).toLocaleDateString())).size;
    const coldestTemp = plunges.length > 0 ? Math.min(...plunges.map((p) => p.temperature)) : null;
    const ordT = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
    const rnT = new Set<string>();
    let cas = false;
    for (const t of ordT) {
      if (!cas) cas = plunges.some(p => p.temperature >= t.minTemp && p.temperature <= t.maxTemp);
      if (cas) rnT.add(t.id);
    }
    const htT = ordT.find(t => rnT.has(t.id)) ?? null;
    const htD = [...DAYS_TIERS].sort((a, b) => b.days - a.days).find(t => uniqueDays >= t.days) ?? null;
    const syncFeatured = [
      ...(showTempTier && htT ? [htT.id] : []),
      ...(showDaysBadge && htD ? [htD.id] : []),
      ...featuredStateIds,
    ];
    try {
      await apiRequest("POST", "/api/badge-profile", {
        username,
        featuredBadges: syncFeatured,
        plungeCount: plunges.length,
        uniqueDays,
        coldestTemp,
        foundingPlunger: isFoundingPlunger,
      });
    } catch {}
  }, [username, plunges, showTempTier, showDaysBadge, featuredStateIds, isFoundingPlunger]);

  useEffect(() => {
    syncBadgeProfile();
  }, [showTempTier, showDaysBadge, featuredStateIds, plunges.length, username, isFoundingPlunger]);

  // Daily sync on app open
  useEffect(() => {
    if (!auth.user) return;
    const last = Number(localStorage.getItem(LAST_SYNC_KEY) || "0");
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - last > oneDayMs) {
      backgroundSync();
    }
  }, [auth.user]);

  // Pre-load logo once so it's ready for instant compositing at share time
  useEffect(() => {
    loadImage("/icons/icon-192.png").then((img) => { preloadedLogoRef.current = img; }).catch(() => {});
  }, []);

  // Pre-load photo the instant it's captured so share handler has zero async work
  useEffect(() => {
    if (!promptPhotoData) { preloadedPhotoRef.current = null; return; }
    loadImage(promptPhotoData).then((img) => { preloadedPhotoRef.current = img; }).catch(() => {});
  }, [promptPhotoData]);

  // Restore profile settings (displayName, bodyWeight) from server on login
  // If server has no value yet, push local values up so they're saved
  useEffect(() => {
    if (!auth.user) return;
    const token = localStorage.getItem("coldstreak-auth-token");
    if (!token) return;
    fetch("/api/auth/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const localName = localStorage.getItem("coldstreak-username") || "";
        const localWeight = Number(localStorage.getItem("coldstreak-body-weight")) || 0;
        const patch: { displayName?: string; bodyWeight?: number } = {};

        if (data.displayName) {
          setUsername(data.displayName);
          localStorage.setItem("coldstreak-username", data.displayName);
        } else if (localName) {
          patch.displayName = localName;
        }

        if (data.bodyWeight && data.bodyWeight > 0) {
          setBodyWeightLbs(data.bodyWeight);
          localStorage.setItem("coldstreak-body-weight", String(data.bodyWeight));
        } else if (localWeight > 0) {
          patch.bodyWeight = localWeight;
        }

        if (Object.keys(patch).length > 0) {
          fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(patch) }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [auth.user]);

  // Subscribe to push notifications when permission is already granted
  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;
    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || ""),
          });
        }
        const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
        pushEndpointRef.current = json.endpoint;
        fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, clientId: getClientId() }),
        }).catch(() => {});
      } catch {}
    });
  }, [notifPermission]);

  const handleAuthSubmit = async () => {
    const email = authEmail;
    const ok = authMode === "login"
      ? await auth.login(email, authPassword)
      : await auth.register(email, authPassword);
    if (ok) {
      setAuthEmail("");
      setAuthPassword("");
      // Auto-restore Pro on login: checks server record first, then local promo
      verifyProForEmail(email);
      // Auto-sync local plunges immediately on login/register
      backgroundSync();
    }
  };

  const handleSync = async () => {
    const ok = await auth.syncLocalData(getClientId());
    if (ok) {
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      setSyncDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/plunges"] });
    }
  };

  const handleLogout = () => {
    auth.logout();
    clearPro();
    setShowPostSessionAd(false);
    setSyncDone(false);
    localStorage.removeItem("coldstreak-username");
    localStorage.removeItem("coldstreak-body-weight");
    setUsername("");
    setBodyWeightLbs(154);
    queryClient.removeQueries({ queryKey: ["/api/plunges"] });
  };

  const exportCSV = () => {
    const headers = ["Date", "Time", "Duration", "Duration (sec)", "Temp (°F)", "Temp (°C)", "Cold Score", "Calories (kcal est.)", "Location"];
    const rows = plunges.map((p) => {
      const d = new Date(p.createdAt);
      const calories = p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs));
      const tempC = Math.round(((p.temperature - 32) * 5) / 9 * 10) / 10;
      const mins = Math.floor(p.duration / 60);
      const secs = p.duration % 60;
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        `${mins}m ${secs}s`,
        p.duration,
        p.temperature,
        tempC,
        Number(p.score).toFixed(1),
        calories,
        p.locationName || "",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coldstreak-plunges-${new Date().toISOString().slice(0, 10)}.csv`;
    // Must be in DOM for Android tablets / WebView to trigger the download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Analytics.track("csv_exported", { plunge_count: plunges.length });
  };

  // ── Bluetooth Thermometer ────────────────────────────────────────────────
  function parseBtTemperature(value: DataView): number | null {
    try {
      const flags = value.getUint8(0);
      const isFahrenheit = (flags & 0x01) !== 0;
      // IEEE-11073 32-bit FLOAT: bytes 1-3 = 24-bit signed mantissa (LE), byte 4 = signed exponent
      const mantissaRaw = value.getUint8(1) | (value.getUint8(2) << 8) | (value.getUint8(3) << 16);
      const mantissa = mantissaRaw & 0x800000 ? mantissaRaw - 0x1000000 : mantissaRaw;
      const exponent = value.getInt8(4);
      const tempValue = mantissa * Math.pow(10, exponent);
      return isFahrenheit ? tempValue : (tempValue * 9 / 5) + 32;
    } catch {
      return null;
    }
  }

  // Standard Bluetooth Health Thermometer (full 128-bit UUIDs required by BleClient)
  const HEALTH_THERM_SERVICE = "00001809-0000-1000-8000-00805f9b34fb";
  const HEALTH_THERM_CHAR    = "00002a1c-0000-1000-8000-00805f9b34fb";

  // Govee INTELLI_ROCKS GATT service & characteristic UUIDs
  const GOVEE_SERVICE    = "494e5445-4c4c-495f-524f-434b535f4857";
  const GOVEE_CHAR_PROTO = "494e5445-4c4c-495f-524f-434b535f2011";
  const GOVEE_CHAR_DATA  = "494e5445-4c4c-495f-524f-434b535f2013";

  // ThermoPro TP25 GATT service & characteristic UUIDs (reverse-engineered)
  const TP25_SERVICE    = "1086fff0-3343-4817-8bb2-b32206336ce8";
  const TP25_CHAR_WRITE = "1086fff1-3343-4817-8bb2-b32206336ce8";
  const TP25_CHAR_NOTIF = "1086fff2-3343-4817-8bb2-b32206336ce8";

  // Parse a ThermoPro TP25 TLVC notification — returns probe 1 temp in °F
  // Packet structure: [type][len][p1_hi][p1_lo][p2_hi][p2_lo]...[checksum]
  // Probe temps start at byte 2 (skip type + len header bytes)
  // Each probe = big-endian uint16; encoding is tenths of °C (0xFFFF = no probe)
  function parseTp25Temperature(dv: DataView): number | null {
    try {
      const hex = Array.from({ length: dv.byteLength }, (_, i) =>
        dv.getUint8(i).toString(16).padStart(2, "0")).join(" ");
      console.log("[TP25] raw bytes:", hex);
      if (dv.byteLength < 4) return null;

      // Skip TLVC header (bytes 0-1 = type + length); probe data starts at byte 2.
      // Walk aligned 2-byte pairs representing each probe, ignoring the trailing checksum.
      for (let i = 2; i + 1 < dv.byteLength; i += 2) {
        const raw = (dv.getUint8(i) << 8) | dv.getUint8(i + 1);
        if (raw === 0xFFFF || raw === 0x0000) continue; // no probe / disconnected

        // Attempt A: encoded as tenths of °C (standard for most meat thermometers)
        const tempC_a = raw / 10;
        const tempF_a = (tempC_a * 9) / 5 + 32;
        if (tempF_a >= 25 && tempF_a <= 110) return tempF_a;

        // Attempt B: encoded as tenths of °F (some TP25 firmware variants)
        const tempF_b = raw / 10;
        if (tempF_b >= 25 && tempF_b <= 110) return tempF_b;
      }
      return null;
    } catch { return null; }
  }

  function parseGoveeTemperature(dv: DataView): number | null {
    try {
      // Govee encodes temp+humidity as a 3-byte big-endian integer
      // e.g. bytes [03, 21, 5D] → 0x03215D = 205149 → temp = 20.51°C, humi = 49%
      if (dv.byteLength < 3) return null;
      const raw = (dv.getUint8(0) << 16) | (dv.getUint8(1) << 8) | dv.getUint8(2);
      const tempC = (raw / 1000) / 10; // first 3 digits / 10 = °C
      return (tempC * 9 / 5) + 32; // convert to °F
    } catch { return null; }
  }

  // ─── BLE availability helper ─────────────────────────────────────────────
  // True only when BLE will actually work:
  //   • Native Android/iOS with the BluetoothLe plugin properly synced, OR
  //   • Desktop Chrome (Web Bluetooth API present)
  // Notably false when: native app built without `npx cap sync android`, or
  // any mobile browser (Android Chrome / iOS Safari).
  const blePluginNative = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BluetoothLe");
  const bleAvailable = blePluginNative ||
    (!Capacitor.isNativePlatform() && typeof navigator !== "undefined" && !!(navigator as any).bluetooth);

  function assertBleAvailable(): boolean {
    if (bleAvailable) return true;
    if (Capacitor.isNativePlatform()) {
      // Native shell but plugin wasn't synced into this build
      toast({
        title: "Rebuild required",
        description: "Run `npx cap sync android` then rebuild and reinstall the APK to enable Bluetooth.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bluetooth unavailable",
        description: "Bluetooth sensors require the ColdStreak Android or iOS app. They are not supported in the mobile browser.",
        variant: "destructive",
      });
    }
    return false;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Auto-reconnect on app open ──────────────────────────────────────────
  useEffect(() => {
    // Skip silently if BLE can't work (mobile web browser)
    if (!bleAvailable) return;

    let cancelled = false;

    async function attemptReconnect(
      key: string,
      connectFn: (deviceId: string, name: string) => Promise<void>
    ) {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const { deviceId, name } = JSON.parse(raw) as { deviceId: string; name: string };
        await connectFn(deviceId, name);
      } catch { /* device not in range or bluetooth off — fail silently */ }
    }

    async function reconnectThermo(deviceId: string, name: string) {
      if (cancelled) return;
      setBtConnecting(true);
      try {
        await BleClient.initialize();
        btDeviceRef.current = deviceId;
        setBtDeviceName(name);
        await BleClient.connect(deviceId, () => {
          if (btKeepaliveRef.current) { clearInterval(btKeepaliveRef.current); btKeepaliveRef.current = null; }
          setBtConnected(false);
          if (btDeviceRef.current) {
            if (thermoReconnectTimerRef.current) clearTimeout(thermoReconnectTimerRef.current);
            thermoReconnectTimerRef.current = setTimeout(autoReconnectThermo, 2500);
          }
        });
        // Mirror the same 3-attempt order as manual connectThermometer
        let started = false;
        let protocol: "gatt" | "govee" | "tp25" | null = null;

        // Attempt 1: Standard GATT health_thermometer
        if (!started) {
          try {
            await BleClient.startNotifications(deviceId, HEALTH_THERM_SERVICE, HEALTH_THERM_CHAR, (dv) => {
              const tempF = parseBtTemperature(dv);
              if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
            });
            protocol = "gatt"; started = true;
          } catch { /* not this profile */ }
        }

        // Attempt 2: Govee INTELLI_ROCKS
        if (!started) {
          try {
            await BleClient.startNotifications(deviceId, GOVEE_SERVICE, GOVEE_CHAR_DATA, (dv) => {
              const tempF = parseGoveeTemperature(dv) ?? parseBtTemperature(dv);
              if (tempF !== null && tempF > 25 && tempF < 120)
                setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
            });
            try {
              await BleClient.writeWithoutResponse(deviceId, GOVEE_SERVICE, GOVEE_CHAR_PROTO,
                new DataView(new Uint8Array([0xAA, 0x01]).buffer));
            } catch { /* ignore */ }
            protocol = "govee"; started = true;
          } catch { /* not Govee */ }
        }

        // Attempt 3: ThermoPro TP25
        if (!started) {
          try {
            await BleClient.startNotifications(deviceId, TP25_SERVICE, TP25_CHAR_NOTIF, (dv) => {
              const tempF = parseTp25Temperature(dv);
              if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
            });
            try {
              await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE,
                new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer));
            } catch { /* some firmware versions don't need this */ }
            protocol = "tp25"; started = true;
          } catch { /* not TP25 */ }
        }

        if (!cancelled) {
          if (started && protocol) {
            startThermoKeepalive(deviceId, protocol);
            setBtConnected(true);
            toast({ title: "Thermometer reconnected", description: name });
          } else {
            // Connected at BLE level but no temp profile matched — disconnect cleanly
            await BleClient.disconnect(deviceId).catch(() => {});
            btDeviceRef.current = null;
          }
        }
      } catch (err: any) {
        btDeviceRef.current = null;
        if ((err?.message ?? "").toLowerCase().includes("not implemented")) {
          localStorage.removeItem("coldstreak-bt-thermo"); // plugin not in this build, stop retrying
        }
      } finally {
        if (!cancelled) setBtConnecting(false);
      }
    }

    async function reconnectHR(deviceId: string, name: string) {
      if (cancelled) return;
      // MAC address format (manually entered) → needs scan-first approach
      const isMac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(deviceId);
      if (isMac) {
        // connectManualHR is hoisted — scans first to cache device, then connects
        await connectManualHR(deviceId, name);
        return;
      }
      setHrConnecting(true);
      try {
        await BleClient.initialize();
        hrDeviceIdRef.current = deviceId;
        setHrDeviceName(name);
        await BleClient.connect(deviceId, () => {
          setHrConnected(false);
          setCurrentHR(null);
          toast({ title: "Heart rate monitor disconnected", description: name });
        });
        await BleClient.startNotifications(deviceId, HR_SERVICE, HR_CHAR, (dv) => {
          const bpm = parseHeartRate(dv);
          if (bpm !== null) {
            setCurrentHR(bpm);
            setHrPeak(prev => prev === null ? bpm : Math.max(prev, bpm));
            hrReadingsRef.current.push(bpm);
          }
        });
        if (!cancelled) {
          setHrConnected(true);
          toast({ title: "Heart rate monitor reconnected", description: name });
        }
      } catch (err: any) {
        hrDeviceIdRef.current = null;
        if ((err?.message ?? "").toLowerCase().includes("not implemented")) {
          localStorage.removeItem("coldstreak-bt-hr"); // plugin not in this build, stop retrying
        }
      } finally {
        if (!cancelled) setHrConnecting(false);
      }
    }

    // Small delay so app fully renders before trying BLE
    const timer = setTimeout(() => {
      attemptReconnect("coldstreak-bt-thermo", reconnectThermo);
      attemptReconnect("coldstreak-bt-hr", reconnectHR);
    }, 1500);

    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  // Helper: start keep-alive pings so the thermometer doesn't time out
  function startThermoKeepalive(deviceId: string, protocol: "gatt" | "govee" | "tp25") {
    if (btKeepaliveRef.current) clearInterval(btKeepaliveRef.current);
    if (protocol === "tp25") {
      btKeepaliveRef.current = setInterval(() => {
        BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE,
          new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer)).catch(() => {});
      }, 10_000);
    } else if (protocol === "govee") {
      btKeepaliveRef.current = setInterval(() => {
        BleClient.writeWithoutResponse(deviceId, GOVEE_SERVICE, GOVEE_CHAR_PROTO,
          new DataView(new Uint8Array([0xAA, 0x01]).buffer)).catch(() => {});
      }, 10_000);
    }
    // GATT health thermometer is indication-based, no keep-alive needed
  }

  // ─── Thermometer auto-reconnect ──────────────────────────────────────────────
  async function autoReconnectThermo() {
    const deviceId = btDeviceRef.current;
    if (!deviceId) return; // user deliberately disconnected — do nothing
    if (thermoReconnectCountRef.current >= 3) {
      thermoReconnectCountRef.current = 0;
      btDeviceRef.current = null; // stop further auto-retry
      setBtThermoTimedOut(true);  // show quiet note in Devices tab instead of a banner
      return;
    }
    thermoReconnectCountRef.current++;
    const protocol = btProtocolRef.current;

    const scheduleRetry = () => {
      if (!btDeviceRef.current) return; // disconnected manually in the meantime
      if (thermoReconnectTimerRef.current) clearTimeout(thermoReconnectTimerRef.current);
      thermoReconnectTimerRef.current = setTimeout(autoReconnectThermo, 2500);
    };

    try {
      await BleClient.connect(deviceId, () => {
        if (btKeepaliveRef.current) { clearInterval(btKeepaliveRef.current); btKeepaliveRef.current = null; }
        setBtConnected(false);
        scheduleRetry();
      });

      let reconnected = false;

      if (protocol === "gatt" && !reconnected) {
        try {
          await BleClient.startNotifications(deviceId, HEALTH_THERM_SERVICE, HEALTH_THERM_CHAR, (dv) => {
            const tempF = parseBtTemperature(dv);
            if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          reconnected = true;
        } catch { /* not this profile */ }
      }
      if (protocol === "govee" && !reconnected) {
        try {
          await BleClient.startNotifications(deviceId, GOVEE_SERVICE, GOVEE_CHAR_DATA, (dv) => {
            const tempF = parseGoveeTemperature(dv) ?? parseBtTemperature(dv);
            if (tempF !== null && tempF > 25 && tempF < 120)
              setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          try { await BleClient.writeWithoutResponse(deviceId, GOVEE_SERVICE, GOVEE_CHAR_PROTO, new DataView(new Uint8Array([0xAA, 0x01]).buffer)); } catch { /* ignore */ }
          reconnected = true;
        } catch { /* not Govee */ }
      }
      if (protocol === "tp25" && !reconnected) {
        try {
          await BleClient.startNotifications(deviceId, TP25_SERVICE, TP25_CHAR_NOTIF, (dv) => {
            const tempF = parseTp25Temperature(dv);
            if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          try { await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE, new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer)); } catch { /* ignore */ }
          reconnected = true;
        } catch { /* not TP25 */ }
      }

      if (reconnected) {
        startThermoKeepalive(deviceId, btProtocolRef.current!);
        setBtConnected(true);
        thermoReconnectCountRef.current = 0;
      } else {
        scheduleRetry();
      }
    } catch {
      scheduleRetry();
    }
  }

  // ─── HR custom scanner ──────────────────────────────────────────────────────
  const HR_WATCH_REGEX = /amazfit|polar|garmin|apple watch|galaxy watch|mi band|huawei band|fitbit|whoop|coros|suunto|bangle|wahoo|stryd|fenix|vivoactive|forerunner|instinct/i;

  async function startHrScan() {
    if (!assertBleAvailable()) return;
    try {
      setHrScanDevices([]);
      setHrScanDone(false);
      setHrScanActive(true);
      await BleClient.initialize();
      await BleClient.requestLEScan({}, (result) => {
        const name = result.device.name ?? "";
        if (!name) return; // skip completely unnamed devices — they can't be identified
        const rssi = result.rssi ?? -99;
        setHrScanDevices(prev => {
          const idx = prev.findIndex(d => d.deviceId === result.device.deviceId);
          if (idx >= 0) {
            // Update RSSI live
            const updated = [...prev];
            updated[idx] = { ...updated[idx], rssi };
            return updated;
          }
          return [...prev, { deviceId: result.device.deviceId, name, rssi }];
        });
      });
      // Auto-stop after 15 s
      setTimeout(() => {
        BleClient.stopLEScan().catch(() => {});
        setHrScanActive(false);
        setHrScanDone(true);
      }, 15_000);
    } catch (err: any) {
      setHrScanActive(false);
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("not implemented")) {
        toast({ title: "Rebuild required", description: "Run `npx cap sync android` and reinstall.", variant: "destructive" });
      } else if (!msg.includes("cancelled")) {
        toast({ title: "Scan failed", description: msg || "Could not scan for devices.", variant: "destructive" });
      }
    }
  }

  async function stopHrScan() {
    await BleClient.stopLEScan().catch(() => {});
    setHrScanActive(false);
    setHrScanDone(true);
    // keep hrScanDevices so the list stays visible after stopping
  }

  async function connectFromHrScan(deviceId: string, name: string) {
    await BleClient.stopLEScan().catch(() => {});
    setHrScanActive(false);
    setHrScanDevices([]);
    setHrConnecting(true);
    // Hint the user early — some watches show a pairing confirmation dialog
    toast({ title: "Connecting…", description: "Check your watch for a pairing confirmation." });
    try {
      hrDeviceIdRef.current = deviceId;
      setHrDeviceName(name);
      localStorage.setItem("coldstreak-bt-hr", JSON.stringify({ deviceId, name }));
      await BleClient.connect(deviceId, () => {
        setHrConnected(false);
        setCurrentHR(null);
        toast({ title: "Heart rate monitor disconnected", description: name });
      }, { timeout: 30000 });
      // Short pause — lets the watch enumerate GATT services before we subscribe
      await new Promise(r => setTimeout(r, 750));
      await BleClient.startNotifications(deviceId, HR_SERVICE, HR_CHAR, (dv) => {
        const bpm = parseHeartRate(dv);
        if (bpm !== null) {
          setCurrentHR(bpm);
          setHrPeak(prev => prev === null ? bpm : Math.max(prev, bpm));
          hrReadingsRef.current.push(bpm);
        }
      });
      setHrConnected(true);
      toast({ title: "Heart rate monitor connected", description: `${name} — live BPM active.` });
    } catch (err: any) {
      hrDeviceIdRef.current = null;
      await BleClient.disconnect(deviceId).catch(() => {});
      const msg = (err?.message ?? "").toLowerCase();
      if (!msg.includes("cancelled")) {
        const isTimeout = msg.includes("timeout") || msg.includes("timed out");
        toast({
          title: isTimeout ? "Connection timed out" : "Connection failed",
          description: isTimeout
            ? "The watch didn't respond in time. Accept the pairing request on your watch, then try again."
            : err?.message || "Could not connect.",
          variant: "destructive",
        });
      }
    } finally {
      setHrConnecting(false);
    }
  }

  // Connect to a manually-entered MAC address:
  // must scan first so the Android BLE stack caches the device, then connect.
  async function connectManualHR(addr: string, name: string) {
    if (!assertBleAvailable()) return;
    setHrConnecting(true);
    let scanStopped = false;
    try {
      await BleClient.initialize();
      let found = false;

      // Scan broadly — wait until we see the target device (up to 12 s)
      await BleClient.requestLEScan({}, (result) => {
        if (result.device.deviceId.toUpperCase() === addr.toUpperCase()) {
          found = true;
        }
      });

      await new Promise<void>((resolve) => {
        const deadline = setTimeout(() => resolve(), 12_000);
        const poll = setInterval(() => {
          if (found) { clearTimeout(deadline); clearInterval(poll); resolve(); }
        }, 250);
      });

      await BleClient.stopLEScan().catch(() => {});
      scanStopped = true;

      if (!found) {
        throw new Error("Watch not found nearby. Make sure Bluetooth is on and the watch is in range, then try again.");
      }

      // Device is now in the BLE cache — proceed with connection
      hrDeviceIdRef.current = addr;
      setHrDeviceName(name);
      localStorage.setItem("coldstreak-bt-hr", JSON.stringify({ deviceId: addr, name }));

      await BleClient.connect(addr, () => {
        setHrConnected(false);
        setCurrentHR(null);
        toast({ title: "Heart rate monitor disconnected", description: name });
      }, { timeout: 30000 });

      // Short pause — lets the watch enumerate GATT services before we subscribe
      await new Promise(r => setTimeout(r, 750));

      await BleClient.startNotifications(addr, HR_SERVICE, HR_CHAR, (dv) => {
        const bpm = parseHeartRate(dv);
        if (bpm !== null) {
          setCurrentHR(bpm);
          setHrPeak(prev => prev === null ? bpm : Math.max(prev, bpm));
          hrReadingsRef.current.push(bpm);
        }
      });

      setHrConnected(true);
      toast({ title: "Heart rate monitor connected", description: `${name} — live BPM active.` });
    } catch (err: any) {
      if (!scanStopped) await BleClient.stopLEScan().catch(() => {});
      hrDeviceIdRef.current = null;
      await BleClient.disconnect(addr).catch(() => {});
      const msg = (err?.message ?? "").toLowerCase();
      if (!msg.includes("cancelled")) {
        const isTimeout = msg.includes("timeout") || msg.includes("timed out");
        toast({
          title: isTimeout ? "Connection timed out" : "Connection failed",
          description: isTimeout
            ? "The watch didn't respond in time. Accept the pairing request on your watch, then try again."
            : err?.message || "Could not connect.",
          variant: "destructive",
        });
      }
    } finally {
      setHrConnecting(false);
    }
  }

  const connectThermometer = async () => {
    if (!assertBleAvailable()) return;
    try {
      setBtConnecting(true);
      setBtThermoTimedOut(false);
      await BleClient.initialize();

      // Show all nearby BLE devices — user picks their thermometer
      const device = await BleClient.requestDevice({
        optionalServices: [TP25_SERVICE, HEALTH_THERM_SERVICE, GOVEE_SERVICE],
      });

      const deviceId = device.deviceId;
      btDeviceRef.current = deviceId;
      setBtDeviceName(device.name ?? "Thermometer");
      localStorage.setItem("coldstreak-bt-thermo", JSON.stringify({ deviceId: device.deviceId, name: device.name ?? "Thermometer" }));

      await BleClient.connect(deviceId, () => {
        if (btKeepaliveRef.current) { clearInterval(btKeepaliveRef.current); btKeepaliveRef.current = null; }
        setBtConnected(false);
        if (btDeviceRef.current) {
          if (thermoReconnectTimerRef.current) clearTimeout(thermoReconnectTimerRef.current);
          thermoReconnectTimerRef.current = setTimeout(autoReconnectThermo, 2500);
        }
      });

      let connected = false;

      // ── Attempt 1: standard health_thermometer GATT ──────────────────────
      try {
        await BleClient.startNotifications(deviceId, HEALTH_THERM_SERVICE, HEALTH_THERM_CHAR, (dv) => {
          const tempF = parseBtTemperature(dv);
          if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
        });
        btProtocolRef.current = "gatt";
        connected = true;
      } catch { /* device doesn't use standard profile */ }

      // ── Attempt 2: Govee INTELLI_ROCKS ───────────────────────────────────
      if (!connected) {
        try {
          await BleClient.startNotifications(deviceId, GOVEE_SERVICE, GOVEE_CHAR_DATA, (dv) => {
            const tempF = parseGoveeTemperature(dv) ?? parseBtTemperature(dv);
            if (tempF !== null && tempF > 25 && tempF < 120) {
              setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
            }
          });
          try {
            await BleClient.writeWithoutResponse(deviceId, GOVEE_SERVICE, GOVEE_CHAR_PROTO,
              new DataView(new Uint8Array([0xAA, 0x01]).buffer));
          } catch { /* ignore */ }
          btProtocolRef.current = "govee";
          connected = true;
        } catch { /* device doesn't expose Govee service */ }
      }

      // ── Attempt 3: ThermoPro TP25 ─────────────────────────────────────────
      if (!connected) {
        try {
          await BleClient.startNotifications(deviceId, TP25_SERVICE, TP25_CHAR_NOTIF, (dv) => {
            const tempF = parseTp25Temperature(dv);
            if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          try {
            await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE,
              new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer));
          } catch { /* some firmware versions don't need this */ }
          btProtocolRef.current = "tp25";
          connected = true;
        } catch { /* device doesn't expose TP25 service */ }
      }

      if (connected) {
        startThermoKeepalive(deviceId, btProtocolRef.current!);
        setBtConnected(true);
        toast({ title: "Thermometer connected", description: `${device.name ?? "Device"} — temperature will update automatically.` });
      } else {
        await BleClient.disconnect(deviceId).catch(() => {});
        btDeviceRef.current = null;
        toast({ title: "Device connected — protocol unknown", description: "Could not read temperature from this device.", variant: "destructive" });
      }
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("not implemented")) {
        // Native plugin missing from this APK build — needs cap sync + rebuild
        toast({
          title: "App update required",
          description: "Bluetooth isn't available in this build. Please rebuild the app with `npx cap sync android` and reinstall.",
          variant: "destructive",
        });
        localStorage.removeItem("coldstreak-bt-thermo"); // don't keep retrying
      } else if (!msg.includes("cancelled") && !msg.includes("User cancelled") && err?.name !== "NotFoundError") {
        toast({ title: "Connection failed", description: msg || "Could not connect to thermometer.", variant: "destructive" });
      }
    } finally {
      setBtConnecting(false);
    }
  };

  // Reconnect to a previously paired thermometer from the UI (without picker)
  async function reconnectThermoFromUI(deviceId: string, name: string) {
    if (!assertBleAvailable()) return;
    setBtConnecting(true);
    setBtThermoTimedOut(false);
    thermoReconnectCountRef.current = 0;
    try {
      await BleClient.initialize();
      btDeviceRef.current = deviceId;
      setBtDeviceName(name);
      await BleClient.connect(deviceId, () => {
        if (btKeepaliveRef.current) { clearInterval(btKeepaliveRef.current); btKeepaliveRef.current = null; }
        setBtConnected(false);
        if (btDeviceRef.current) {
          if (thermoReconnectTimerRef.current) clearTimeout(thermoReconnectTimerRef.current);
          thermoReconnectTimerRef.current = setTimeout(autoReconnectThermo, 2500);
        }
      });
      let connected = false;
      let protocol: "gatt" | "govee" | "tp25" | null = null;
      if (!connected) {
        try {
          await BleClient.startNotifications(deviceId, HEALTH_THERM_SERVICE, HEALTH_THERM_CHAR, (dv) => {
            const tempF = parseBtTemperature(dv);
            if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          protocol = "gatt"; connected = true;
        } catch { /* not GATT */ }
      }
      if (!connected) {
        try {
          await BleClient.startNotifications(deviceId, GOVEE_SERVICE, GOVEE_CHAR_DATA, (dv) => {
            const tempF = parseGoveeTemperature(dv) ?? parseBtTemperature(dv);
            if (tempF !== null && tempF > 25 && tempF < 120)
              setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          try { await BleClient.writeWithoutResponse(deviceId, GOVEE_SERVICE, GOVEE_CHAR_PROTO, new DataView(new Uint8Array([0xAA, 0x01]).buffer)); } catch { /* ignore */ }
          protocol = "govee"; connected = true;
        } catch { /* not Govee */ }
      }
      if (!connected) {
        try {
          await BleClient.startNotifications(deviceId, TP25_SERVICE, TP25_CHAR_NOTIF, (dv) => {
            const tempF = parseTp25Temperature(dv);
            if (tempF !== null) setTemperature(Math.min(60, Math.max(25, Math.round(tempF + btTempOffsetRef.current))));
          });
          try { await BleClient.writeWithoutResponse(deviceId, TP25_SERVICE, TP25_CHAR_WRITE, new DataView(new Uint8Array([0x21, 0x03, 0x01, 0x25]).buffer)); } catch { /* ignore */ }
          protocol = "tp25"; connected = true;
        } catch { /* not TP25 */ }
      }
      if (connected) {
        btProtocolRef.current = protocol;
        startThermoKeepalive(deviceId, protocol!);
        setBtConnected(true);
        toast({ title: "Thermometer reconnected", description: `${name} — temperature will update automatically.` });
      } else {
        btDeviceRef.current = null;
        toast({ title: "Could not reconnect", description: "Device in range but could not start notifications.", variant: "destructive" });
      }
    } catch (err: any) {
      btDeviceRef.current = null;
      const msg = err?.message ?? "";
      if (!msg.includes("cancelled")) {
        toast({ title: "Reconnect failed", description: msg || "Could not connect to thermometer.", variant: "destructive" });
      }
    } finally {
      setBtConnecting(false);
    }
  }

  const disconnectThermometer = async () => {
    // Capture before clearing so we can still call BleClient.disconnect
    const deviceId = btDeviceRef.current;
    // Clear everything BEFORE disconnecting so the disconnect callback
    // sees btDeviceRef.current = null and won't schedule a reconnect
    if (btKeepaliveRef.current) { clearInterval(btKeepaliveRef.current); btKeepaliveRef.current = null; }
    if (thermoReconnectTimerRef.current) { clearTimeout(thermoReconnectTimerRef.current); thermoReconnectTimerRef.current = null; }
    thermoReconnectCountRef.current = 0;
    btDeviceRef.current = null;
    btProtocolRef.current = null;
    setBtConnected(false);
    setBtDeviceName("");
    try {
      if (deviceId) await BleClient.disconnect(deviceId);
    } catch { /* ignore */ }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Heart Rate Monitor (standard BLE Heart Rate Profile — 0x180D / 0x2A37)
  // ─────────────────────────────────────────────────────────────────────────
  const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
  const HR_CHAR    = "00002a37-0000-1000-8000-00805f9b34fb";

  function parseHeartRate(dv: DataView): number | null {
    try {
      const flags = dv.getUint8(0);
      const is16bit = (flags & 0x01) !== 0;
      const bpm = is16bit ? dv.getUint16(1, true) : dv.getUint8(1);
      return bpm > 20 && bpm < 250 ? bpm : null;
    } catch { return null; }
  }

  const connectHR = async () => {
    if (!assertBleAvailable()) return;
    try {
      setHrConnecting(true);
      await BleClient.initialize();
      // Use optionalServices so ALL nearby BLE devices appear in the picker —
      // many smartwatches (Amazfit, Garmin, etc.) don't advertise the HR UUID
      // in their scan packet unless you filter by device name, so a service
      // filter would hide them entirely.
      const device = await BleClient.requestDevice({
        optionalServices: [HR_SERVICE],
      });
      const deviceId = device.deviceId;
      hrDeviceIdRef.current = deviceId;
      setHrDeviceName(device.name ?? "Heart Rate Monitor");
      localStorage.setItem("coldstreak-bt-hr", JSON.stringify({ deviceId: device.deviceId, name: device.name ?? "Heart Rate Monitor" }));

      await BleClient.connect(deviceId, () => {
        setHrConnected(false);
        setCurrentHR(null);
        toast({ title: "Heart rate monitor disconnected", description: device.name ?? "Device lost connection." });
      });

      await BleClient.startNotifications(deviceId, HR_SERVICE, HR_CHAR, (dv) => {
        const bpm = parseHeartRate(dv);
        if (bpm !== null) {
          setCurrentHR(bpm);
          setHrPeak(prev => prev === null ? bpm : Math.max(prev, bpm));
          hrReadingsRef.current.push(bpm);
        }
      });

      setHrConnected(true);
      toast({ title: "Heart rate monitor connected", description: `${device.name ?? "Device"} — live BPM active.` });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.toLowerCase().includes("not implemented")) {
        toast({
          title: "App update required",
          description: "Bluetooth isn't available in this build. Please rebuild the app with `npx cap sync android` and reinstall.",
          variant: "destructive",
        });
        localStorage.removeItem("coldstreak-bt-hr"); // don't keep retrying
      } else if (!msg.includes("cancelled") && !msg.includes("User cancelled") && err?.name !== "NotFoundError") {
        toast({ title: "Connection failed", description: msg || "Could not connect to heart rate monitor.", variant: "destructive" });
      }
    } finally {
      setHrConnecting(false);
    }
  };

  const disconnectHR = async () => {
    try {
      if (hrDeviceIdRef.current) await BleClient.disconnect(hrDeviceIdRef.current);
    } catch { /* ignore */ }
    setHrConnected(false);
    setHrDeviceName("");
    setCurrentHR(null);
    hrDeviceIdRef.current = null;
  };
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    const weightAtLogTime = Number(localStorage.getItem("coldstreak-body-weight") || 150);
    const caloriesAtLogTime = Math.round(estimateCalories(durationSec, temperature, weightAtLogTime));
    createPlunge.mutate(
      {
        duration: durationSec, temperature, score: String(score), timerUsed: true, calories: caloriesAtLogTime,
        hrAvg: hrReadingsRef.current.length > 0
          ? Math.round(hrReadingsRef.current.reduce((a, b) => a + b, 0) / hrReadingsRef.current.length)
          : null,
        spo2Avg: null,
      },
      {
        onSuccess: (newPlunge) => {
          Analytics.plungeLogged(durationSec, temperature, score);
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#0ea5e9", "#ffffff", "#38bdf8", "#bae6fd"] });
          toast({ title: "Plunge Logged! ❄️", description: `Score: ${score} — ${formatTime(durationSec)} at ${temperature}°F` });
          promptPlungeRef.current = { score: String(score), duration: durationSec, temperature, timerUsed: true };
          setPhotoPromptId(newPlunge.id);
          setPromptPhotoData(null);
          setPromptLocationId("home");
          setPromptCustomLocation("");
          setGpsLocationName(null);
          setGpsLocationLoading(true);
          setSavePrivateOpen(false);
          setSavePrivateName("");
          const nearbyLocs = communityLocs; // capture current list
          (async () => {
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                const tid = setTimeout(() => reject(new Error("timeout")), 8000);
                navigator.geolocation?.getCurrentPosition(
                  (p) => { clearTimeout(tid); resolve(p); },
                  (e) => { clearTimeout(tid); reject(e); },
                  { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
                );
              });
              const { latitude: lat, longitude: lng } = pos.coords;

              // Haversine distance in metres
              const haversineM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371000;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              };

              // Find nearest community/business location within 800 m
              let nearestId: number | null = null;
              let nearestDist = Infinity;
              for (const loc of nearbyLocs) {
                if (!loc.latitude || !loc.longitude) continue;
                const d = haversineM(lat, lng, Number(loc.latitude), Number(loc.longitude));
                if (d < 800 && d < nearestDist) { nearestDist = d; nearestId = loc.id; }
              }

              if (nearestId !== null) {
                // Auto-select the nearby location
                setPromptLocationId(`community-${nearestId}`);
              } else {
                // Reverse geocode to city, state
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 5000);
                const r = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
                  { headers: { "Accept-Language": "en" }, signal: controller.signal }
                );
                clearTimeout(timer);
                const data = await r.json();
                const addr = data.address ?? {};
                const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? "";
                const state = addr.state ?? addr.county ?? "";
                const name = [city, state].filter(Boolean).join(", ");
                if (name) {
                  setGpsLocationName(name);
                  setPromptLocationId("gps");
                }
              }
            } catch { /* GPS unavailable or denied — keep Home default */ }
            setGpsLocationLoading(false);
          })();
          setPromptSubmitLeaderboard(true);
          setShowPostSessionAd(true);
          backgroundSync();
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, createPlunge, toast, backgroundSync]);

  // Stopwatch
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdownRunning && countdown > 0) interval = setInterval(() => {
      setCountdown((c) => c - 1);
      setCountdownElapsed((e) => e + 1);
    }, 1000);
    if (countdownRunning && countdown === 0) {
      setCountdownRunning(false);
      const targetDuration = minutesInput * 60 + secondsInput;
      doLogPlunge(targetDuration);
      alarmRef.current = playAlarm(alarmUrl, alarmLabel, alarmIsCustom, alarmIsCustom ? CUSTOM_ALARM_DURATION_MS : undefined);
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

  // Landscape detection
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);


  const handleStart = () => {
    Analytics.timerStarted();
    if (countdownMode) {
      const total = minutesInput * 60 + secondsInput;
      if (total <= 0) { toast({ title: "Set a duration first", variant: "destructive" }); return; }
      countdownTotalRef.current = total;
      setCountdownElapsed(0);
      setCountdown(total);
      setCountdownRunning(true);
    } else {
      startTimeRef.current = Date.now();
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
      const elapsed = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : seconds;
      if (isRunning && elapsed > 0) {
        setIsRunning(false);
        doLogPlunge(elapsed);
        setSeconds(0);
        startTimeRef.current = null;
      } else {
        setIsRunning(false);
        startTimeRef.current = null;
      }
    }
  };

  const handleReset = () => {
    if (countdownMode) { resetCountdown(); }
    else { setSeconds(0); setIsRunning(false); startTimeRef.current = null; }
    // Clear HR session readings so avg is fresh for next plunge
    hrReadingsRef.current = [];
    setHrPeak(null);
  };

  const resetCountdown = () => {
    setCountdownRunning(false);
    setCountdown(0);
    setCountdownElapsed(0);
    if (alarmRef.current) { alarmRef.current.stop(); alarmRef.current = null; }
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || ""),
      });
      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      pushEndpointRef.current = json.endpoint;
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, clientId: getClientId() }),
      });
    } catch {}
  };

  // Stats
  const todayString = new Date().toLocaleDateString();
  const todayPlunges = plunges.filter((p) => new Date(p.createdAt).toLocaleDateString() === todayString);
  const todayTotalSec = todayPlunges.reduce((sum, p) => sum + p.duration, 0);
  const todayScore = todayPlunges.reduce((sum, p) => sum + Number(p.score), 0);
  const personalBest = plunges.length > 0 ? Math.max(...plunges.map((p) => Number(p.score))) : 0;
  // Current week = Monday 00:00:00 through Sunday 23:59:59 — resets each Monday
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon, …
    const daysFromMonday = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - daysFromMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const thisWeek = plunges.filter((p) => new Date(p.createdAt) >= weekStart);
  const weeklyMinutes = thisWeek.reduce((sum, p) => sum + p.duration, 0) / 60;
  const weeklyScore = thisWeek.reduce((sum, p) => sum + Number(p.score), 0);
  const todayCalories = todayPlunges.reduce((sum, p) => sum + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs))), 0);
  const weeklyCalories = thisWeek.reduce((sum, p) => sum + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs))), 0);
  const allTimeCalories = plunges.reduce((sum, p) => sum + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs))), 0);
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
  const elapsedSeconds = countdownMode ? countdownElapsed : seconds;
  const displayScore = isActive && displaySeconds > 0 ? plungeScore(elapsedSeconds, temperature) : todayScore;

  const tempDisplay = useCelsius
    ? `${Math.round((temperature - 32) * 5 / 9)}°C`
    : `${temperature}°F`;

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden bg-blue-950">
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
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
              <div className="flex items-start justify-between mb-1">
                <div className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest">Water Temp</div>
                {/* Always rendered to keep header height stable; invisible when not live */}
                <button
                  onClick={() => navTo("devices")}
                  className={`flex flex-col items-end gap-[2px] ${btConnected ? "" : "invisible"}`}
                  data-testid="button-bt-status-header"
                >
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-[9px] font-semibold">Live</span>
                  </div>
                  <span className="text-green-400/60 text-[8px] leading-none truncate max-w-[56px]">{btDeviceName || "Thermometer"}</span>
                </button>
              </div>

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

              {/* Calibration offset — always rendered to keep tile height stable; invisible when no BT thermometer */}
              <div className={`flex items-center gap-1 mt-1 mb-1 ${btOffsetVisible ? "" : "invisible"}`}>
                <span className="text-blue-400/60 text-[9px] uppercase tracking-widest shrink-0">Offset</span>
                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    data-testid="button-tile-offset-down"
                    onClick={() => setBtTempOffset(prev => { const v = Math.max(-10, prev - 1); localStorage.setItem("coldstreak-bt-temp-offset", String(v)); return v; })}
                    className="w-5 h-5 rounded flex items-center justify-center bg-blue-800/60 text-blue-300 text-sm font-bold leading-none hover:bg-blue-700/70 active:scale-95 transition-all"
                  >−</button>
                  <span
                    data-testid="text-tile-offset"
                    className="text-blue-300 text-[10px] font-bold w-8 text-center"
                  >{btTempOffset >= 0 ? "+" : ""}{btTempOffset}°</span>
                  <button
                    data-testid="button-tile-offset-up"
                    onClick={() => setBtTempOffset(prev => { const v = Math.min(10, prev + 1); localStorage.setItem("coldstreak-bt-temp-offset", String(v)); return v; })}
                    className="w-5 h-5 rounded flex items-center justify-center bg-blue-800/60 text-blue-300 text-sm font-bold leading-none hover:bg-blue-700/70 active:scale-95 transition-all"
                  >+</button>
                </div>
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
                  startTimeRef.current = null;
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
            <div className="relative w-full h-full">
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
                className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 hover:border-cyan-500/50 w-full h-full"
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
                    <div
                      title="Estimated thermogenic calorie burn. Varies by individual physiology — not a precise measurement."
                      className="text-orange-400/70 text-[10px] cursor-help"
                    >
                      {scoreView === "kcal" ? "kcal today (est.)" : "kcal/week (est.)"}
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


          {/* Affiliate banner ad — in-content so it never overlaps readouts */}
          {!isPro && !showPostSessionAd && <BannerAd />}

          {/* Weekly goal / score row */}
          <div
            className="text-center text-white/90 text-sm font-semibold tracking-wide"
            data-testid="display-weekly"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
          >
            Weekly: {weeklyMinutes.toFixed(1)} / {weeklyGoalMinutes} min&nbsp;&nbsp;·&nbsp;&nbsp;
            {isActive
              ? <span className="text-cyan-300">Best: {personalBest > 0 ? personalBest.toFixed(1) : "—"}</span>
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
                {plunges.length > 0 && (
                  <button
                    data-testid="button-export-csv"
                    onClick={isPro ? exportCSV : () => setShowUpgradeModal(true)}
                    title={isPro ? "Export plunge history as CSV" : "Pro feature — upgrade to export"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isPro
                        ? "bg-blue-700/50 border-blue-600/50 text-blue-200 hover:bg-blue-600/60"
                        : "bg-blue-900/30 border-blue-700/30 text-blue-500 opacity-70 hover:opacity-90"
                    }`}
                  >
                    {isPro ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                    Export CSV
                  </button>
                )}
                <button
                  data-testid="button-manual-plunge"
                  onClick={() => {
                    setManualDate(new Date().toISOString().slice(0, 10));
                    setManualTime(new Date().toTimeString().slice(0, 5));
                    setManualMins(3);
                    setManualSecs(0);
                    setManualTempF(50);
                    setManualLocSel("home"); setManualLocCustom(""); setManualLocGeo(null);
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
                    <option value="home">🏠 {homeLabel}</option>
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
                              {l.isBusiness ? "🏢" : "📍"} {l.name}{l.city ? `, ${l.city}` : ""}{dist}
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
                        data-testid="button-manual-toggle-business"
                        type="button"
                        onClick={() => setManualNewIsBusiness((v) => !v)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          manualNewIsBusiness
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            : "bg-blue-900/40 border-blue-700/60 text-blue-400"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {manualNewIsBusiness ? "Business / Commercial ✓" : "Mark as a business or commercial location"}
                      </button>
                      {manualNewIsBusiness && (
                        <input
                          data-testid="input-manual-new-website"
                          type="url"
                          placeholder="Website URL (optional)"
                          value={manualNewWebsite}
                          onChange={(e) => setManualNewWebsite(e.target.value)}
                          className="w-full bg-blue-900/60 border border-amber-500/30 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none focus:border-amber-400"
                        />
                      )}
                      <button
                        data-testid="button-manual-create-spot"
                        disabled={!manualNewName.trim() || createCommunitySpot.isPending}
                        onClick={() => createCommunitySpot.mutate({
                          name: manualNewName.trim(),
                          country: manualNewCountry,
                          state: manualNewState.trim() || undefined,
                          city: manualNewCity.trim() || undefined,
                          isBusiness: manualNewIsBusiness || undefined,
                          websiteUrl: manualNewWebsite.trim() || undefined,
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
                    const finalLocId = manualLocSel === "home" ? "home" : manualLocSel.startsWith("community-") ? manualLocSel : undefined;
                    const finalLocName = manualLocSel === "home"
                      ? (homeLabel || "Home")
                      : manualLocSel.startsWith("community-")
                      ? (communityLocs.find((l) => l.id === Number(manualLocSel.replace("community-", "")))?.name)
                      : manualLocSel === "custom" ? (manualLocCustom.trim() || undefined)
                      : undefined;
                    createPlunge.mutate(
                      { duration: durationSec, temperature: manualTempF, score: String(score), hrAvg: null, spo2Avg: null, createdAt: isoDate, locationId: finalLocId, locationName: finalLocName, calories: Math.round(estimateCalories(durationSec, manualTempF, Number(localStorage.getItem("coldstreak-body-weight") || 150))) },
                      {
                        onSuccess: () => {
                          setShowManualEntry(false);
                          setManualLocSel("home"); setManualLocCustom(""); setManualLocGeo(null);
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
                  {visible.map((plunge, idx) => (
                    <Fragment key={plunge.id}>
                      <PlungeCard plunge={plunge} bodyWeightLbs={bodyWeightLbs} username={username} streak={streak} homeLabel={homeLabel} communityLocs={communityLocs} isPro={isPro} />
                      {!isPro && (idx + 1) % 5 === 0 && idx !== visible.length - 1 && (
                        <FeedAd index={Math.floor(idx / 5)} />
                      )}
                    </Fragment>
                  ))}
                  {locked.length > 0 && (
                    <div data-testid="banner-upgrade-history" className="relative">
                      {/* Frosted real locked plunges */}
                      <div className="space-y-3 blur-[3px] opacity-50 pointer-events-none select-none" aria-hidden="true">
                        {locked.slice(0, 2).map((plunge) => {
                          const mins = Math.floor(plunge.durationSeconds / 60);
                          const secs = plunge.durationSeconds % 60;
                          return (
                            <div key={plunge.id} className="bg-blue-900/60 border border-blue-700/40 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold">{new Date(plunge.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                <p className="text-blue-400 text-xs">{plunge.locationName || "Home plunge"}</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-xl px-2.5 py-1.5 text-center">
                                  <p className="text-cyan-300 text-xs font-bold">{plunge.tempF}°F</p>
                                </div>
                                <div className="bg-blue-700/40 border border-blue-600/30 rounded-xl px-2.5 py-1.5 text-center">
                                  <p className="text-blue-200 text-xs font-bold">{mins}:{secs.toString().padStart(2, "0")}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Fade overlay */}
                      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent to-slate-950/0 pointer-events-none" />

                      {/* Lock CTA card */}
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="relative mt-2 w-full bg-gradient-to-br from-slate-900 to-blue-950 border border-cyan-600/50 rounded-2xl p-4 text-left space-y-3 shadow-lg shadow-cyan-900/20 active:scale-[0.99] transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                            <Crown className="w-4.5 h-4.5 text-yellow-400" />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm leading-tight">
                              {locked.length} plunge{locked.length !== 1 ? "s" : ""} locked
                            </p>
                            <p className="text-blue-400 text-[11px]">Upgrade to Pro to see your full history</p>
                          </div>
                          <span className="ml-auto text-yellow-400 font-bold text-sm shrink-0">from $3.99</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { icon: "📅", text: "Unlimited history" },
                            { icon: "📊", text: "Advanced stats" },
                            { icon: "📍", text: "Chill Places" },
                            { icon: "📤", text: "CSV export" },
                          ].map(({ icon, text }) => (
                            <div key={text} className="flex items-center gap-1.5 bg-blue-900/40 rounded-lg px-2 py-1.5">
                              <span className="text-[13px]">{icon}</span>
                              <span className="text-blue-200 text-[11px] font-medium">{text}</span>
                            </div>
                          ))}
                        </div>

                        <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm text-center">
                          Unlock Pro →
                        </div>
                      </button>
                    </div>
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
              <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-2xl p-4 border border-cyan-600/50 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Crown className="w-4 h-4 text-yellow-400" /> ColdStreak Pro
                  <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
                </div>
                <div className="text-cyan-300 text-xs">Active · {proEmail}</div>
                <div className="text-blue-400 text-xs">Unlimited history · Chill Places · Advanced stats</div>
                {(proPlan === "monthly" || proPlan === "annual") && (
                  <div className="space-y-2">
                    <button
                      data-testid="button-upgrade-to-lifetime"
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Crown className="w-3.5 h-3.5" /> Upgrade to Lifetime — $19.99
                    </button>
                    <button
                      data-testid="button-manage-subscription"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("coldstreak-auth-token");
                          const res = await fetch("/api/stripe/portal", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ returnUrl: window.location.origin + "/" }),
                          });
                          const data = await res.json();
                          if (data.url) window.open(data.url, "_blank");
                          else toast({ title: "Unable to open portal", description: data.message ?? "Please try again.", variant: "destructive" });
                        } catch {
                          toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
                        }
                      }}
                      className="w-full py-2 rounded-xl border border-blue-600/50 text-blue-400 text-xs font-semibold transition-all active:scale-[0.98] hover:border-blue-400 flex items-center justify-center gap-1.5"
                    >
                      Manage / Cancel Subscription
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-2xl p-4 border border-cyan-700/50 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Crown className="w-4 h-4 text-yellow-400" /> ColdStreak Pro
                  <span className="ml-auto text-yellow-400 text-sm font-bold">from $3.99</span>
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
                  Upgrade to Pro — from $3.99/mo
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
                          if (ok.success) {
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

                {/* Promo code */}
                <div className="border-t border-blue-700/30 pt-3">
                  <button
                    data-testid="button-toggle-promo"
                    onClick={() => setPromoCode("")}
                    className="w-full text-left text-blue-400 text-xs font-semibold hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3" /> Have a promo code?
                  </button>
                  <div className="flex gap-2 mt-2">
                    <input
                      data-testid="input-promo-code"
                      type="text"
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 uppercase tracking-widest"
                    />
                    <button
                      data-testid="button-redeem-promo"
                      disabled={promoLoading || !promoCode.trim()}
                      onClick={async () => {
                        setPromoLoading(true);
                        const result = await redeemPromo(promoCode.trim());
                        setPromoLoading(false);
                        if (result.success) {
                          toast({ title: `Pro activated for ${result.durationDays} days! ❄️`, description: "Enjoy all Pro features." });
                          setPromoCode("");
                        } else {
                          toast({ title: "Invalid code", description: result.error, variant: "destructive" });
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-bold transition-all active:scale-95"
                    >
                      {promoLoading ? "…" : "Redeem"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User */}
            <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40">
              <button
                data-testid="button-toggle-user"
                onClick={() => setUserOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-semibold text-sm">User</span>
                </div>
                <span className={`text-blue-400 text-xs transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {userOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-blue-700/30 pt-3">

                  {/* Account */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-3 flex items-center gap-1">
                      <User className="w-3 h-3" /> Account
                    </label>
                    {auth.user ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-blue-800/40 rounded-xl px-3 py-2.5 border border-blue-700/30">
                          {auth.user.emailVerified
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <span className="text-cyan-300 text-xs truncate flex-1">{auth.user.email}</span>
                        </div>
                        {!auth.user.emailVerified && (
                          <div className="bg-amber-900/30 border border-amber-600/30 rounded-xl px-3 py-2.5 space-y-2">
                            <p className="text-amber-300 text-xs">Check your inbox to verify your email address.</p>
                            {resendSent ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-green-400 text-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Verification email sent
                                </p>
                                <button
                                  data-testid="button-resend-verification-again"
                                  onClick={async () => {
                                    setResendSent(false);
                                    await auth.resendVerification();
                                    setResendSent(true);
                                  }}
                                  className="text-amber-400 text-xs underline hover:text-amber-300 transition-colors"
                                >
                                  Send again
                                </button>
                              </div>
                            ) : (
                              <button
                                data-testid="button-resend-verification"
                                onClick={async (e) => {
                                  const btn = e.currentTarget;
                                  btn.disabled = true;
                                  btn.textContent = "Sending…";
                                  await auth.resendVerification();
                                  setResendSent(true);
                                }}
                                className="text-amber-400 text-xs underline hover:text-amber-300 transition-colors disabled:opacity-50"
                              >
                                Resend verification email
                              </button>
                            )}
                          </div>
                        )}
                        {!syncDone ? (
                          <button
                            data-testid="button-sync-data"
                            onClick={handleSync}
                            disabled={auth.loading}
                            className="w-full py-2.5 rounded-xl bg-blue-700/60 hover:bg-blue-700 border border-blue-600 text-blue-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {auth.loading ? "Syncing…" : "Sync local data to account"}
                          </button>
                        ) : (
                          <p className="text-green-400 text-xs flex items-center gap-1.5 px-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Local data synced to your account
                          </p>
                        )}
                        <button
                          data-testid="button-account-signout"
                          onClick={handleLogout}
                          className="w-full py-2 rounded-xl bg-transparent border border-blue-700/50 text-blue-400 text-xs font-semibold hover:border-red-500/50 hover:text-red-400 transition-colors"
                        >
                          Sign out
                        </button>
                      </div>
                    ) : forgotMode ? (
                      <div className="space-y-2">
                        {forgotSent ? (
                          <div className="bg-green-900/30 border border-green-600/30 rounded-xl px-4 py-3 text-center">
                            <p className="text-green-300 text-sm font-semibold mb-1">Check your inbox</p>
                            <p className="text-green-400/80 text-xs">A reset link was sent to {authEmail}</p>
                          </div>
                        ) : (
                          <>
                            <p className="text-blue-300 text-xs px-1">Enter your account email and we'll send a reset link.</p>
                            <input
                              data-testid="input-forgot-email"
                              type="email"
                              placeholder="Your account email"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                            />
                            <button
                              data-testid="button-forgot-submit"
                              onClick={handleForgotPassword}
                              disabled={auth.loading || !authEmail}
                              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 text-sm font-bold transition-colors disabled:opacity-50"
                            >
                              {auth.loading ? "Sending…" : "Send Reset Link"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setForgotMode(false); setForgotSent(false); auth.clearError(); }}
                          className="w-full py-1.5 text-blue-400 text-xs hover:text-blue-300 transition-colors"
                        >
                          ← Back to sign in
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex rounded-xl overflow-hidden border border-blue-700/50">
                          <button
                            data-testid="button-auth-mode-login"
                            onClick={() => { setAuthMode("login"); auth.clearError(); }}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${authMode === "login" ? "bg-cyan-500 text-blue-950" : "bg-blue-800/60 text-blue-300 hover:bg-blue-700/60"}`}
                          >Sign In</button>
                          <button
                            data-testid="button-auth-mode-register"
                            onClick={() => { setAuthMode("register"); auth.clearError(); }}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${authMode === "register" ? "bg-cyan-500 text-blue-950" : "bg-blue-800/60 text-blue-300 hover:bg-blue-700/60"}`}
                          >Create Account</button>
                        </div>
                        <input
                          data-testid="input-auth-email"
                          type="email"
                          placeholder="Email"
                          value={authEmail}
                          onChange={(e) => {
                            setAuthEmail(e.target.value);
                            if (rememberEmail) localStorage.setItem("coldstreak-saved-email", e.target.value);
                          }}
                          className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                        />
                        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                          <input
                            data-testid="checkbox-remember-email"
                            type="checkbox"
                            checked={rememberEmail}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRememberEmail(checked);
                              localStorage.setItem("coldstreak-remember-email", String(checked));
                              if (checked) {
                                localStorage.setItem("coldstreak-saved-email", authEmail);
                              } else {
                                localStorage.removeItem("coldstreak-saved-email");
                              }
                            }}
                            className="w-3.5 h-3.5 accent-cyan-400"
                          />
                          <span className="text-blue-400 text-xs">Remember my email</span>
                        </label>
                        <div className="space-y-1">
                          <input
                            data-testid="input-auth-password"
                            type="password"
                            placeholder={authMode === "register" ? "Password (min 6 chars)" : "Password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()}
                            className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                          />
                          {authMode === "login" && (
                            <button
                              data-testid="button-forgot-password"
                              onClick={() => { setForgotMode(true); setForgotSent(false); auth.clearError(); }}
                              className="text-blue-500 text-xs hover:text-cyan-400 transition-colors px-1"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        {auth.error && (
                          <p className="text-red-400 text-xs px-1">{auth.error}</p>
                        )}
                        <button
                          data-testid="button-auth-submit"
                          onClick={handleAuthSubmit}
                          disabled={auth.loading || !authEmail || !authPassword}
                          className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          {auth.loading ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Account"}
                        </button>
                        <p className="text-blue-500 text-xs text-center">Your plunges sync across all your devices</p>
                      </div>
                    )}
                  </div>

                  {/* Leaderboard name */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                      <User className="w-3 h-3" /> Leaderboard Name
                    </label>
                    {(StreakBadge || DaysBadge) && (
                      <div className="flex items-center gap-2 mb-2 bg-blue-800/40 rounded-xl px-3 py-2 border border-blue-700/30">
                        <span className="text-blue-400 text-xs truncate">{username || "You"}</span>
                        {StreakBadge}
                        {DaysBadge}
                      </div>
                    )}
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
                      onBlur={(e) => {
                        const token = localStorage.getItem("coldstreak-auth-token");
                        if (!token || !e.target.value.trim()) return;
                        fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ displayName: e.target.value.trim() }) }).catch(() => {});
                      }}
                      className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                    />
                    <p className="text-blue-500 text-xs mt-1">Shown on leaderboards when you submit a plunge.</p>
                  </div>

                  {/* Home label */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                      🏠 Home Location Label
                    </label>
                    <input
                      data-testid="input-home-label"
                      type="text"
                      placeholder="e.g. Ice Barrel, Garage Tub, Bathtub…"
                      value={homeLabel}
                      maxLength={40}
                      onChange={(e) => {
                        setHomeLabel(e.target.value || "Home");
                        localStorage.setItem("coldstreak-home-label", e.target.value || "Home");
                      }}
                      className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                    />
                    <p className="text-blue-500 text-xs mt-1">Private — shares always show "Home".</p>
                  </div>

                  {/* Body weight */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" /> Body Weight
                    </label>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const saveWeightToServer = (val: number) => {
                          const token = localStorage.getItem("coldstreak-auth-token");
                          if (token) fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ bodyWeight: val }) }).catch(() => {});
                        };
                        const stopHold = () => {
                          if (weightHoldRef.current) { clearTimeout(weightHoldRef.current); weightHoldRef.current = null; }
                          weightHoldCountRef.current = 0;
                          const stored = Number(localStorage.getItem("coldstreak-body-weight"));
                          if (stored) saveWeightToServer(stored);
                        };
                        const startHold = (dir: 1 | -1) => {
                          const tick = () => {
                            weightHoldCountRef.current += 1;
                            const fast = weightHoldCountRef.current > 20;
                            const step = fast ? 5 : 1;
                            const delay = fast ? 60 : 120;
                            setBodyWeightLbs(prev => {
                              const val = Math.min(400, Math.max(80, prev + dir * step));
                              localStorage.setItem("coldstreak-body-weight", String(val));
                              return val;
                            });
                            weightHoldRef.current = setTimeout(tick, delay);
                          };
                          weightHoldRef.current = setTimeout(tick, 350);
                        };
                        const pressProps = (dir: 1 | -1) => ({
                          onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); startHold(dir); },
                          onMouseUp: stopHold,
                          onMouseLeave: stopHold,
                          onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startHold(dir); },
                          onTouchEnd: stopHold,
                          onClick: () => {
                            if (weightHoldCountRef.current > 0) return;
                            setBodyWeightLbs(prev => {
                              const val = Math.min(400, Math.max(80, prev + dir));
                              localStorage.setItem("coldstreak-body-weight", String(val));
                              saveWeightToServer(val);
                              return val;
                            });
                          },
                        });
                        return (<>
                          <button data-testid="button-weight-decrease" {...pressProps(-1)}
                            className="w-8 h-8 rounded-lg bg-blue-800/80 border border-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-95 hover:border-cyan-400 select-none"
                          >−</button>
                          <div data-testid="input-body-weight"
                            className="w-20 bg-blue-800/80 border border-blue-600 rounded-xl px-2 py-1.5 text-white text-sm font-bold text-center select-none pointer-events-none"
                          >{bodyWeightLbs}</div>
                          <button data-testid="button-weight-increase" {...pressProps(1)}
                            className="w-8 h-8 rounded-lg bg-blue-800/80 border border-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-95 hover:border-cyan-400 select-none"
                          >+</button>
                        </>);
                      })()}
                      <span className="text-blue-500 text-xs">lbs ({Math.round(bodyWeightLbs / 2.205)} kg)</span>
                    </div>
                    <p className="text-blue-500 text-xs mt-1">Used to estimate calories burned per plunge.</p>
                  </div>

                  {/* Weekly goal */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Weekly Goal
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        data-testid="select-weekly-goal"
                        value={weeklyGoalMinutes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setWeeklyGoalMinutes(val);
                          localStorage.setItem("weeklyGoalMinutes", String(val));
                        }}
                        className="bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm font-semibold appearance-none focus:outline-none focus:border-cyan-400"
                      >
                        {Array.from({ length: 110 }, (_, i) => i + 11).map((m) => (
                          <option key={m} value={m}>{m} min / week</option>
                        ))}
                      </select>
                      <span className="text-blue-400 text-xs">{weeklyMinutes.toFixed(1)} min done</span>
                    </div>
                    <div className="mt-2 h-2 bg-blue-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
                    </div>
                  </div>

                  {/* Est. Calories Burned */}
                  <div>
                    <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" /> Est. Calories Burned
                    </label>
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
                    <p className="text-blue-600 text-[10px] mt-2 leading-relaxed">
                      Estimated via thermogenesis model. Cold water forces your body to generate heat, burning extra calories beyond your normal resting rate.
                    </p>
                  </div>

                </div>
              )}
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
                    disabled={countdownRunning}
                    className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white font-semibold appearance-none text-center focus:outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed">
                    {Array.from({ length: 61 }, (_, i) => <option key={i} value={i}>{i} min</option>)}
                  </select>
                  <span className="text-blue-400 font-bold">:</span>
                  <select data-testid="select-countdown-seconds" value={secondsInput} onChange={(e) => setSecondsInput(Number(e.target.value))}
                    disabled={countdownRunning}
                    className="flex-1 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white font-semibold appearance-none text-center focus:outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed">
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
                    onClick={() => selectPresetAlarm(preset.url, preset.label, preset.gain)}
                    className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                      !alarmIsCustom && alarmLabel === preset.label
                        ? "bg-cyan-500/30 border-cyan-400 text-cyan-200"
                        : "bg-blue-800/60 border-blue-600/50 text-blue-300 hover:text-white hover:border-blue-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                {/* 4th tile — Custom sound */}
                <input
                  ref={alarmUploadRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioUpload}
                  data-testid="input-alarm-upload"
                />
                <button
                  data-testid="button-alarm-custom"
                  onClick={() => {
                    if (alarmIsCustom) return;
                    alarmUploadRef.current?.click();
                  }}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    alarmIsCustom
                      ? "bg-cyan-500/30 border-cyan-400 text-cyan-200"
                      : "bg-blue-800/60 border-blue-600/50 text-blue-300 hover:text-white hover:border-blue-400"
                  }`}
                >
                  {alarmIsCustom ? (
                    <span className="truncate max-w-[90px]">{alarmCustomLabel || "Custom"}</span>
                  ) : (
                    <><Upload className="w-3.5 h-3.5 shrink-0" /><span>Custom</span></>
                  )}
                </button>
              </div>

              {/* Custom sound controls — shown when custom is active */}
              {alarmIsCustom && (
                <div className="space-y-2">
                  <input
                    data-testid="input-custom-alarm-label"
                    type="text"
                    placeholder="Name your sound…"
                    value={alarmCustomLabel}
                    maxLength={32}
                    onChange={(e) => setAlarmCustomLabel(e.target.value)}
                    onBlur={(e) => saveCustomLabel(e.target.value)}
                    className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    data-testid="button-upload-new-alarm"
                    onClick={() => alarmUploadRef.current?.click()}
                    className="flex items-center gap-1.5 text-blue-400 hover:text-cyan-300 text-xs font-semibold transition-colors"
                  >
                    <Upload className="w-3 h-3" /> Upload a different file
                  </button>
                  <p className="text-blue-500 text-xs">Custom sounds play for 5 seconds. Use only sounds you own or have the rights to.</p>
                </div>
              )}
            </div>

            {/* Legal & Safety */}
            <button
              data-testid="button-nav-legal"
              onClick={() => navTo("legal")}
              className="w-full flex items-center justify-between bg-blue-900/60 rounded-2xl px-4 py-3 border border-blue-700/40 hover:border-cyan-500/50 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-white font-semibold text-sm">Legal &amp; Safety</span>
              </div>
              <span className="text-blue-400 text-xs">›</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── GEAR SCREEN ─── */}
      {screen === "gear" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan-400" /> Cold Plunge Gear
            </h2>
            <button
              data-testid="button-close-gear"
              onClick={() => navTo("timer")}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
            >✕</button>
          </div>

          {/* 4 Category Tabs */}
          <div className="grid grid-cols-4 gap-1.5 px-4 pb-3 shrink-0">
            {([ 
              { key: "plunges" as GearCategory, emoji: "🛁", label: "Plunges" },
              { key: "diy"     as GearCategory, emoji: "🔧", label: "DIY" },
              { key: "devices" as GearCategory, emoji: "📡", label: "Devices" },
              { key: "apparel" as GearCategory, emoji: "🧤", label: "Apparel" },
            ] as const).map(({ key, emoji, label }) => (
              <button
                key={key}
                data-testid={`tab-gear-${key}`}
                onClick={() => setGearCategory(key)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border transition-all active:scale-95 ${
                  gearCategory === key
                    ? "bg-cyan-500/20 border-cyan-500/60 text-white"
                    : "bg-blue-900/40 border-blue-700/30 text-blue-400 hover:border-blue-500/50"
                }`}
              >
                <span className="text-lg leading-none">{emoji}</span>
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            ))}
          </div>

          {/* Item Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <div className="grid grid-cols-2 gap-3">
              {GEAR_ITEMS.filter(i => i.category === gearCategory).map((item) => (
                <div key={item.id} className="bg-blue-950/80 rounded-2xl overflow-hidden border border-blue-800/50 flex flex-col">
                  {item.image ? (
                    <div className="bg-white/5 h-28 flex items-center justify-center px-3 pt-2">
                      <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="bg-blue-900/40 h-28 flex items-center justify-center text-4xl">
                      { gearCategory === "plunges" ? "🛁"
                      : gearCategory === "diy"     ? "🔧"
                      : gearCategory === "devices" ? "📡"
                      : "🧤" }
                    </div>
                  )}
                  <div className="px-2.5 py-2 flex flex-col gap-1.5 flex-1">
                    <div className="text-white font-semibold text-[11px] leading-snug">{item.name}</div>
                    <div className="text-blue-400 text-[10px] leading-relaxed line-clamp-3 flex-1">{item.description}</div>
                    <a
                      data-testid={`link-gear-${item.id}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-0.5 flex items-center justify-center gap-1 text-white font-bold text-[10px] px-2 py-1.5 rounded-lg transition-all active:scale-95 ${
                        item.linkLabel === "View on Amazon"
                          ? "bg-amber-500 hover:bg-amber-400"
                          : "bg-cyan-600 hover:bg-cyan-500"
                      }`}
                    >
                      {item.linkLabel}
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-blue-700 text-[10px] text-center mt-3 pb-1">
              As an Amazon Associate, ColdStreak earns from qualifying purchases.
            </p>
          </div>
        </div>
      )}

      {/* ─── DEVICES SCREEN ─── */}
      {screen === "devices" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="bg-blue-950/90 backdrop-blur-sm rounded-3xl p-4 border border-blue-800/50 min-h-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Bluetooth className="w-5 h-5 text-cyan-400" /> Bluetooth Devices
              </h2>
              <button
                data-testid="button-close-devices"
                onClick={() => navTo("timer")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
              >✕</button>
            </div>

            {/* Warning when BLE plugin is missing from this build */}
            {!bleAvailable && Capacitor.isNativePlatform() && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-2xl px-4 py-3 flex gap-3 items-start">
                <span className="text-red-400 text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-red-300 text-sm font-semibold">Rebuild required</p>
                  <p className="text-red-400/80 text-xs leading-relaxed mt-0.5">
                    The Bluetooth plugin wasn't included in this build. Run <span className="font-mono">npx cap sync android</span> then rebuild and reinstall the APK.
                  </p>
                </div>
              </div>
            )}
            {/* Mobile-browser warning — BLE only works in native Capacitor app */}
            {!bleAvailable && !Capacitor.isNativePlatform() && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-2xl px-4 py-3 flex gap-3 items-start">
                <span className="text-yellow-400 text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-yellow-300 text-sm font-semibold">Native app required</p>
                  <p className="text-yellow-400/80 text-xs leading-relaxed mt-0.5">
                    Bluetooth sensor pairing is only available in the ColdStreak Android or iOS app. This browser does not support BLE device connections.
                  </p>
                </div>
              </div>
            )}

            {/* Thermometer */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-white font-semibold text-sm">Water Thermometer</span>
                {btConnected && <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Connected</span>}
              </div>
              <p className="text-blue-400/80 text-xs leading-relaxed">
                Connect a BLE thermometer (e.g. ThermoPro TP25) to automatically read your water temperature during a plunge.
              </p>
              {btConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 rounded-xl px-3 py-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                    <span className="text-green-300 text-sm font-medium flex-1 truncate">{btDeviceName || "Thermometer"}</span>
                    <span className="text-green-400/70 text-xs font-bold">{btConnected ? `${temperature}°${useCelsius ? "C" : "F"}` : "—"}</span>
                  </div>
                  <button
                    data-testid="button-bt-disconnect-devices"
                    onClick={disconnectThermometer}
                    className="w-full py-2 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-semibold hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <BluetoothOff className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Timed-out notice — shown after 3 failed auto-reconnect attempts */}
                  {btThermoTimedOut && (
                    <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                      <span className="text-yellow-400 text-sm">⚠</span>
                      <span className="text-yellow-300/80 text-[11px]">Device timed out — tap below to reconnect.</span>
                    </div>
                  )}
                  {/* Quick reconnect to last paired thermometer */}
                  {(() => {
                    void savedDevicesKey; // depend on key so forget triggers re-render
                    try {
                      const saved = localStorage.getItem("coldstreak-bt-thermo");
                      if (!saved) return null;
                      const { deviceId, name } = JSON.parse(saved) as { deviceId: string; name: string };
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            data-testid="button-bt-quick-reconnect"
                            onClick={() => reconnectThermoFromUI(deviceId, name)}
                            disabled={btConnecting}
                            className="flex-1 flex items-center gap-2 bg-blue-900/30 border border-blue-600/30 rounded-xl px-3 py-2 hover:bg-blue-800/40 transition-colors disabled:opacity-40 min-w-0"
                          >
                            <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-blue-200 text-xs font-semibold truncate">
                                {btConnecting ? "Connecting…" : <>Reconnect to <span className="text-white">{name || "Thermometer"}</span></>}
                              </div>
                              <div className="text-blue-400/60 text-[10px] font-mono truncate">{deviceId}</div>
                            </div>
                            {btConnecting
                              ? <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                              : <span className="text-cyan-400 text-[10px] font-semibold shrink-0">Connect</span>
                            }
                          </button>
                          <button
                            data-testid="button-bt-forget-thermo"
                            onClick={() => { localStorage.removeItem("coldstreak-bt-thermo"); setSavedDevicesKey(k => k + 1); }}
                            title="Forget device"
                            className="w-8 h-8 rounded-xl bg-red-900/20 border border-red-700/20 text-red-400/60 hover:bg-red-900/40 hover:text-red-300 flex items-center justify-center transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* Pair a different / new thermometer */}
                  <button
                    data-testid="button-bt-connect-devices"
                    onClick={connectThermometer}
                    disabled={btConnecting}
                    className="w-full py-2 rounded-xl bg-cyan-900/20 border border-cyan-700/30 text-cyan-400/80 text-xs font-semibold hover:bg-cyan-900/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    {localStorage.getItem("coldstreak-bt-thermo") ? "Pair a different thermometer" : "Pair Thermometer"}
                  </button>
                </div>
              )}
              {/* Temperature calibration offset */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-blue-400/70 text-xs flex-1">Calibration offset</span>
                <button
                  data-testid="button-temp-offset-down"
                  onClick={() => setBtTempOffset(v => Math.max(-10, +(v - 1).toFixed(0)))}
                  className="w-7 h-7 rounded-lg bg-blue-800/60 text-white text-base font-bold flex items-center justify-center hover:bg-blue-700/60 transition-colors"
                >−</button>
                <span data-testid="text-temp-offset" className="text-white text-xs font-bold w-10 text-center">
                  {btTempOffset > 0 ? `+${btTempOffset}` : btTempOffset}°{useCelsius ? "C" : "F"}
                </span>
                <button
                  data-testid="button-temp-offset-up"
                  onClick={() => setBtTempOffset(v => Math.min(10, +(v + 1).toFixed(0)))}
                  className="w-7 h-7 rounded-lg bg-blue-800/60 text-white text-base font-bold flex items-center justify-center hover:bg-blue-700/60 transition-colors"
                >+</button>
                {btTempOffset !== 0 && (
                  <button
                    data-testid="button-temp-offset-reset"
                    onClick={() => setBtTempOffset(0)}
                    className="text-blue-400/60 text-[10px] hover:text-blue-300 transition-colors"
                  >reset</button>
                )}
              </div>
            </div>

            {/* Heart Rate Monitor */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-white font-semibold text-sm">Heart Rate Monitor</span>
                {hrConnected && <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Connected</span>}
              </div>
              <p className="text-blue-400/80 text-xs leading-relaxed">
                Connect a Bluetooth heart rate monitor or smartwatch. Supports any device using the standard BLE Heart Rate Profile (e.g. Amazfit, Polar, Garmin).
              </p>
              <p className="text-yellow-400/70 text-[10px] leading-relaxed bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2">
                ⌚ Smartwatch tip: Start a workout on your watch <em>before</em> connecting to activate live HR broadcasting.
              </p>
              {hrConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/40 rounded-xl px-3 py-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                    <span className="text-green-300 text-sm font-medium flex-1 truncate">{hrDeviceName || "Heart Rate Monitor"}</span>
                    {currentHR && <span className="text-red-300 text-sm font-bold">{currentHR} <span className="text-xs font-normal text-red-300/70">BPM</span></span>}
                  </div>
                  <button
                    data-testid="button-hr-disconnect-devices"
                    onClick={disconnectHR}
                    className="w-full py-2 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-sm font-semibold hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <BluetoothOff className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Scan / scanning indicator row */}
                  {hrScanActive ? (
                    <div className="flex items-center justify-between bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2 text-red-300 text-xs">
                        <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        Scanning…{hrScanDevices.length > 0 && <span className="text-red-300/60"> ({hrScanDevices.length} found)</span>}
                      </div>
                      <button
                        data-testid="button-hr-scan-stop"
                        onClick={stopHrScan}
                        className="text-red-400/70 text-[10px] hover:text-red-300 transition-colors"
                      >Stop</button>
                    </div>
                  ) : (
                    <button
                      data-testid="button-hr-scan"
                      onClick={startHrScan}
                      disabled={hrConnecting}
                      className="w-full py-2 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm font-semibold hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {hrConnecting
                        ? <><span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Connecting…</>
                        : <><Bluetooth className="w-4 h-4" />{hrScanDone && hrScanDevices.length > 0 ? "Scan again" : "Scan for Heart Rate Monitors"}</>
                      }
                    </button>
                  )}

                  {/* Discovered devices list — sorted strongest signal first */}
                  {hrScanDevices.length > 0 && (
                    <div className="space-y-1.5">
                      {[...hrScanDevices].sort((a, b) => b.rssi - a.rssi).map((d) => {
                        const bars = d.rssi >= -60 ? 3 : d.rssi >= -75 ? 2 : 1;
                        const barColor = bars === 3 ? "text-green-400" : bars === 2 ? "text-yellow-400" : "text-red-400/60";
                        return (
                          <button
                            key={d.deviceId}
                            data-testid={`button-hr-device-${d.deviceId}`}
                            onClick={() => connectFromHrScan(d.deviceId, d.name)}
                            disabled={hrConnecting}
                            className="w-full flex items-center gap-3 bg-blue-900/40 border border-blue-700/30 rounded-xl px-3 py-2.5 hover:bg-blue-800/50 transition-colors text-left disabled:opacity-40"
                          >
                            <Heart className="w-4 h-4 text-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{d.name}</div>
                              <div className="text-blue-400/50 text-[10px] font-mono truncate">{d.deviceId}</div>
                            </div>
                            {/* Signal strength bars */}
                            <div className={`flex items-end gap-[2px] ${barColor} shrink-0`} title={`${d.rssi} dBm`}>
                              <span className={`w-[3px] rounded-sm ${bars >= 1 ? "bg-current" : "bg-current opacity-20"}`} style={{height: 6}} />
                              <span className={`w-[3px] rounded-sm ${bars >= 2 ? "bg-current" : "bg-current opacity-20"}`} style={{height: 10}} />
                              <span className={`w-[3px] rounded-sm ${bars >= 3 ? "bg-current" : "bg-current opacity-20"}`} style={{height: 14}} />
                            </div>
                            <span className="text-blue-300 text-[10px] font-semibold shrink-0">Connect</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* No devices found after scan */}
                  {hrScanDone && !hrScanActive && hrScanDevices.length === 0 && (
                    <p className="text-blue-400/50 text-[11px] text-center py-1">
                      No devices found. Make sure your watch is nearby and awake.
                    </p>
                  )}

                  {/* Quick reconnect to last manually-paired device */}
                  {(() => {
                    void savedDevicesKey; // depend on key so forget triggers re-render
                    try {
                      const saved = localStorage.getItem("coldstreak-bt-hr");
                      if (!saved) return null;
                      const { deviceId, name } = JSON.parse(saved) as { deviceId: string; name: string };
                      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(deviceId)) return null;
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            data-testid="button-hr-quick-reconnect"
                            onClick={() => connectManualHR(deviceId, name)}
                            disabled={hrConnecting}
                            className="flex-1 flex items-center gap-2 bg-blue-900/30 border border-blue-600/30 rounded-xl px-3 py-2 hover:bg-blue-800/40 transition-colors disabled:opacity-40 min-w-0"
                          >
                            <Heart className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-blue-200 text-xs font-semibold truncate">
                                {hrConnecting ? "Connecting…" : <>Reconnect to <span className="text-white">{name || "Heart Rate Monitor"}</span></>}
                              </div>
                              <div className="text-blue-400/60 text-[10px] font-mono truncate">{deviceId}</div>
                            </div>
                            {hrConnecting
                              ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin shrink-0" />
                              : <span className="text-red-400 text-[10px] font-semibold shrink-0">Connect</span>
                            }
                          </button>
                          <button
                            data-testid="button-hr-forget"
                            onClick={() => { localStorage.removeItem("coldstreak-bt-hr"); setSavedDevicesKey(k => k + 1); }}
                            title="Forget device"
                            className="w-8 h-8 rounded-xl bg-red-900/20 border border-red-700/20 text-red-400/60 hover:bg-red-900/40 hover:text-red-300 flex items-center justify-center transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {/* Manual Bluetooth address entry */}
                  <div className="border-t border-blue-700/20 pt-2 mt-1">
                    <button
                      data-testid="button-hr-manual-toggle"
                      onClick={() => {
                        const next = !hrManualEntry;
                        setHrManualEntry(next);
                        if (next && !hrManualAddress) {
                          try {
                            const saved = localStorage.getItem("coldstreak-bt-hr");
                            if (saved) {
                              const { deviceId, name } = JSON.parse(saved) as { deviceId: string; name: string };
                              if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(deviceId)) {
                                setHrManualAddress(deviceId);
                                setHrManualName(name || "");
                              }
                            }
                          } catch { /* ignore */ }
                        }
                      }}
                      className="text-blue-400/60 text-[11px] hover:text-blue-300 transition-colors w-full text-center"
                    >
                      {hrManualEntry ? "Hide" : "Enter Bluetooth address manually →"}
                    </button>

                    {hrManualEntry && (
                      <div className="mt-2 space-y-2">
                        <p className="text-blue-400/60 text-[10px] leading-relaxed">
                          Find your device's Bluetooth address in its companion app settings (e.g. Zepp → Profile → Device Info → Bluetooth Address). The app will scan for your device in the background then connect — keep the watch nearby. Allow up to 12 seconds.
                        </p>
                        <p className="text-yellow-400/60 text-[10px] bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-2.5 py-1.5 leading-relaxed">
                          Android only — iOS randomizes Bluetooth addresses and this won't work on iPhone.
                        </p>
                        <input
                          data-testid="input-hr-manual-address"
                          type="text"
                          placeholder="e.g. AB:CD:EF:12:34:56"
                          value={hrManualAddress}
                          onChange={e => {
                            // Strip non-hex chars, replace letter O with 0, uppercase
                            const raw = e.target.value.toUpperCase().replace(/O/g, "0").replace(/[^0-9A-F]/g, "");
                            // Group into pairs and join with colons (max 6 pairs = 12 hex chars)
                            const trimmed = raw.slice(0, 12);
                            const formatted = trimmed.match(/.{1,2}/g)?.join(":") ?? trimmed;
                            setHrManualAddress(formatted);
                          }}
                          maxLength={17}
                          className="w-full bg-blue-900/40 border border-blue-700/40 rounded-lg px-3 py-2 text-white text-sm placeholder-blue-500/50 focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                        />
                        <input
                          data-testid="input-hr-manual-name"
                          type="text"
                          placeholder="Device name (optional, e.g. Amazfit T-Rex 2)"
                          value={hrManualName}
                          onChange={e => setHrManualName(e.target.value)}
                          className="w-full bg-blue-900/40 border border-blue-700/40 rounded-lg px-3 py-2 text-white text-sm placeholder-blue-500/50 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          data-testid="button-hr-manual-connect"
                          onClick={() => {
                            const addr = hrManualAddress.trim();
                            if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(addr)) {
                              toast({ title: "Invalid address", description: "Format must be AB:CD:EF:12:34:56", variant: "destructive" });
                              return;
                            }
                            connectManualHR(addr, hrManualName.trim() || addr);
                            setHrManualEntry(false);
                            setHrManualAddress("");
                            setHrManualName("");
                          }}
                          disabled={hrConnecting || !hrManualAddress.trim()}
                          className="w-full py-2 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm font-semibold hover:bg-red-900/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {hrConnecting
                            ? <><span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Connecting…</>
                            : <><Bluetooth className="w-4 h-4" />Connect to Address</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Troubleshooting — collapsible, no extra state needed */}
              <details className="border-t border-blue-700/20 pt-2 mt-1">
                <summary className="text-blue-400/50 text-[11px] cursor-pointer hover:text-blue-300 transition-colors select-none list-none flex items-center gap-1">
                  <span className="text-[9px]">▸</span> Can't connect? Try these steps
                </summary>
                <ol className="mt-2 space-y-2 text-blue-300/70 text-[11px] leading-relaxed pl-1">
                  <li><span className="text-white/80 font-semibold">1. Pair in Android Bluetooth settings first.</span>{" "}
                    Open Android <em>Settings → Connected devices → Pair new device</em>, find your watch in the list and tap it. This creates the system-level bond ColdStreak needs. Come back and connect here after.</li>
                  <li><span className="text-white/80 font-semibold">2. Start a workout on your watch.</span>{" "}
                    Zepp OS watches only broadcast live heart rate over Bluetooth when a workout is active. Start any activity on the watch, then tap Connect here.</li>
                  <li><span className="text-white/80 font-semibold">3. Enable third-party access in Zepp.</span>{" "}
                    In the Zepp app: <em>Profile → your watch → Health monitoring → Heart rate → Allow third-party access</em>.</li>
                  <li><span className="text-white/80 font-semibold">4. Connecting from a tablet?</span>{" "}
                    First disconnect the watch from your phone (turn off phone Bluetooth or close Zepp) — the watch can only be actively connected to one device at a time. Then pair and connect on the tablet.</li>
                  <li><span className="text-white/80 font-semibold">5. Still timing out?</span>{" "}
                    Forget the device here, unpair it in Android Bluetooth settings, then redo steps 1–3.</li>
                </ol>
              </details>
            </div>

            {/* Manual reminder */}
            <p className="text-blue-600/70 text-[10px] text-center px-2 pb-1">
              No BLE device? You can always type your water temperature manually on the timer screen.
            </p>
          </div>
        </div>
      )}

      {/* ─── DEVICES PRO FROST OVERLAY ─── */}
      {screen === "devices" && !isPro && (
        <div className="absolute top-20 bottom-20 left-0 right-0 z-20 backdrop-blur-md bg-blue-950/60 flex flex-col items-center justify-center gap-5 px-8">
          <Crown className="w-12 h-12 text-yellow-400/90" />
          <div className="text-center">
            <div className="text-white font-bold text-xl mb-2">Pro Feature</div>
            <div className="text-blue-300/80 text-sm leading-relaxed">
              Bluetooth thermometer and heart rate monitor integration requires ColdStreak Pro.
            </div>
          </div>
          <button
            data-testid="button-devices-upgrade"
            onClick={() => setShowUpgradeModal(true)}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-yellow-500/30 hover:from-yellow-400 hover:to-orange-400 transition-all active:scale-95"
          >
            Upgrade to Pro
          </button>
          <button
            onClick={() => navTo("timer")}
            className="text-blue-400/60 text-xs hover:text-blue-300 transition-colors"
          >
            Go back
          </button>
        </div>
      )}

      {/* ─── ACHIEVEMENTS SCREEN ─── */}
      {screen === "achievements" && (() => {
        const allStates = [...new Set(PASSPORT_LOCATIONS.map((l) => l.state))].sort();
        const earnedStates = new Set(computeStateBadges(badges));
        const plungeList = plunges ?? [];

        // Cascade progression: earning a colder tier auto-unlocks all warmer tiers
        // Order: ice-breaker (30-39) > cold-blooded (40-49) > initiate (50-60)
        const orderedTiers = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
        const earnedTempTierIds = new Set<string>();
        let cascade = false;
        for (const t of orderedTiers) {
          if (!cascade) cascade = plungeList.some((p) => p.temperature >= t.minTemp && p.temperature <= t.maxTemp);
          if (cascade) earnedTempTierIds.add(t.id);
        }

        // Days-plunged milestone badges
        const uniquePlungeDays = new Set(plungeList.map((p) => new Date(p.createdAt).toLocaleDateString())).size;
        const earnedDaysTierIds = new Set(DAYS_TIERS.filter((t) => uniquePlungeDays >= t.days).map((t) => t.id));

        const totalTiers = earnedTempTierIds.size;
        const totalStates = earnedStates.size;
        const totalDays = earnedDaysTierIds.size;
        const foundingPlungerCount = isFoundingPlunger ? 1 : 0;
        const totalEarned = totalTiers + totalStates + totalDays + foundingPlungerCount;
        const totalPossible = TEMP_TIERS.length + allStates.length + DAYS_TIERS.length + (isFoundingPlunger ? 1 : 0);

        const badgeEmojiLookup: Record<string, string> = {};
        TEMP_TIERS.forEach(t => { badgeEmojiLookup[t.id] = t.emoji; });
        DAYS_TIERS.forEach(t => { badgeEmojiLookup[t.id] = t.emoji; });
        Object.entries(STATE_EMOJI).forEach(([s, e]) => { badgeEmojiLookup[s] = e as string; });


        return (
          <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
            <div className="space-y-3">

              {/* Header */}
              <div className="bg-blue-950/90 backdrop-blur-sm rounded-3xl px-5 pt-5 pb-4 border border-blue-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Trophy className="w-7 h-7 text-yellow-400" />
                      {totalEarned > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-blue-950 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                          {totalEarned}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-white font-bold text-lg leading-tight truncate">
                        {username ? `${username}'s Badges` : "My Badges"}
                      </h2>
                      {streak > 0 && (
                        <p className="text-orange-400 text-xs">🔥 {streak} day streak</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {featuredBadgeIds.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-0.5 max-w-[100px]">
                        {featuredBadgeIds.map(id => (
                          <span key={id} className="text-xl leading-tight">{badgeEmojiLookup[id] ?? "🏆"}</span>
                        ))}
                      </div>
                    )}
                    <button
                      data-testid="button-close-achievements"
                      onClick={() => navTo("timer")}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                    >✕</button>
                  </div>
                </div>
                <div className="h-2 bg-blue-900/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: `${totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0}%` }}
                  />
                </div>
                {username && (
                  <button
                    data-testid="button-share-badge-profile"
                    onClick={async () => {
                      const url = `https://coldstreakapp.com/profile/${encodeURIComponent(username)}`;
                      if (navigator.share) {
                        try { await navigator.share({ title: `${username}'s Badge Profile`, url }); } catch {}
                      } else {
                        await navigator.clipboard.writeText(url);
                        toast({ title: "Profile link copied!", description: "Share it with friends." });
                      }
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-800/60 border border-blue-600/40 text-blue-200 text-sm font-medium py-2 rounded-xl active:scale-95 transition-transform"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share My Badge Profile
                  </button>
                )}
              </div>

              {/* Founding Plunger */}
              {isFoundingPlunger && (
                <div
                  data-testid="achievement-founding-plunger"
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-900/40 to-yellow-900/20 border border-amber-500/40"
                >
                  <span className="text-4xl leading-none shrink-0">🎖️</span>
                  <div className="min-w-0">
                    <div className="text-amber-300 font-bold text-base leading-tight">Founding Plunger</div>
                    <div className="text-amber-200/60 text-xs mt-0.5 leading-relaxed">
                      One of the first 1,000 people to go Pro. This exclusive title appears on your profile and leaderboard entries.
                    </div>
                  </div>
                </div>
              )}

              {/* Featured Badges */}
              <div className="bg-blue-950/80 rounded-2xl border border-blue-700/50">
                <button
                  data-testid="button-toggle-featured-badges"
                  onClick={() => setOpenSections(s => ({ ...s, featured: !s.featured }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-blue-400 text-[11px] uppercase tracking-widest">Featured Badges</div>
                    <div className="text-blue-600 text-[10px] mt-0.5">Shown next to your name on leaderboards</div>
                  </div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ml-3 shrink-0 ${openSections.featured ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.featured && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3 space-y-3">
                    {/* Temperature Tier — auto = highest earned */}
                    <div>
                      <div className="text-blue-500 text-[10px] uppercase tracking-widest mb-1.5">Temperature Tier</div>
                      {highestEarnedTempTier ? (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-blue-700/50 bg-blue-900/70">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{highestEarnedTempTier.emoji}</span>
                            <div>
                              <div className="text-white text-xs font-semibold">{highestEarnedTempTier.label}</div>
                              <div className="text-blue-400 text-[10px]">Highest earned · updates automatically</div>
                            </div>
                          </div>
                          <button
                            data-testid="button-toggle-temp-tier-badge"
                            onClick={() => { const n = !showTempTier; localStorage.setItem("coldstreak-show-temp-tier", String(n)); setShowTempTier(n); }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${showTempTier ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-blue-950/80 text-blue-500 border border-blue-700/50"}`}
                          >{showTempTier ? "On ★" : "Off"}</button>
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl border border-blue-800/40 bg-blue-950/60 text-blue-600 text-xs">No temperature tier earned yet</div>
                      )}
                    </div>
                    {/* Days Badge — auto = highest earned */}
                    <div>
                      <div className="text-blue-500 text-[10px] uppercase tracking-widest mb-1.5">Days Plunged</div>
                      {highestEarnedDaysTier ? (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-blue-700/50 bg-blue-900/70">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{highestEarnedDaysTier.emoji}</span>
                            <div>
                              <div className="text-white text-xs font-semibold">{highestEarnedDaysTier.label}</div>
                              <div className="text-blue-400 text-[10px]">Highest earned · updates automatically</div>
                            </div>
                          </div>
                          <button
                            data-testid="button-toggle-days-badge"
                            onClick={() => { const n = !showDaysBadge; localStorage.setItem("coldstreak-show-days-badge", String(n)); setShowDaysBadge(n); }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${showDaysBadge ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-blue-950/80 text-blue-500 border border-blue-700/50"}`}
                          >{showDaysBadge ? "On ★" : "Off"}</button>
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl border border-blue-800/40 bg-blue-950/60 text-blue-600 text-xs">No days badge earned yet</div>
                      )}
                    </div>
                    {/* State Badges */}
                    {earnedStates.size > 0 && (
                      <div>
                        <div className="text-blue-500 text-[10px] uppercase tracking-widest mb-1.5">State Badges</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[...earnedStates].sort().map(state => {
                            const emoji = STATE_EMOJI[state] ?? "🏆";
                            const featured = featuredStateIds.includes(state);
                            return (
                              <button
                                key={state}
                                data-testid={`button-feature-state-${state.replace(/[\s/]/g, "-").toLowerCase()}`}
                                onClick={() => {
                                  const next = featured ? featuredStateIds.filter(s => s !== state) : [...featuredStateIds, state];
                                  localStorage.setItem("coldstreak-featured-badges", JSON.stringify(next));
                                  setFeaturedStateIds(next);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border text-left active:scale-95 ${
                                  featured ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-200" : "bg-blue-900/70 border-blue-700/50 text-blue-300"
                                }`}
                              >
                                <span className="text-sm leading-none shrink-0">{emoji}</span>
                                <span className="truncate">{state}</span>
                                {featured && <span className="ml-auto text-yellow-400 shrink-0">★</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tier Badges */}
              <div className="bg-blue-950/80 rounded-2xl border border-blue-700/50">
                <button
                  data-testid="button-toggle-tier-badges"
                  onClick={() => setOpenSections(s => ({ ...s, tier: !s.tier }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="text-blue-400 text-[11px] uppercase tracking-widest">Tier Badges</div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ${openSections.tier ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.tier && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3">
                    <div className="text-blue-500 text-[11px] mb-3">Reaching a colder tier automatically unlocks all warmer ones.</div>
                    <div className="flex flex-wrap gap-2">
                      {TEMP_TIERS.map((tier) => {
                        const earned = earnedTempTierIds.has(tier.id);
                        return (
                          <button
                            key={tier.id}
                            data-testid={`achievement-tier-${tier.id}`}
                            onClick={() => setBadgeDetailModal({ type: "temp-tier", tierId: tier.id })}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                              earned
                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                                : "bg-blue-800/40 border-blue-700/30 text-blue-600"
                            }`}
                          >
                            <span className="text-base">{tier.emoji}</span>
                            <div className="text-left">
                              <div>{tier.label}</div>
                              <div className="text-[10px] opacity-70">{tier.minTemp === 0 ? "≤32°F" : `${tier.maxTemp}–${tier.minTemp}°F`}</div>
                            </div>
                            {earned && <span className="text-[10px] text-cyan-400 ml-1">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Days Plunged Badges */}
              <div className="bg-blue-950/80 rounded-2xl border border-blue-700/50">
                <button
                  data-testid="button-toggle-days-badges"
                  onClick={() => setOpenSections(s => ({ ...s, days: !s.days }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400 text-[11px] uppercase tracking-widest">Days Plunged</div>
                    {isPro
                      ? <div className="text-blue-500 text-[11px]">{uniquePlungeDays} day{uniquePlungeDays !== 1 ? "s" : ""} total</div>
                      : <span className="flex items-center gap-1 text-[11px] text-yellow-400 font-semibold"><Lock className="w-2.5 h-2.5" /> Pro</span>
                    }
                  </div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ${openSections.days ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.days && isPro && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3">
                    <div className="text-blue-500 text-[11px] mb-3">Reach milestone days to unlock each badge.</div>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_TIERS.map((tier) => {
                        const earned = earnedDaysTierIds.has(tier.id);
                        const isNext = !earned && DAYS_TIERS.filter((t) => !earnedDaysTierIds.has(t.id))[0]?.id === tier.id;
                        const pct = isNext ? Math.min(100, Math.round((uniquePlungeDays / tier.days) * 100)) : 0;
                        return (
                          <button
                            key={tier.id}
                            data-testid={`achievement-days-${tier.id}`}
                            onClick={() => setBadgeDetailModal({ type: "days", tierId: tier.id })}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                              earned
                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                                : "bg-blue-800/40 border-blue-700/30 text-blue-600"
                            }`}
                          >
                            <span className="text-base">{tier.emoji}</span>
                            <div className="text-left">
                              <div>{tier.label}</div>
                              <div className="text-[10px] opacity-70">
                                {tier.days === 365 ? "365+ days" : `${tier.days} days`}
                                {isNext && ` · ${pct}%`}
                              </div>
                            </div>
                            {earned && <span className="text-[10px] text-cyan-400 ml-1">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {openSections.days && !isPro && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3 space-y-3">
                    <div className="relative">
                      <div className="flex flex-wrap gap-2 blur-[3px] opacity-50 pointer-events-none select-none" aria-hidden="true">
                        {DAYS_TIERS.map((tier) => (
                          <div key={tier.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-blue-800/40 border-blue-700/30 text-blue-600">
                            <span className="text-base">{tier.emoji}</span>
                            <div className="text-left">
                              <div>{tier.label}</div>
                              <div className="text-[10px] opacity-70">{tier.days === 365 ? "365+ days" : `${tier.days} days`}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full bg-gradient-to-br from-slate-900 to-blue-950 border border-cyan-600/50 rounded-xl p-3 text-left flex items-center gap-3 active:scale-[0.99] transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-xs">Unlock milestone badges</p>
                        <p className="text-blue-400 text-[11px]">Track plunge streaks across days, weeks & years</p>
                      </div>
                      <span className="text-cyan-400 text-xs font-bold shrink-0">Unlock →</span>
                    </button>
                  </div>
                )}
              </div>

              {/* State Badges */}
              <div className="bg-blue-950/80 rounded-2xl border border-blue-700/50">
                <button
                  data-testid="button-toggle-state-badges"
                  onClick={() => setOpenSections(s => ({ ...s, states: !s.states }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400 text-[11px] uppercase tracking-widest">State Badges</div>
                    {!isPro && <span className="flex items-center gap-1 text-[11px] text-yellow-400 font-semibold"><Lock className="w-2.5 h-2.5" /> Pro</span>}
                  </div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ${openSections.states ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.states && isPro && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3">
                    <div className="text-blue-500 text-[11px] mb-3">Plunge at every Chill Place in a state to earn its badge.</div>
                    <div className="flex flex-wrap gap-1.5">
                      {allStates.map((state) => {
                        const earned = earnedStates.has(state);
                        const emoji = STATE_EMOJI[state] ?? "🏆";
                        const stateLocs = PASSPORT_LOCATIONS.filter((l) => l.state === state);
                        const earnedCount = stateLocs.filter((l) => badges.has(l.id)).length;
                        return (
                          <button
                            key={state}
                            data-testid={`achievement-state-${state.replace(/[\s/]/g, "-").toLowerCase()}`}
                            onClick={() => setBadgeDetailModal({ type: "state", state })}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                              earned
                                ? "bg-yellow-500/20 border border-yellow-500/40 text-yellow-200"
                                : earnedCount > 0
                                ? "bg-blue-800/60 border border-blue-600/50 text-blue-400"
                                : "bg-blue-800/40 border border-blue-700/30 text-blue-600"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{state}</span>
                            {earned
                              ? <span className="text-[10px] text-yellow-400">✓</span>
                              : <span className="text-[10px] opacity-60">{earnedCount}/{stateLocs.length}</span>
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {openSections.states && !isPro && (
                  <div className="px-4 pb-4 border-t border-blue-700/30 pt-3 space-y-3">
                    <div className="relative">
                      <div className="flex flex-wrap gap-1.5 blur-[3px] opacity-50 pointer-events-none select-none" aria-hidden="true">
                        {allStates.slice(0, 12).map((state) => {
                          const emoji = STATE_EMOJI[state] ?? "🏆";
                          return (
                            <div key={state} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-800/40 border border-blue-700/30 text-blue-600">
                              <span>{emoji}</span>
                              <span>{state}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full bg-gradient-to-br from-slate-900 to-blue-950 border border-cyan-600/50 rounded-xl p-3 text-left flex items-center gap-3 active:scale-[0.99] transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-xs">Collect state badges</p>
                        <p className="text-blue-400 text-[11px]">Plunge at every Chill Place in a state to earn its badge</p>
                      </div>
                      <span className="text-cyan-400 text-xs font-bold shrink-0">Unlock →</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ─── LEGAL SCREEN ─── */}
      {screen === "legal" && (
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="bg-blue-950/90 backdrop-blur-sm rounded-3xl p-5 border border-blue-800/50 space-y-4 min-h-full">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> Legal &amp; Safety
              </h2>
              <button
                data-testid="button-close-legal"
                onClick={() => navTo("timer")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
              >✕</button>
            </div>

            {/* Safety & Disclaimer */}
            <div className="bg-red-950/40 rounded-2xl border border-red-800/50">
              <button
                data-testid="button-toggle-safety"
                onClick={() => setSafetyOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span className="text-white font-semibold text-sm">Safety &amp; Disclaimer</span>
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
                    <span className="font-bold text-red-300">Featured Locations:</span> USA locations listed in Chill Places are spring-fed or managed facilities selected for relative safety and year-round access. Sliding Rock (NC) is listed as seasonal — lifeguards are only present May–Labor Day. Conditions at all locations can change without notice. Always check current local conditions before visiting. Never plunge alone.
                  </p>
                  <p className="text-red-200 text-xs leading-relaxed">
                    <span className="font-bold text-red-300">Calorie Estimates:</span> The kcal figures shown are rough estimates of <span className="italic">potential</span> additional calories burned via thermogenesis. They are calculated from duration, water temperature, and body weight using a simplified model and are <span className="font-bold text-red-300">not a precise measurement</span>. Do not use these figures for nutritional or medical decisions.
                  </p>
                  <p className="text-red-200/70 text-[10px] leading-relaxed">
                    ColdStreak and its developers accept no liability for injury, illness, or death resulting from cold plunge activities. Use this app at your own risk.
                  </p>
                </div>
              )}
            </div>

            {/* Community Locations */}
            <div className="bg-indigo-950/40 rounded-2xl border border-indigo-700/40">
              <button
                data-testid="button-toggle-community-disclaimer"
                onClick={() => setCommunityDisclaimerOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span className="text-white font-semibold text-sm">Community Locations</span>
                </div>
                <span className={`text-indigo-400 text-xs transition-transform duration-200 ${communityDisclaimerOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {communityDisclaimerOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-indigo-700/30 pt-3">
                  <p className="text-indigo-200 text-xs leading-relaxed">
                    <span className="font-bold text-indigo-300">Unverified Content:</span> Community Spots are submitted by users and have not been verified for safety, accuracy, or accessibility by ColdStreak.
                  </p>
                  <p className="text-indigo-200 text-xs leading-relaxed">
                    Cold water immersion carries serious risks. Conditions at any location can change without notice. Always assess conditions yourself, never plunge alone, and consult a physician if you have any heart, respiratory, or circulatory conditions.
                  </p>
                  <p className="text-indigo-200 text-xs leading-relaxed">
                    <span className="font-bold text-indigo-300">No Trespassing:</span> Always verify you have legal access to a location before visiting. Many natural bodies of water are on private property. Respect all posted signs and local laws. ColdStreak does not verify the legal accessibility of any community-submitted location.
                  </p>
                  <p className="text-indigo-200/60 text-[10px] leading-relaxed">
                    ColdStreak is not liable for any injury, loss, damages, or legal consequences arising from use of community-submitted locations.
                  </p>
                </div>
              )}
            </div>

            {/* Terms & Legal */}
            <div className="bg-blue-900/40 rounded-2xl border border-blue-700/40">
              <button
                data-testid="button-toggle-tos"
                onClick={() => setTosOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-semibold text-sm">Terms &amp; Legal</span>
                </div>
                <span className={`text-blue-400 text-xs transition-transform duration-200 ${tosOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {tosOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-blue-700/30 pt-3">
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Terms of Service</p>
                    <p className="text-blue-200 text-xs leading-relaxed">By using ColdStreak, you agree to these terms. ColdStreak is provided "as is" for personal health tracking purposes only. We reserve the right to modify or discontinue the service at any time. Continued use constitutes acceptance of any updated terms.</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Privacy Policy</p>
                    <p className="text-blue-200 text-xs leading-relaxed">ColdStreak stores your plunge history and settings locally on your device. Leaderboard entries store your display name and score on our servers. We do not sell or share your personal data with third parties.</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">No Medical Advice</p>
                    <p className="text-blue-200 text-xs leading-relaxed">Nothing in ColdStreak constitutes medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting any cold exposure regimen.</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Purchases &amp; Refunds</p>
                    <p className="text-blue-200 text-xs leading-relaxed">ColdStreak Pro is available as a Lifetime purchase ($19.99 introductory price, rising to $29.99 — non-refundable, yours forever) or a Monthly subscription ($3.99/mo, auto-renewing, cancel anytime). All sales are final except where required by applicable law. See our full Terms of Service for details.</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">Limitation of Liability</p>
                    <p className="text-blue-200 text-xs leading-relaxed">To the fullest extent permitted by law, ColdStreak and its developers shall not be liable for any indirect, incidental, special, or consequential damages arising from use of the app.</p>
                  </div>
                  <div>
                    <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">User-Submitted Content</p>
                    <p className="text-blue-200 text-xs leading-relaxed">By submitting a community spot or leaderboard entry, you confirm the information is accurate and grant ColdStreak a non-exclusive license to display it within the app.</p>
                  </div>
                  <p className="text-blue-500 text-[10px]">Last updated: March 2026. Questions? Email <a href="mailto:ColdStreakApp17@gmail.com" className="underline">ColdStreakApp17@gmail.com</a></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── BADGE DETAIL MODAL ─── */}
      {badgeDetailModal && (() => {
        if (badgeDetailModal.type === "days") {
          // ── Days-plunged badge detail ──
          const tier = DAYS_TIERS.find((t) => t.id === badgeDetailModal.tierId)!;
          const plungeList3 = plunges ?? [];
          const uniqueDays3 = new Set(plungeList3.map((p) => new Date(p.createdAt).toLocaleDateString())).size;
          const earned = uniqueDays3 >= tier.days;
          const remaining = Math.max(0, tier.days - uniqueDays3);
          const pct = Math.min(100, tier.days > 0 ? Math.round((uniqueDays3 / tier.days) * 100) : 100);

          return (
            <div className="fixed inset-0 z-40 flex items-end justify-center">
              <div className="absolute inset-0 bg-black/70" onClick={() => setBadgeDetailModal(null)} />
              <div
                data-testid="sheet-badge-detail"
                className="relative z-10 w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tier.emoji}</span>
                    <div>
                      <h3 className="text-white font-bold text-base leading-tight">{tier.label}</h3>
                      <p className="text-blue-400 text-xs">{tier.days === 365 ? "365+ days plunged" : `${tier.days} days plunged`}</p>
                    </div>
                  </div>
                  <button
                    data-testid="button-close-badge-detail"
                    onClick={() => setBadgeDetailModal(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                  >✕</button>
                </div>

                {/* Status */}
                <div className={`mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                  earned ? "bg-cyan-500/10 border-cyan-500/30" : "bg-blue-900/40 border-blue-800/40"
                }`}>
                  <span className="text-xl">{earned ? "✅" : "🔒"}</span>
                  <div>
                    <div className={`text-sm font-semibold ${earned ? "text-cyan-300" : "text-blue-400"}`}>
                      {earned ? "Badge Unlocked!" : "Not yet earned"}
                    </div>
                    <div className="text-blue-500 text-[11px]">
                      {earned
                        ? `You've plunged on ${uniqueDays3} unique day${uniqueDays3 !== 1 ? "s" : ""}`
                        : `${remaining} more day${remaining !== 1 ? "s" : ""} to go — you're at ${uniqueDays3}`}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {!earned && (
                  <div>
                    <div className="flex justify-between text-[11px] text-blue-500 mb-1">
                      <span>{uniqueDays3} days</span>
                      <span>{tier.days === 365 ? "365+ days" : `${tier.days} days`}</span>
                    </div>
                    <div className="h-2 bg-blue-900/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-center text-blue-500 text-[11px] mt-2">{pct}% there</div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        const isTempTier = badgeDetailModal.type === "temp-tier";

        if (isTempTier) {
          // ── Temperature-tier badge detail ──
          const tierId = (badgeDetailModal as { type: "temp-tier"; tierId: string }).tierId;
          const tier = TEMP_TIERS.find((t) => t.id === tierId)!;
          const plungeList2 = plunges ?? [];
          // Recompute cascade: a harder (colder) tier unlocks all warmer tiers
          const orderedTiers2 = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
          const earnedTempTierIds2 = new Set<string>();
          let cascade2 = false;
          for (const t of orderedTiers2) {
            if (!cascade2) cascade2 = plungeList2.some((p) => p.temperature >= t.minTemp && p.temperature <= t.maxTemp);
            if (cascade2) earnedTempTierIds2.add(t.id);
          }
          const earned = earnedTempTierIds2.has(tier.id);
          // Find which harder tier triggered the cascade (if any)
          const matchingPlunges = plungeList2.filter(
            (p) => p.temperature >= tier.minTemp && p.temperature <= tier.maxTemp
          );
          const cascadeSource = earned && matchingPlunges.length === 0
            ? orderedTiers2.find((t) => plungeList2.some((p) => p.temperature >= t.minTemp && p.temperature <= t.maxTemp))
            : null;

          return (
            <div className="fixed inset-0 z-40 flex items-end justify-center">
              <div className="absolute inset-0 bg-black/70" onClick={() => setBadgeDetailModal(null)} />
              <div
                data-testid="sheet-badge-detail"
                className="relative z-10 w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[82vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tier.emoji}</span>
                    <div>
                      <h3 className="text-white font-bold text-base leading-tight">{tier.label}</h3>
                      <p className="text-blue-400 text-xs">{tier.minTemp === 0 ? "≤32°F" : `${tier.maxTemp}–${tier.minTemp}°F`} · {tier.description}</p>
                    </div>
                  </div>
                  <button
                    data-testid="button-close-badge-detail"
                    onClick={() => setBadgeDetailModal(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                  >✕</button>
                </div>

                {/* Status */}
                <div className={`shrink-0 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                  earned
                    ? "bg-cyan-500/10 border-cyan-500/30"
                    : "bg-blue-900/40 border-blue-800/40"
                }`}>
                  <span className="text-xl">{earned ? "✅" : "🔒"}</span>
                  <div>
                    <div className={`text-sm font-semibold ${earned ? "text-cyan-300" : "text-blue-400"}`}>
                      {earned ? "Badge Unlocked!" : "Not yet earned"}
                    </div>
                    <div className="text-blue-500 text-[11px]">
                      {earned && cascadeSource
                        ? `Unlocked by achieving ${cascadeSource.emoji} ${cascadeSource.label}`
                        : earned
                        ? `${matchingPlunges.length} plunge${matchingPlunges.length > 1 ? "s" : ""} logged in this range`
                        : `Log a plunge at ${tier.minTemp === 0 ? "32°F or below" : `${tier.maxTemp}–${tier.minTemp}°F`} to unlock`}
                    </div>
                  </div>
                </div>

                {!earned && (
                  <div className="shrink-0 text-center text-blue-500 text-[11px] mt-2">
                    Log a plunge and enter a temperature of {tier.minTemp === 0 ? "32°F or below" : `${tier.maxTemp}–${tier.minTemp}°F`} to earn this badge
                  </div>
                )}
              </div>
            </div>
          );
        }

        // ── State badge detail ──
        const state = (badgeDetailModal as { type: "state"; state: string }).state;
        const locs = PASSPORT_LOCATIONS.filter((l) => l.state === state);
        const earnedCount = locs.filter((l) => badges.has(l.id)).length;
        const allEarned = earnedCount === locs.length;
        const progressPct = locs.length > 0 ? Math.round((earnedCount / locs.length) * 100) : 0;
        const stateEmoji = STATE_EMOJI[state] ?? "🏆";

        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setBadgeDetailModal(null)} />
            <div
              data-testid="sheet-badge-detail"
              className="relative z-10 w-full max-w-lg bg-blue-950 border border-blue-700/60 rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[82vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{stateEmoji}</span>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">{state}</h3>
                    <p className="text-blue-400 text-xs">Complete all {locs.length} {state} spot{locs.length > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <button
                  data-testid="button-close-badge-detail"
                  onClick={() => setBadgeDetailModal(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                >✕</button>
              </div>

              {/* Progress bar */}
              <div className="shrink-0 mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-blue-400">{earnedCount} of {locs.length} completed</span>
                  {allEarned
                    ? <span className="text-xs font-semibold text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 rounded-full">Badge Unlocked!</span>
                    : <span className="text-xs text-blue-400">{progressPct}%</span>
                  }
                </div>
                <div className="h-2 bg-blue-900/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${allEarned ? "bg-cyan-400" : "bg-blue-500"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Location list */}
              <div className="overflow-y-auto flex-1 space-y-2">
                {locs.map((loc) => {
                  const locEarned = badges.has(loc.id);
                  const diffMeta = DIFFICULTY_META[loc.difficulty];
                  return (
                    <div
                      key={loc.id}
                      data-testid={`badge-detail-loc-${loc.id}`}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        locEarned
                          ? "bg-cyan-500/10 border-cyan-500/30"
                          : "bg-blue-900/40 border-blue-800/40 opacity-60"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        locEarned ? "bg-cyan-500/30 text-cyan-300" : "bg-blue-800/60 text-blue-600"
                      }`}>
                        {locEarned ? "✓" : "○"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-semibold leading-tight truncate">{loc.name}</div>
                        <div className="text-blue-400 text-[11px] truncate">
                          {diffMeta.emoji} {diffMeta.label} · {loc.tempRange}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {locEarned && (
                          <span className="text-[10px] text-cyan-400 font-semibold">Plunged!</span>
                        )}
                        <button
                          data-testid={`button-directions-${loc.id}`}
                          onClick={(e) => { e.stopPropagation(); openDirections(loc.lat, loc.lng); }}
                          title="Get directions"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all active:scale-95"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!allEarned && (
                <div className="shrink-0 mt-4 text-center text-blue-500 text-[11px]">
                  Log a plunge at an official Chill Place to earn credit
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── LEADERBOARD MODAL ─── */}
      {leaderboardLocationId && (() => {
        const passportLoc = PASSPORT_LOCATIONS.find((l) => l.id === leaderboardLocationId);
        const isCommunity = leaderboardLocationId.startsWith("community-");
        const displayFlag = passportLoc?.flag ?? "📍";
        const displayName = leaderboardLocName || passportLoc?.name || leaderboardLocationId;
        const displaySub = passportLoc?.tempRange ?? (isCommunity ? "Community spot" : "");
        const communityLocEntry = isCommunity
          ? communityLocs.find((l) => l.id === Number(leaderboardLocationId.replace("community-", "")))
          : null;
        const dirLat = passportLoc?.lat ?? (communityLocEntry?.latitude ? Number(communityLocEntry.latitude) : null);
        const dirLng = passportLoc?.lng ?? (communityLocEntry?.longitude ? Number(communityLocEntry.longitude) : null);
        const resolvedFlag = communityLocEntry?.isBusiness ? "🏢" : (passportLoc?.flag ?? "📍");
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
                  <span className="text-3xl">{resolvedFlag}</span>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">
                      {displayName}
                      {communityLocEntry?.isBusiness && (
                        <Building2 className="inline w-3.5 h-3.5 ml-1.5 text-amber-400 align-middle" />
                      )}
                    </h3>
                    <p className="text-blue-400 text-xs">{communityLocEntry?.isBusiness ? "Business · Cold Plunge Spot" : displaySub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dirLat !== null && dirLng !== null && (
                    <button
                      data-testid="button-directions-leaderboard"
                      onClick={() => openDirections(dirLat!, dirLng!)}
                      title="Get directions"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200 transition-all active:scale-95 text-xs font-semibold"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Directions
                    </button>
                  )}
                  <button
                    data-testid="button-close-leaderboard"
                    onClick={() => setLeaderboardLocationId(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
                  >✕</button>
                </div>
              </div>

              {/* Title */}
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-semibold text-sm">Top Plungers</span>
                {!isCommunity && hasBadge(leaderboardLocationId) && (
                  <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full font-semibold">You've been here!</span>
                )}
              </div>

              {/* Verification legend */}
              <div className="mb-3 px-1 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-blue-500 text-[10px] font-medium uppercase tracking-wide">Verification:</span>
                  {[
                    { key: "timer",    label: "⏱ Timer",    cls: "bg-blue-500/20 border-blue-400/40 text-blue-300",    desc: "App-recorded duration" },
                    { key: "photo",    label: "📸 Photo",    cls: "bg-cyan-500/20 border-cyan-400/40 text-cyan-300",    desc: "Photo taken during session" },
                    { key: "two",      label: "✓ Verified",  cls: "bg-slate-400/20 border-slate-300/40 text-slate-200", desc: "Any 2 of: timer, photo, GPS" },
                    { key: "verified", label: "✓ Verified",  cls: "bg-yellow-500/20 border-yellow-400/40 text-yellow-200", desc: "All 3: timer + photo + GPS" },
                  ].map(({ key, label, cls, desc }) => (
                    <button
                      key={key}
                      onClick={() => setLegendTip(legendTip === key ? null : key)}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border transition-opacity ${cls} ${legendTip && legendTip !== key ? "opacity-40" : "opacity-100"}`}
                    >{label}</button>
                  ))}
                </div>
                {legendTip && (
                  <p className="text-[10px] mt-1.5 text-blue-300 pl-1">
                    {{ timer: "⏱ Timer — App-recorded duration", photo: "📸 Photo — Photo taken during session", two: "✓ Verified (silver) — Any 2 of: timer, photo, GPS", verified: "✓ Verified (gold) — All 3: timer + photo + GPS" }[legendTip]}
                  </p>
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
                              <button
                                data-testid={`link-profile-${entry.username}`}
                                onClick={() => window.open(`/profile/${encodeURIComponent(entry.username)}`, "_blank")}
                                className="text-white font-semibold text-sm truncate hover:text-cyan-300 transition-colors active:scale-95"
                              >{entry.username}</button>
                              {(entry as LeaderboardEntryWithBadge).foundingPlunger && (
                                <span
                                  data-testid={`badge-founding-${entry.username}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold leading-none shrink-0"
                                  title="Founding Plunger"
                                >🎖️ Founder</span>
                              )}
                              {isMyEntry && StreakBadge}
                              {isMyEntry && !streak && DaysBadge}
                              {isMyEntry && featuredBadgeIds.length > 0 && (() => {
                                const lookup: Record<string, string> = {};
                                TEMP_TIERS.forEach(t => { lookup[t.id] = t.emoji; });
                                DAYS_TIERS.forEach(t => { lookup[t.id] = t.emoji; });
                                Object.entries(STATE_EMOJI).forEach(([s, e]) => { lookup[s] = e as string; });
                                return (
                                  <span className="text-base leading-none tracking-tight shrink-0">
                                    {featuredBadgeIds.map(id => lookup[id] ?? "").join("")}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-blue-400 text-xs">
                                {Math.floor(entry.duration / 60)}:{String(entry.duration % 60).padStart(2, "0")} · {entry.temperature}°F
                              </span>
                              {(() => {
                                const vl = entry.verificationLevel ?? 0;
                                const gps = entry.locationVerified;
                                if (vl === 0) return null;
                                // All three: GPS + timer + photo → purple "✓ Verified"
                                if (gps && vl === 3) {
                                  return (
                                    <span
                                      data-testid={`badge-verified-${entry.id}`}
                                      title="GPS + Timer + Photo Verified"
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border bg-yellow-500/20 border-yellow-400/40 text-yellow-200 shrink-0"
                                    >✓ Verified</span>
                                  );
                                }
                                // Any two tiers → green "✓ Verified"
                                const twoTiers = vl === 3 || (gps && vl >= 1);
                                if (twoTiers) {
                                  const title = vl === 3 ? "Timer + Photo" : gps && vl === 2 ? "Photo + GPS" : "Timer + GPS";
                                  return (
                                    <span
                                      data-testid={`badge-verified-${entry.id}`}
                                      title={title}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border bg-slate-400/20 border-slate-300/40 text-slate-200 shrink-0"
                                    >✓ Verified</span>
                                  );
                                }
                                // Photo only → cyan "📸"
                                if (vl === 2) {
                                  return (
                                    <span
                                      data-testid={`badge-verified-${entry.id}`}
                                      title="Photo"
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shrink-0"
                                    >📸</span>
                                  );
                                }
                                // Timer only → blue "⏱"
                                return (
                                  <span
                                    data-testid={`badge-verified-${entry.id}`}
                                    title="Timer"
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border bg-blue-500/20 border-blue-400/40 text-blue-300 shrink-0"
                                  >⏱</span>
                                );
                              })()}
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

            {/* Hidden web fallback input */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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

            {/* Photo preview or take-photo button */}
            {promptPhotoData ? (
              <div className="relative w-full rounded-2xl overflow-hidden border-2 border-cyan-500/60">
                <img src={promptPhotoData} alt="Preview" className="w-full h-40 object-cover" />
                <button
                  onClick={() => setPromptPhotoData(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-red-600/80 transition-colors"
                >Remove</button>
              </div>
            ) : (
              <button
                data-testid="button-take-photo"
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) {
                    try {
                      await CapCamera.requestPermissions({ permissions: ["camera"] });
                      const photo = await CapCamera.getPhoto({
                        resultType: CameraResultType.Base64,
                        source: CameraSource.Camera,
                        quality: 70,
                        width: 1000,
                        correctOrientation: true,
                      });
                      if (photo.base64String) {
                        const mime = photo.format === "png" ? "image/png" : "image/jpeg";
                        setPromptPhotoData(`data:${mime};base64,${photo.base64String}`);
                      }
                    } catch (err: any) {
                      const msg = String(err ?? "");
                      if (!msg.includes("cancel") && !msg.includes("dismiss") && !msg.includes("User cancelled")) {
                        toast({ title: "Camera error", description: msg || "Could not open camera", variant: "destructive" });
                      }
                    }
                  } else {
                    await startWebCamera();
                  }
                }}
                className="w-full flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-blue-600/50 hover:border-cyan-500/50 py-8 transition-all"
              >
                <Camera className="w-8 h-8 text-cyan-400" />
                <span className="text-blue-300 text-sm font-semibold">Take Photo</span>
              </button>
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
                {gpsLocationLoading && <option value="gps" disabled>📍 Detecting GPS location…</option>}
                {gpsLocationName && <option value="gps">📍 {gpsLocationName}</option>}
                <option value="home">🏠 Home</option>
                {privateLocs.length > 0 && (
                  <optgroup label="My Spots">
                    {privateLocs.map((l) => (
                      <option key={l.id} value={l.id}>🔒 {l.name}</option>
                    ))}
                  </optgroup>
                )}
                {communityLocs.length > 0 && (
                  <optgroup label="Community Spots">
                    {communityLocs.map((l) => (
                      <option key={`community-${l.id}`} value={`community-${l.id}`}>{l.isBusiness ? "🏢" : "📍"} {l.name}{l.city ? `, ${l.city}` : ""}{l.state ? `, ${l.state}` : ""}</option>
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

              {promptLocationId === "home" && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
                  <div className="text-xs text-blue-300 leading-relaxed">
                    <span className="font-semibold text-cyan-300">🏠 {homeLabel}</span>
                    {" — "}Private. Shows as "Home" when shared with friends.
                  </div>
                </div>
              )}

              {promptLocationId === "gps" && gpsLocationName && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40 space-y-2">
                  <div className="text-xs text-blue-300 leading-relaxed">
                    <span className="font-semibold text-cyan-300">📍 {gpsLocationName}</span>
                    {" — "}City/state only. No exact address shared.
                  </div>
                  {!savePrivateOpen ? (
                    <button
                      data-testid="button-save-private-hint"
                      onClick={() => { setSavePrivateOpen(true); setSavePrivateName(gpsLocationName); }}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      🔒 Save to my private spots
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        data-testid="input-private-loc-name"
                        type="text"
                        value={savePrivateName}
                        onChange={(e) => setSavePrivateName(e.target.value)}
                        placeholder="Name this spot…"
                        className="flex-1 bg-blue-800/60 border border-blue-600 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        data-testid="button-confirm-save-private"
                        onClick={() => {
                          const name = savePrivateName.trim() || gpsLocationName;
                          const id = `private-${Date.now()}`;
                          const updated = [...privateLocs, { id, name }];
                          setPrivateLocs(updated);
                          localStorage.setItem("coldstreak-private-locs", JSON.stringify(updated));
                          setPromptLocationId(id);
                          setSavePrivateOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/80 text-blue-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
                      >Save</button>
                      <button
                        onClick={() => setSavePrivateOpen(false)}
                        className="text-blue-500 text-xs hover:text-blue-300 transition-colors"
                      >✕</button>
                    </div>
                  )}
                </div>
              )}

              {promptLocationId.startsWith("private-") && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
                  <div className="text-xs text-blue-300 leading-relaxed">
                    <span className="font-semibold text-cyan-300">🔒 {privateLocs.find(l => l.id === promptLocationId)?.name ?? "Private Spot"}</span>
                    {" — "}Saved to your spots only. Never shared publicly.
                  </div>
                </div>
              )}

              {promptLocationId && promptLocationId !== "custom" && promptLocationId !== "home" && promptLocationId !== "gps" && !promptLocationId.startsWith("private-") && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
                  {(() => {
                    if (promptLocationId.startsWith("community-")) {
                      const cid = Number(promptLocationId.replace("community-", ""));
                      const cloc = communityLocs.find((l) => l.id === cid);
                      const cLat = cloc?.latitude ? Number(cloc.latitude) : null;
                      const cLng = cloc?.longitude ? Number(cloc.longitude) : null;
                      return (
                        <div className="space-y-1.5">
                          <div className="text-xs text-blue-300 leading-relaxed flex items-center gap-1.5 flex-wrap">
                            {cloc?.isBusiness
                              ? <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                              : <span>📍</span>
                            }
                            <span className="font-semibold text-cyan-300">{cloc?.name ?? "Community Spot"}</span>
                            {cloc?.isBusiness && <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-semibold">Business</span>}
                            {cloc?.description ? <span>— {cloc.description}</span> : ""}
                          </div>
                          <div className="flex items-center gap-3">
                            {cLat !== null && cLng !== null && (
                              <button
                                data-testid="button-directions-popup-community"
                                onClick={() => openDirections(cLat, cLng)}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                <Navigation className="w-3 h-3" />
                                Get Directions
                              </button>
                            )}
                            {cloc?.isBusiness && cloc.websiteUrl && (
                              <a
                                href={cloc.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid="link-business-website"
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                              >
                                🌐 Website
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    }
                    const loc = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId);
                    if (!loc) return null;
                    return (
                      <div className="space-y-1.5">
                        <div className="text-xs text-blue-300 leading-relaxed">
                          <span className="font-semibold text-cyan-300">{loc.flag} {loc.name}</span>
                          {" — "}{loc.safetyNote}
                        </div>
                        <button
                          data-testid="button-directions-popup-passport"
                          onClick={() => openDirections(loc.lat, loc.lng)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <Navigation className="w-3 h-3" />
                          Get Directions
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Leaderboard submission toggle — only for passport/community locations, not home/gps/private */}
            {promptLocationId && promptLocationId !== "custom" && promptLocationId !== "home" && promptLocationId !== "gps" && !promptLocationId.startsWith("private-") && (
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
              disabled={promptSaving}
              onClick={async () => {
                if (!photoPromptId) return;
                const isCommunityPick = promptLocationId.startsWith("community-");
                const isHomePick = promptLocationId === "home";
                const isPrivatePick = promptLocationId.startsWith("private-");
                let finalLocationId: string | undefined = promptLocationId && promptLocationId !== "custom" && promptLocationId !== "gps" && !isPrivatePick ? promptLocationId : undefined;
                let finalLocationName: string | undefined;
                if (isHomePick) {
                  finalLocationName = homeLabel;
                } else if (promptLocationId === "gps") {
                  finalLocationName = gpsLocationName ?? undefined;
                } else if (isPrivatePick) {
                  finalLocationName = privateLocs.find((l) => l.id === promptLocationId)?.name;
                } else if (promptLocationId === "custom") {
                  finalLocationName = promptCustomLocation.trim() || undefined;
                } else if (isCommunityPick) {
                  const cid = Number(promptLocationId.replace("community-", ""));
                  finalLocationName = communityLocs.find((l) => l.id === cid)?.name;
                } else if (promptLocationId) {
                  finalLocationName = PASSPORT_LOCATIONS.find((l) => l.id === promptLocationId)?.name;
                }

                if (!finalLocationName) {
                  finalLocationName = gpsLocationName ?? homeLabel ?? "Home";
                  finalLocationId = gpsLocationName ? undefined : "home";
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
                      if (promptPhotoData && photoPromptId && promptPlungeRef.current) {
                        try {
                          const composited = await buildShareImage({
                            photoDataUrl: promptPhotoData,
                            temperature: promptPlungeRef.current.temperature,
                            duration: promptPlungeRef.current.duration,
                            streak,
                            locationName: finalLocationName,
                            locationId: finalLocationId,
                            score: promptPlungeRef.current.score ?? undefined,
                          });
                          await savePhoto(photoPromptId, composited).catch(() => {});
                          // Also persist to server so photo survives app updates
                          updatePlunge.mutate({ id: photoPromptId, patch: { photoData: composited } });
                        } catch {
                          await savePhoto(photoPromptId, promptPhotoData).catch(() => {});
                          updatePlunge.mutate({ id: photoPromptId, patch: { photoData: promptPhotoData } });
                        }
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
                        const { score, duration, temperature: temp, timerUsed } = promptPlungeRef.current;
                        const hasPhoto = !!promptPhotoData;
                        const verificationLevel =
                          timerUsed && hasPhoto ? 3 :
                          hasPhoto ? 2 :
                          timerUsed ? 1 : 0;

                        // ── GPS location check (non-blocking, 5s timeout, 5-mile radius) ──
                        let locationVerified = false;
                        if (finalLocationId !== "home") {
                          // Resolve target lat/lng from passport or community location
                          const passportMatch = PASSPORT_LOCATIONS.find((l) => l.id === finalLocationId);
                          let targetLat: number | null = passportMatch?.lat ?? null;
                          let targetLng: number | null = passportMatch?.lng ?? null;
                          if (!targetLat && finalLocationId.startsWith("community-")) {
                            const cid = Number(finalLocationId.replace("community-", ""));
                            const cl = communityLocs.find((l) => l.id === cid);
                            targetLat = cl?.latitude ? Number(cl.latitude) : null;
                            targetLng = cl?.longitude ? Number(cl.longitude) : null;
                          }
                          if (targetLat !== null && targetLng !== null) {
                            try {
                              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                                const tid = setTimeout(() => reject(new Error("timeout")), 5000);
                                navigator.geolocation?.getCurrentPosition(
                                  (p) => { clearTimeout(tid); resolve(p); },
                                  (e) => { clearTimeout(tid); reject(e); },
                                  { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                                );
                              });
                              const miles = distanceMiles(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
                              locationVerified = miles <= 5;
                            } catch { /* GPS unavailable or timed out — skip silently */ }
                          }
                        }

                        submitLeaderboard.mutate({
                          locationId: finalLocationId,
                          username: username.trim(),
                          score,
                          duration,
                          temperature: temp,
                          verificationLevel,
                          hasPhoto,
                          locationVerified,
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
                disabled={promptSharing}
                onClick={async () => {
                  // Synchronous ref lock — prevents double-fire before React re-renders
                  if (!promptPlungeRef.current || sharingLockRef.current) return;
                  sharingLockRef.current = true;
                  setPromptSharing(true);
                  let doneCalled = false;
                  const done = () => { if (doneCalled) return; doneCalled = true; sharingLockRef.current = false; setPromptSharing(false); };

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
                    locationId: promptLocationId,
                  });

                  // ── Native Android/iOS: use Capacitor Share (avoids WebView doubling bug)
                  if (isNative()) {
                    await nativeShare({ text });
                    done(); return;
                  }

                  // ── Web browser: use navigator.share (no title — prevents iOS iMessage subject bubble)
                  if (navigator.share) {
                    try {
                      await navigator.share({ text });
                      done(); return;
                    } catch (e: any) {
                      if (e?.name === "AbortError") { done(); return; }
                    }
                  }

                  // ── Clipboard fallback
                  try {
                    await navigator.clipboard.writeText(text);
                    toast({ title: "Copied!", description: "Paste to share with friends." });
                  } catch {
                    toast({ title: "Could not copy", variant: "destructive" });
                  }
                  done();
                }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-blue-600/60 text-sm font-semibold transition-all active:scale-95 ${promptSharing ? "opacity-50 cursor-not-allowed text-blue-500" : "text-blue-300 hover:border-cyan-500/60 hover:text-cyan-300"}`}
              >
                <Share2 className="w-4 h-4" /> {promptSharing ? "Sharing…" : "Share with friends"}
              </button>
            )}

            {/* Discard */}
            <button
              data-testid="button-discard-plunge"
              onClick={() => {
                if (!photoPromptId) return;
                deletePlunge.mutate(photoPromptId, {
                  onSuccess: () => {
                    toast({ title: "Plunge discarded", description: "Nothing was saved." });
                  },
                });
                setPhotoPromptId(null);
              }}
              className="w-full py-2 text-red-400/70 hover:text-red-300 text-xs font-semibold transition-colors"
            >
              Discard plunge
            </button>
          </div>
        </div>
      )}

      {/* ─── WEB CAMERA OVERLAY ─── */}
      {showWebCamera && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <video
            ref={webVideoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 w-full object-cover"
          />
          <div className="flex items-center justify-around p-6 bg-black">
            <button
              onClick={stopWebCamera}
              className="text-white/70 text-sm font-semibold px-6 py-3"
            >Cancel</button>
            <button
              onClick={captureWebPhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-cyan-400 shadow-lg shadow-cyan-400/40 active:scale-95 transition-transform"
            />
            <div className="w-20" />
          </div>
        </div>
      )}

      {/* ─── FIRST-LAUNCH LIABILITY MODAL ─── */}
      {!legalAgreed && (
        <div className="fixed inset-0 z-[80] bg-blue-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <ShieldAlert className="w-10 h-10 text-red-400 mb-3 shrink-0" />
          <h2 className="text-white font-bold text-xl mb-1 text-center">Safety Agreement</h2>
          <p className="text-blue-400 text-xs mb-4 text-center">Please read and agree before using ColdStreak</p>
          <div className="bg-red-950/50 rounded-2xl border border-red-800/50 p-4 space-y-3 w-full max-w-md max-h-[45vh] overflow-y-auto mb-5">
            <p className="text-red-200 text-xs leading-relaxed">
              <span className="font-bold text-red-300">ASSUMPTION OF RISK:</span> Cold water immersion carries serious health risks including cold water shock, cardiac arrest, hypothermia, loss of consciousness, and drowning. By using ColdStreak, you voluntarily assume all risks associated with cold plunge activities.
            </p>
            <p className="text-red-200 text-xs leading-relaxed">
              ColdStreak is a <span className="font-bold">tracking tool only</span> — not medical advice. Consult a physician before beginning cold exposure therapy, especially if you have heart conditions, high blood pressure, Raynaud's disease, or are pregnant.
            </p>
            <p className="text-red-200 text-xs leading-relaxed">
              Never plunge alone. Always assess water conditions before entering. Stop immediately if you experience pain, numbness, difficulty breathing, or loss of muscle control.
            </p>
            <p className="text-red-200/70 text-[10px] leading-relaxed">
              ColdStreak and its developers accept no liability for injury, illness, or death resulting from cold plunge activities. Use this app at your own risk.
            </p>
          </div>
          <label className="flex items-start gap-3 mb-5 cursor-pointer w-full max-w-md">
            <input
              data-testid="checkbox-legal-agree"
              type="checkbox"
              checked={legalCheckbox}
              onChange={(e) => setLegalCheckbox(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-cyan-400 shrink-0"
            />
            <span className="text-blue-200 text-sm leading-relaxed">
              I understand that cold water immersion carries serious risks and I voluntarily assume all risks associated with using ColdStreak.
            </span>
          </label>
          <button
            data-testid="button-legal-agree"
            disabled={!legalCheckbox}
            onClick={() => {
              localStorage.setItem("coldstreak-legal-agreed", "true");
              localStorage.setItem("coldstreak-safety-seen", "true");
              setLegalAgreed(true);
            }}
            className="w-full max-w-md py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-base transition-all active:scale-[0.98]"
          >
            I Agree — Continue to ColdStreak
          </button>
        </div>
      )}

      {/* ─── ACTIVE TIMER OVERLAY ─── */}
      {isActive && isPro && screen === "timer" && (
        <div
          className="fixed inset-0 z-[60] bg-blue-950/98 backdrop-blur-md flex flex-col items-center justify-center gap-8 transition-all duration-300 animate-in fade-in"
        >
          {/* Mode label */}
          <div className="text-blue-400 text-xs font-semibold uppercase tracking-widest -mb-4">
            {countdownMode ? "Countdown" : "Stopwatch"}
          </div>

          {/* Giant time */}
          <div
            className="font-mono font-bold text-white leading-none"
            style={{ fontSize: isLandscape ? "18vw" : "28vw" }}
            data-testid="display-timer-overlay"
          >
            {formatTime(displaySeconds)}
          </div>

          {/* Temp + live score row */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">Water Temp</div>
              <div className="text-white text-2xl font-bold">{tempDisplay}</div>
            </div>
            <div className="w-px h-8 bg-blue-700/50" />
            <div className="text-center">
              <div className="text-blue-400 text-xs uppercase tracking-widest mb-0.5">Cold Score</div>
              <div className="text-cyan-300 text-2xl font-bold">{displayScore}</div>
            </div>
          </div>

          {/* Stop button */}
          <button
            data-testid="button-stop-overlay"
            onClick={handleStop}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-20 py-4 rounded-2xl text-xl transition-all active:scale-95 shadow-lg shadow-blue-600/30"
          >
            Stop
          </button>
        </div>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/90 backdrop-blur-md border-t border-blue-800/60">
        <div className="flex items-center h-full max-w-xl mx-auto px-2">
          {/* History */}
          <button
            data-testid="nav-history"
            onClick={() => navTo("history")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "history" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-semibold">History</span>
          </button>

          {/* Explore */}
          <button
            data-testid="nav-explore"
            onClick={() => navTo("explore")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "explore" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Explore</span>
          </button>

          {/* Gear — center */}
          <button
            data-testid="nav-gear"
            onClick={() => navTo("gear")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "gear" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Gear</span>
          </button>

          {/* Achievements */}
          <button
            data-testid="nav-achievements"
            onClick={() => navTo("achievements")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "achievements" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Badges</span>
          </button>

          {/* Devices */}
          <button
            data-testid="nav-devices"
            onClick={() => navTo("devices")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors relative ${screen === "devices" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <div className="relative">
              <Bluetooth className="w-5 h-5" />
              {(btConnected || hrConnected) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-blue-950" />
              )}
            </div>
            <span className="text-[10px] font-semibold">Devices</span>
          </button>

          {/* Settings */}
          <button
            data-testid="nav-settings"
            onClick={() => navTo("settings")}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${screen === "settings" ? "text-white" : "text-blue-500 hover:text-blue-300"}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Settings</span>
          </button>
        </div>
      </div>

      {/* ─── STREAK NOTIFICATION BANNER ─── */}
      {screen === "timer" && streak > 0 && notifPermission === "default" && !notifDismissed && (
        <div
          className="fixed left-0 right-0 px-3"
          style={{ bottom: "84px", zIndex: 31 }}
        >
          <div className="flex items-center gap-2 bg-yellow-900/40 border border-yellow-600/30 rounded-xl px-3 py-2.5">
            <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-yellow-200 text-xs font-semibold">Protect your {streak}-day streak 🔥</p>
              <p className="text-yellow-500/80 text-[10px]">Get a daily reminder if you forget to plunge</p>
            </div>
            <button
              data-testid="button-enable-notifications"
              onClick={enableNotifications}
              className="text-yellow-300 text-xs font-semibold px-2.5 py-1 bg-yellow-700/40 rounded-lg border border-yellow-600/30 shrink-0"
            >Enable</button>
            <button
              data-testid="button-dismiss-notifications"
              onClick={() => { setNotifDismissed(true); localStorage.setItem("coldstreak-notif-dismissed", "1"); }}
              className="text-yellow-600 text-xs px-1 shrink-0"
            >✕</button>
          </div>
        </div>
      )}


      {/* ─── POST-SESSION AD ─── */}
      {showPostSessionAd && !isPro && !!auth.user && (
        <InterstitialAd
          adIndex={plunges.length % 3}
          onDismiss={() => setShowPostSessionAd(false)}
        />
      )}

      {/* ─── POST-CHECKOUT RESTORE PROMPT (native app return from Stripe) ─── */}
      {pendingRestoreEmail !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-5">
          <div className="w-full max-w-sm bg-gradient-to-b from-blue-950 to-slate-950 rounded-3xl border border-blue-700/50 shadow-2xl p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-3xl">🎉</div>
              <h2 className="text-white font-bold text-lg">Confirm your purchase</h2>
              <p className="text-blue-300/80 text-sm">Enter the email you used at checkout to activate Pro.</p>
            </div>
            <input
              data-testid="input-restore-email"
              type="email"
              value={pendingRestoreEmail}
              onChange={e => setPendingRestoreEmail(e.target.value)}
              placeholder="Email used at Stripe checkout"
              className="w-full rounded-xl bg-blue-900/50 border border-blue-700/50 text-white placeholder-blue-500 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500"
            />
            <button
              data-testid="button-confirm-restore"
              disabled={proLoading || !pendingRestoreEmail.includes("@")}
              onClick={async () => {
                const result = await restorePurchase(pendingRestoreEmail);
                if (result.success) {
                  toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "All Pro features are now unlocked." });
                  setPendingRestoreEmail(null);
                } else {
                  toast({ title: "Not found", description: "No Pro account found for that email. Check the address and try again.", variant: "destructive" });
                }
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {proLoading ? "Checking…" : "Activate Pro"}
            </button>
            <button
              onClick={() => setPendingRestoreEmail(null)}
              className="w-full text-blue-500/60 text-xs hover:text-blue-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

            {fpCountData && fpCountData.remaining > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
                <span className="text-xl">🎖️</span>
                <div>
                  <div className="text-amber-300 font-bold text-sm leading-tight">Early Adopter Special — Founding Plunger</div>
                  <div className="text-amber-200/70 text-xs">
                    {fpCountData.remaining < 50
                      ? `Only ${fpCountData.remaining} spots remaining!`
                      : `${fpCountData.remaining} of ${fpCountData.limit} spots remaining`}
                    {" "}· Exclusive badge on your profile & leaderboard
                  </div>
                </div>
              </div>
            )}

            <ul className="space-y-2 mb-1">
              {[
                { icon: "📅", text: "Unlimited plunge history" },
                { icon: "🗺️", text: "Chill Places — earn badges at iconic locations" },
                { icon: "🏆", text: "Per-location leaderboards" },
                { icon: "📈", text: "Advanced stats & personal bests" },
                { icon: "📤", text: "CSV & Apple Health export" },
                { icon: "🚫", text: "No ads, ever" },
                ...(fpCountData && fpCountData.remaining > 0
                  ? [{ icon: "🎖️", text: "Founding Plunger badge — exclusive to first 1,000 buyers" }]
                  : []),
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white text-sm">
                  <span className="text-lg w-7 shrink-0 text-center">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>

            {/* Pricing options */}
            {(proPlan === "monthly" || proPlan === "annual") ? (
              <div className="rounded-2xl border border-yellow-500/60 bg-yellow-900/20 p-4 text-center space-y-1 relative">
                {lifetimePhase === 1 && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">Early Adopter</div>
                )}
                <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Lifetime</div>
                <div className="text-3xl font-black text-white">${lifetimePrice.toFixed(2)}</div>
                <div className="text-yellow-300 text-xs">pay once, keep forever — cancel your subscription</div>
                {lifetimeNextPrice && (
                  <div className="text-amber-400 text-[10px] font-semibold">intro price — rising to ${lifetimeNextPrice.toFixed(2)}</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-cyan-500/60 bg-cyan-900/20 p-3 text-center space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Monthly</div>
                  <div className="text-2xl font-black text-white">$3.99</div>
                  <div className="text-cyan-300 text-xs">per month</div>
                  <div className="text-slate-400 text-[10px]">cancel anytime</div>
                </div>
                <div className="rounded-2xl border border-yellow-500/60 bg-yellow-900/20 p-3 text-center space-y-1 relative">
                  {lifetimePhase === 1 && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">Early Adopter</div>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Lifetime</div>
                  <div className="text-2xl font-black text-white">${lifetimePrice.toFixed(2)}</div>
                  <div className="text-yellow-300 text-xs">pay once, keep forever</div>
                  {lifetimeNextPrice && (
                    <div className="text-amber-400 text-[10px] font-semibold">intro price — rising to ${lifetimeNextPrice.toFixed(2)}</div>
                  )}
                </div>
              </div>
            )}

            <div className={(proPlan === "monthly" || proPlan === "annual") ? "" : "grid grid-cols-2 gap-3"}>
              {!(proPlan === "monthly" || proPlan === "annual") && (
              <button
                data-testid="button-checkout-monthly"
                onClick={async () => {
                  Analytics.proUpgradeStarted();
                  setShowUpgradeModal(false);
                  const result = await startCheckout("monthly");
                  if (!result.success) {
                    toast({ title: "Checkout unavailable", description: result.error ?? "Please try again.", variant: "destructive" });
                  }
                }}
                disabled={proLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {proLoading ? "…" : "Get Monthly — $3.99"}
              </button>
              )}
              <button
                data-testid="button-checkout"
                onClick={async () => {
                  Analytics.proUpgradeStarted();
                  setShowUpgradeModal(false);
                  const result = await startCheckout("lifetime");
                  if (result.activated) {
                    toast({ title: "🎉 Welcome to ColdStreak Pro!", description: "Lifetime access unlocked." });
                  } else if (!result.success) {
                    toast({ title: "Checkout unavailable", description: result.error ?? "Please try again.", variant: "destructive" });
                  }
                }}
                disabled={proLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold text-sm shadow-lg shadow-yellow-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {proLoading ? "…" : `Get Lifetime — $${lifetimePrice.toFixed(2)}`}
              </button>
            </div>

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
                    if (ok.success) {
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
