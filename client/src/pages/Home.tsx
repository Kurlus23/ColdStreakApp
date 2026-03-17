import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { savePhoto } from "@/lib/photoStore";
import icebergBg from "@assets/image_1773152998246.png";
import {
  Play, Pause, RotateCcw, Snowflake, History,
  Activity, AlarmClock, Flame, Target, Zap,
  Settings, Bell, Upload, Volume2, FileText,
  Camera, MapPin, Lock, ShieldAlert, Trophy, User, ChevronDown,
  Sparkles, Crown, CheckCircle2, RotateCcw as RestoreIcon, Compass, Info, Plus, Calendar, Trash2, Share2, AlertCircle, Download, ShoppingCart
} from "lucide-react";

import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePlunges, useCreatePlunge, useUpdatePlunge, useDeletePlunge } from "@/hooks/use-plunges";
import { useLeaderboard, useSubmitLeaderboard, useDeleteLeaderboardEntry, type LeaderboardEntryWithBadge } from "@/hooks/use-leaderboard";
import { useProStatus } from "@/hooks/use-pro-status";
import { PlungeCard, buildShareText } from "@/components/PlungeCard";
import { BannerAd, FeedAd, InterstitialAd } from "@/components/AdUnit";
import Onboarding, { hasCompletedOnboarding } from "@/components/Onboarding";
import { Analytics } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { getClientId } from "@/hooks/use-plunges";
import { buildShareImage } from "@/lib/shareImage";
import { saveCustomAlarmUrl, loadCustomAlarmUrl, clearCustomAlarmUrl } from "@/lib/alarm-storage";
import { Explore, GEAR_ITEMS } from "@/pages/Explore";
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

function playAudio(url: string, gain: number, stopAfterMs?: number): HTMLAudioElement {
  const audio = new Audio(url);
  audio.volume = 1;
  if (gain > 1) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AC();
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
    } catch {}
  }
  audio.play().catch(() => {});
  if (stopAfterMs) setTimeout(() => { audio.pause(); audio.currentTime = 0; }, stopAfterMs);
  return audio;
}

type Screen = "timer" | "history" | "explore" | "gear" | "settings" | "legal" | "achievements";


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

  // Countdown
  const [countdownMode, setCountdownMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  const [minutesInput, setMinutesInput] = useState(3);
  const [secondsInput, setSecondsInput] = useState(0);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number | null>(null);

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
      playAudio(alarmUrl, alarmGain, alarmIsCustom ? CUSTOM_ALARM_DURATION_MS : 3000);
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
  const [promptSubmitLeaderboard, setPromptSubmitLeaderboard] = useState(true);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);

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
  const { isPro, proEmail, promoExpiresAt, loading: proLoading, isFoundingPlunger, startCheckout, verifySession, restorePurchase, redeemPromo } = useProStatus();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { data: fpCountData } = useQuery<{ count: number; remaining: number; limit: number }>({
    queryKey: ["/api/founding-plunger-count"],
    enabled: showUpgradeModal,
    staleTime: 30_000,
  });
  const [showPostSessionAd, setShowPostSessionAd] = useState(false);
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
  const [bodyWeightLbs, setBodyWeightLbs] = useState<number>(() => {
    if (!localStorage.getItem("coldstreak-auth-token")) {
      localStorage.removeItem("coldstreak-body-weight");
      return 154;
    }
    return Number(localStorage.getItem("coldstreak-body-weight") || 154);
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
  const { data: communityLocs = [] } = useQuery<UserLocation[]>({ queryKey: ["/api/community-locations"] });
  const [username, setUsername] = useState<string>(() => {
    if (!localStorage.getItem("coldstreak-auth-token")) {
      localStorage.removeItem("coldstreak-username");
      return "";
    }
    return localStorage.getItem("coldstreak-username") ?? "";
  });
  // Plunge data stored for leaderboard submission after save
  const promptPlungeRef = useRef<{ score: string; duration: number; temperature: number } | null>(null);

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
    const ok = authMode === "login"
      ? await auth.login(authEmail, authPassword)
      : await auth.register(authEmail, authPassword);
    if (ok) {
      setAuthEmail("");
      setAuthPassword("");
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
    setSyncDone(false);
    localStorage.removeItem("coldstreak-username");
    localStorage.removeItem("coldstreak-body-weight");
    setUsername("");
    setBodyWeightLbs(154);
    queryClient.invalidateQueries({ queryKey: ["/api/plunges"] });
  };

  const exportCSV = () => {
    const headers = ["Date", "Time", "Duration", "Duration (sec)", "Temp (°F)", "Temp (°C)", "Cold Score", "Calories (kcal est.)", "Location"];
    const rows = plunges.map((p) => {
      const d = new Date(p.createdAt);
      const calories = Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs));
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
    a.click();
    URL.revokeObjectURL(url);
    Analytics.track("csv_exported", { plunge_count: plunges.length });
  };

  const doLogPlunge = useCallback((durationSec: number) => {
    const score = plungeScore(durationSec, temperature);
    createPlunge.mutate(
      { duration: durationSec, temperature, score: String(score), hrAvg: null, spo2Avg: null },
      {
        onSuccess: (newPlunge) => {
          Analytics.plungeLogged(durationSec, temperature, score);
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ["#0ea5e9", "#ffffff", "#38bdf8", "#bae6fd"] });
          toast({ title: "Plunge Logged! ❄️", description: `Score: ${score} — ${formatTime(durationSec)} at ${temperature}°F` });
          promptPlungeRef.current = { score: String(score), duration: durationSec, temperature };
          setPhotoPromptId(newPlunge.id);
          setPromptPhotoData(null);
          setPromptLocationId("");
          setPromptCustomLocation("");
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
    if (countdownRunning && countdown > 0) interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    if (countdownRunning && countdown === 0) {
      setCountdownRunning(false);
      const targetDuration = minutesInput * 60 + secondsInput;
      doLogPlunge(targetDuration);
      alarmRef.current = playAudio(alarmUrl, alarmGain, alarmIsCustom ? CUSTOM_ALARM_DURATION_MS : undefined);
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
  };

  const resetCountdown = () => {
    setCountdownRunning(false);
    setCountdown(0);
    if (alarmRef.current) { alarmRef.current.pause(); alarmRef.current.currentTime = 0; }
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
  const todayCalories = todayPlunges.reduce((sum, p) => sum + estimateCalories(p.duration, p.temperature, bodyWeightLbs), 0);
  const weeklyCalories = thisWeek.reduce((sum, p) => sum + estimateCalories(p.duration, p.temperature, bodyWeightLbs), 0);
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
                {isPro && plunges.length > 0 && (
                  <button
                    data-testid="button-export-csv"
                    onClick={exportCSV}
                    title="Export plunge history as CSV"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700/50 border border-blue-600/50 text-blue-200 text-xs font-semibold hover:bg-blue-600/60 transition-all active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
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
                    const finalLocId = manualLocSel === "home" ? "home" : manualLocSel.startsWith("community-") ? manualLocSel : undefined;
                    const finalLocName = manualLocSel === "home"
                      ? (homeLabel || "Home")
                      : manualLocSel.startsWith("community-")
                      ? (communityLocs.find((l) => l.id === Number(manualLocSel.replace("community-", "")))?.name)
                      : manualLocSel === "custom" ? (manualLocCustom.trim() || undefined)
                      : undefined;
                    createPlunge.mutate(
                      { duration: durationSec, temperature: manualTempF, score: String(score), hrAvg: null, spo2Avg: null, createdAt: isoDate, locationId: finalLocId, locationName: finalLocName },
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
                  <span className="ml-auto text-yellow-400 text-sm font-bold">from $9.99</span>
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
                  Upgrade to Pro — from $9.99/yr
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
                      <select
                        data-testid="input-body-weight"
                        value={(() => {
                          const nearest = Math.round(bodyWeightLbs / 5) * 5;
                          return Math.min(400, Math.max(80, nearest));
                        })()}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBodyWeightLbs(val);
                          localStorage.setItem("coldstreak-body-weight", String(val));
                          const token = localStorage.getItem("coldstreak-auth-token");
                          if (token) fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ bodyWeight: val }) }).catch(() => {});
                        }}
                        className="bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 font-bold appearance-none text-center"
                      >
                        {Array.from({ length: 65 }, (_, i) => 80 + i * 5).map((w) => (
                          <option key={w} value={w}>{w} lbs</option>
                        ))}
                      </select>
                      <span className="text-blue-500 text-xs">({Math.round(bodyWeightLbs / 2.205)} kg)</span>
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
        <div className="absolute top-20 bottom-20 left-0 right-0 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" /> Cold Plunge Gear
              </h2>
              <span className="text-blue-500 text-xs">{GEAR_ITEMS.length} items</span>
            </div>
            {GEAR_ITEMS.map((item) => (
              <div key={item.id} className="bg-blue-950/80 rounded-2xl overflow-hidden border border-blue-800/50">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-44 object-contain bg-white/5 px-4 pt-3"
                />
                <div className="px-4 pb-4 pt-2 space-y-1.5">
                  <div className="text-white font-semibold text-sm leading-snug">{item.name}</div>
                  <div className="text-blue-300 text-[11px] leading-relaxed">{item.description}</div>
                  <div className="pt-1">
                    <a
                      data-testid={`link-gear-${item.id}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-white font-bold text-xs px-3 py-1.5 rounded-lg w-fit"
                    >
                      View on Amazon
                    </a>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-blue-600 text-[10px] text-center pb-1">
              As an Amazon Associate, ColdStreak earns from qualifying purchases.
            </p>
          </div>
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
                  {featuredBadgeIds.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-0.5 shrink-0 ml-2 max-w-[120px]">
                      {featuredBadgeIds.map(id => (
                        <span key={id} className="text-xl leading-tight">{badgeEmojiLookup[id] ?? "🏆"}</span>
                      ))}
                    </div>
                  )}
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
                    <div className="text-blue-500 text-[11px]">{uniquePlungeDays} day{uniquePlungeDays !== 1 ? "s" : ""} total</div>
                  </div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ${openSections.days ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.days && (
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
              </div>

              {/* State Badges */}
              <div className="bg-blue-950/80 rounded-2xl border border-blue-700/50">
                <button
                  data-testid="button-toggle-state-badges"
                  onClick={() => setOpenSections(s => ({ ...s, states: !s.states }))}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="text-blue-400 text-[11px] uppercase tracking-widest">State Badges</div>
                  <span className={`text-blue-400 text-xs transition-transform duration-200 ${openSections.states ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openSections.states && (
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
                  <p className="text-indigo-200/60 text-[10px] leading-relaxed">
                    ColdStreak is not liable for any injury, loss, or damages arising from use of community-submitted locations.
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
                    <p className="text-blue-200 text-xs leading-relaxed">ColdStreak Pro is a one-time purchase. All purchases are final and non-refundable except where required by applicable law.</p>
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
                      {locEarned && (
                        <span className="text-[10px] text-cyan-400 font-semibold shrink-0">Plunged!</span>
                      )}
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
                <option value="home">🏠 Home</option>
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

              {promptLocationId === "home" && (
                <div className="bg-blue-900/50 rounded-xl px-3 py-2 border border-blue-700/40">
                  <div className="text-xs text-blue-300 leading-relaxed">
                    <span className="font-semibold text-cyan-300">🏠 {homeLabel}</span>
                    {" — "}Private. Shows as "Home" when shared with friends.
                  </div>
                </div>
              )}

              {promptLocationId && promptLocationId !== "custom" && promptLocationId !== "home" && (
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

            {/* Leaderboard submission toggle — only for passport/community locations, not home */}
            {promptLocationId && promptLocationId !== "custom" && promptLocationId !== "home" && (
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
                const isHomePick = promptLocationId === "home";
                const finalLocationId = promptLocationId && promptLocationId !== "custom" ? promptLocationId : undefined;
                let finalLocationName: string | undefined;
                if (isHomePick) {
                  finalLocationName = homeLabel;
                } else if (promptLocationId === "custom") {
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
                    locationId: promptLocationId,
                  });
                  if (navigator.share) {
                    if (promptPhotoData) {
                      try {
                        const composited = await buildShareImage({
                          photoDataUrl: promptPhotoData,
                          temperature: promptPlungeRef.current.temperature,
                          duration: promptPlungeRef.current.duration,
                          streak,
                          locationName,
                          locationId: promptLocationId,
                        });
                        const res = await fetch(composited);
                        const blob = await res.blob();
                        const file = new File([blob], "coldstreak-plunge.jpg", { type: "image/jpeg" });
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
          className={`fixed z-[60] bg-blue-950/98 backdrop-blur-md flex flex-col items-center justify-center gap-8 transition-all duration-300 ${
            isLandscape
              ? "inset-0"
              : "inset-x-0 bottom-0 rounded-t-3xl border-t border-blue-700/50 animate-in slide-in-from-bottom duration-300"
          }`}
          style={isLandscape ? {} : { height: "82vh" }}
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
          style={{ bottom: !isPro && !showPostSessionAd ? "296px" : "248px", zIndex: 31 }}
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

      {/* ─── STICKY BANNER AD ─── */}
      {!isPro && !showPostSessionAd && screen === "timer" && (
        <div className="fixed left-0 right-0 z-30 px-3" style={{ bottom: "248px" }}>
          <BannerAd />
        </div>
      )}

      {/* ─── POST-SESSION AD ─── */}
      {showPostSessionAd && !isPro && (
        <InterstitialAd
          adIndex={plunges.length % 3}
          onDismiss={() => setShowPostSessionAd(false)}
        />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-cyan-500/60 bg-cyan-900/20 p-3 text-center space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Annual</div>
                <div className="text-2xl font-black text-white">$9.99</div>
                <div className="text-cyan-300 text-xs">per year</div>
                <div className="text-slate-400 text-[10px]">~$0.83/mo</div>
              </div>
              <div className="rounded-2xl border border-yellow-500/60 bg-yellow-900/20 p-3 text-center space-y-1 relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">Early Adopter</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Lifetime</div>
                <div className="text-2xl font-black text-white">$19.99</div>
                <div className="text-yellow-300 text-xs">pay once, keep forever</div>
                <div className="text-slate-400 text-[10px]">price goes up soon</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="button-checkout-annual"
                onClick={async () => {
                  Analytics.proUpgradeStarted();
                  setShowUpgradeModal(false);
                  const result = await startCheckout("annual");
                  if (!result.success) {
                    toast({ title: "Checkout unavailable", description: result.error ?? "Please try again.", variant: "destructive" });
                  }
                }}
                disabled={proLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {proLoading ? "…" : "Get Annual — $9.99"}
              </button>
              <button
                data-testid="button-checkout"
                onClick={async () => {
                  Analytics.proUpgradeStarted();
                  setShowUpgradeModal(false);
                  const result = await startCheckout("lifetime");
                  if (!result.success) {
                    toast({ title: "Checkout unavailable", description: result.error ?? "Please try again.", variant: "destructive" });
                  }
                }}
                disabled={proLoading}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold text-sm shadow-lg shadow-yellow-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {proLoading ? "…" : "Get Lifetime — $19.99"}
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
