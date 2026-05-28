import { useState, useEffect, useCallback, useRef } from "react";
import { Music, Play, Pause, SkipBack, SkipForward, Square, Settings, X, ExternalLink, Check, Link2, Unlink, Loader2, Zap, ZapOff, VolumeX, Star, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiSpotify, SiApplemusic } from "react-icons/si";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";
import * as appleMusic from "@/lib/appleMusic";
import type { AppleMusicPlaylistSummary } from "@/lib/appleMusic";
import { Capacitor } from "@capacitor/core";

const IS_NATIVE_APP = (() => { try { return Capacitor.isNativePlatform(); } catch { return false; } })();

export type MusicService = "spotify" | "apple" | "none";

interface MusicConfig {
  service: MusicService;
  url: string;
  label: string;
  autoPlay: boolean;
  featureEnabled: boolean;
}

const STORAGE_KEY = "coldstreak-music-config";
const CUSTOM_VALUE = "__custom__";
const CLEAR_VALUE = "__clear__";
const CONNECT_VALUE = "__connect_spotify__";
const CONNECT_APPLE_VALUE = "__connect_apple__";

// User-pinned quick picks — playlists, artists, or radio stations the user
// chose to keep on the front of the music widget. Persisted to localStorage.
interface PinnedPick {
  service: MusicService;
  url: string;
  label: string;
}
const PINS_KEY = "coldstreak-music-pinned";
const MAX_PINS = 12;

function loadPins(): PinnedPick[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p === "object" && typeof p.url === "string" && typeof p.label === "string")
      .map((p) => ({
        service: (p.service === "apple" || p.service === "spotify") ? p.service : detectService(p.url),
        url: p.url,
        label: p.label,
      }))
      .filter((p) => p.service !== "none")
      .slice(0, MAX_PINS);
  } catch {
    return [];
  }
}

function savePins(pins: PinnedPick[]) {
  try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch {}
}

function pickKindLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("/station/") || u.includes("/radio")) return "Radio";
  if (u.includes("/artist/")) return "Artist";
  if (u.includes("/album/")) return "Album";
  return "Playlist";
}

function loadConfig(): MusicConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          service: (parsed.service ?? "none") as MusicService,
          url: typeof parsed.url === "string" ? parsed.url : "",
          label: typeof parsed.label === "string" ? parsed.label : "",
          autoPlay: parsed.autoPlay !== false,
          featureEnabled: parsed.featureEnabled !== false,
        };
      }
    }
  } catch {}
  return { service: "none", url: "", label: "", autoPlay: true, featureEnabled: true };
}

function saveConfig(cfg: MusicConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

function detectService(url: string): MusicService {
  const u = url.trim().toLowerCase();
  if (!u) return "none";
  if (u.includes("spotify.com") || u.startsWith("spotify:")) return "spotify";
  if (u.includes("music.apple.com") || u.startsWith("music:")) return "apple";
  return "none";
}

function deriveLabel(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "My Playlist";
  } catch {
    return "My Playlist";
  }
}

export function openMusic(): boolean {
  const cfg = loadConfig();
  if (!cfg.featureEnabled) return false;
  if (cfg.service === "none" || !cfg.url) return false;
  // In Capacitor, Apple Music universal links open the Apple Music app but
  // don't auto-play — user has to tap play manually. Use the native plugin
  // to push the playlist to ApplicationMusicPlayer so playback starts
  // immediately. Fire-and-forget; on any failure we fall back to the URL.
  if (appleMusic.isInNativeApp() && appleMusic.isAppleMusicPlaylistUrl(cfg.url)) {
    appleMusic.playPlaylistNative(cfg.url).then((ok) => {
      if (!ok) {
        try { window.open(cfg.url, "_blank", "noopener,noreferrer"); } catch {}
      }
    }).catch((err) => {
      console.warn("[apple-music/native] play failed, falling back to URL", err);
      try { window.open(cfg.url, "_blank", "noopener,noreferrer"); } catch {}
    });
    return true;
  }
  try {
    window.open(cfg.url, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

export function shouldAutoPlay(): boolean {
  const cfg = loadConfig();
  return cfg.featureEnabled && cfg.autoPlay && cfg.service !== "none" && !!cfg.url;
}

interface SpotifyMeResponse {
  connected: boolean;
  displayName?: string | null;
  spotifyUserId?: string;
}
interface SpotifyPlaylist {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
}

interface MusicWidgetProps {
  className?: string;
}

export function MusicWidget({ className = "" }: MusicWidgetProps) {
  const [config, setConfig] = useState<MusicConfig>(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [spotifyAuthError, setSpotifyAuthError] = useState<string | null>(null);
  const [pins, setPins] = useState<PinnedPick[]>(() => loadPins());
  const [pinAfterSave, setPinAfterSave] = useState(true);
  // Optimistic play/pause state for the transport-control row. We don't poll
  // the underlying player (would burn battery and rate limits); instead we
  // flip locally when the user presses a button. The play button auto-
  // becomes a pause button after Play, and vice versa.
  const [isPlaying, setIsPlaying] = useState(false);
  const [controlBusy, setControlBusy] = useState<null | "play" | "pause" | "prev" | "next" | "stop">(null);
  const { toast } = useToast();
  const lastConfig = useRef(config);
  const lastPins = useRef(pins);

  useEffect(() => {
    if (lastPins.current !== pins) {
      savePins(pins);
      lastPins.current = pins;
    }
  }, [pins]);

  const isPinned = useCallback((url: string) => pins.some((p) => p.url === url), [pins]);
  const togglePin = useCallback((pick: PinnedPick) => {
    setPins((prev) => {
      if (prev.some((p) => p.url === pick.url)) return prev.filter((p) => p.url !== pick.url);
      return [...prev, pick].slice(-MAX_PINS);
    });
  }, []);
  const removePin = useCallback((url: string) => {
    setPins((prev) => prev.filter((p) => p.url !== url));
  }, []);

  useEffect(() => {
    if (lastConfig.current !== config) {
      saveConfig(config);
      lastConfig.current = config;
    }
  }, [config]);

  // Only fetch Spotify status when user is logged in
  const isLoggedIn = !!getAuthToken();

  const meQuery = useQuery<SpotifyMeResponse>({
    queryKey: ["/api/spotify/me"],
    enabled: isLoggedIn,
    staleTime: 60_000,
  });
  const isSpotifyConnected = !!meQuery.data?.connected;

  const playlistsQuery = useQuery<{ playlists: SpotifyPlaylist[] }>({
    queryKey: ["/api/spotify/playlists"],
    enabled: isLoggedIn && isSpotifyConnected,
    staleTime: 5 * 60_000,
  });
  const userPlaylists: SpotifyPlaylist[] = playlistsQuery.data?.playlists ?? [];

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/spotify/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/playlists"] });
    },
  });

  // ── Apple Music state (browser-side; no server-stored tokens) ──────────
  // Tri-state: null = probe in progress; true/false = result known. Keeps the
  // legacy "not supported" panel from flashing in native before the async
  // plugin-availability check completes.
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);
  const [appleAuthorized, setAppleAuthorized] = useState(false);
  const [applePlaylists, setApplePlaylists] = useState<AppleMusicPlaylistSummary[]>([]);
  const [appleConnecting, setAppleConnecting] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);

  // On mount: probe MusicKit availability + restore prior auth (the music-user-
  // token persists across reloads in MusicKit's own storage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await appleMusic.isAvailable();
      if (cancelled) return;
      setAppleAvailable(ok);
      if (!ok) return;
      const authed = await appleMusic.isAuthorized();
      if (cancelled) return;
      setAppleAuthorized(authed);
      if (authed) {
        try {
          const pls = await appleMusic.fetchLibraryPlaylists();
          if (!cancelled) setApplePlaylists(pls);
        } catch (err) {
          console.error("[apple-music] failed to fetch playlists on mount", err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAppleConnect = useCallback(async () => {
    setAppleError(null);
    setAppleConnecting(true);
    try {
      const token = await appleMusic.authorize();
      if (!token) {
        setAppleError("Sign-in cancelled.");
        setAppleConnecting(false);
        return;
      }
      setAppleAuthorized(true);
      try {
        const pls = await appleMusic.fetchLibraryPlaylists();
        setApplePlaylists(pls);
      } catch (err: any) {
        console.error("[apple-music] playlist fetch failed", err);
        setAppleError(err?.message ?? "Could not load your Apple Music playlists.");
      }
    } catch (err: any) {
      console.error("[apple-music] connect failed", err);
      setAppleError(err?.message ?? "Could not connect to Apple Music.");
    } finally {
      setAppleConnecting(false);
    }
  }, []);

  const handleAppleDisconnect = useCallback(async () => {
    await appleMusic.unauthorize();
    setAppleAuthorized(false);
    setApplePlaylists([]);
    setAppleError(null);
  }, []);

  // Listen for callback popup posting "spotify:connected"
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (data && typeof data === "object" && (data.type === "spotify:connected" || data.type === "spotify:error")) {
        setConnecting(false);
        if (data.type === "spotify:connected") {
          queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/spotify/playlists"] });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Re-check status on tab focus (covers native: user returns from external browser)
  useEffect(() => {
    function onFocus() {
      if (connecting || isLoggedIn) {
        queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
      }
      if (connecting) {
        // Stop the "connecting…" spinner shortly after the user comes back
        setTimeout(() => setConnecting(false), 500);
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [connecting, isLoggedIn]);

  const handleConnect = useCallback(async () => {
    if (!isLoggedIn) return;
    // In Capacitor (TestFlight/Play), popups don't work — `window.open` opens
    // an isolated WebView with no `window.opener`, so the auth result can't be
    // postMessaged back. Use a full-page redirect within the same WebView
    // instead. Spotify will redirect back to /api/spotify/callback (still on
    // coldstreakapp.com → still inside the WKWebView), which then bounces to
    // /?spotify=connected. The home page picks that up and refreshes state.
    if (IS_NATIVE_APP) {
      try {
        setConnecting(true);
        const res = await apiRequest("GET", "/api/spotify/login");
        const data = await res.json() as { url: string };
        if (!data?.url) { setConnecting(false); return; }
        window.location.href = data.url;
      } catch (err) {
        console.error("[spotify] connect failed", err);
        setConnecting(false);
      }
      return;
    }
    // Web flow: popup-based, so we keep the synchronous about:blank trick to
    // avoid Safari's popup blocker.
    const popup = window.open("about:blank", "spotify-oauth", "width=520,height=720");
    try {
      setConnecting(true);
      const res = await apiRequest("GET", "/api/spotify/login");
      const data = await res.json() as { url: string };
      if (!data?.url) {
        if (popup && !popup.closed) popup.close();
        setConnecting(false);
        return;
      }
      if (popup && !popup.closed) {
        try { popup.location.href = data.url; } catch { window.location.href = data.url; }
      } else {
        // Popup was blocked entirely — fall back to same-tab navigation.
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("[spotify] connect failed", err);
      if (popup && !popup.closed) try { popup.close(); } catch {}
      setConnecting(false);
    }
  }, [isLoggedIn]);

  // After a full-page Spotify auth redirect (native flow), the callback bounces
  // us back to "/?spotify=connected" or "/?spotify=error". Detect that on
  // mount and refresh the connection status + show a toast-like state.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sp = params.get("spotify");
      if (!sp) return;
      if (sp === "connected") {
        setSpotifyAuthError(null);
        queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/spotify/playlists"] });
      } else if (sp === "error") {
        setSpotifyAuthError(
          "Spotify sign-in didn't finish. If you signed up for Spotify with Facebook, set a Spotify password first at spotify.com/account, then try again here. Spotify accounts in Development Mode also need to be added to the testers list."
        );
        setShowSettings(true);
      }
      // Clean the query string so refresh doesn't re-trigger.
      params.delete("spotify");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    } catch { /* ignore */ }
  }, []);

  const handlePlay = useCallback(() => {
    if (!config.url) { setShowSettings(true); return; }
    setIsPlaying(true);
    if (appleMusic.isInNativeApp() && appleMusic.isAppleMusicPlaylistUrl(config.url)) {
      appleMusic.playPlaylistNative(config.url).then((ok) => {
        if (!ok) { try { window.open(config.url, "_blank", "noopener,noreferrer"); } catch {} }
      }).catch((err) => {
        console.warn("[apple-music/native] play failed, falling back to URL", err);
        try { window.open(config.url, "_blank", "noopener,noreferrer"); } catch {}
      });
      return;
    }
    try { window.open(config.url, "_blank", "noopener,noreferrer"); } catch {}
  }, [config.url]);

  // ── Transport controls (pause/resume/skip/stop) ──────────────────────────
  // Routes to the native Apple Music plugin (if installed) or Spotify Web
  // API via our /api/spotify/control proxy. Failures are surfaced via toast
  // and the optimistic isPlaying flag is rolled back.
  const runSpotifyControl = useCallback(async (action: "play" | "pause" | "next" | "previous"): Promise<boolean> => {
    try {
      const res = await apiRequest("POST", "/api/spotify/control", { action });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reconnect = data?.reconnect ? " Disconnect and reconnect Spotify in Music Settings." : "";
        toast({
          title: "Spotify control failed",
          description: (data?.error || "Couldn't control Spotify.") + reconnect,
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch (err: any) {
      toast({
        title: "Spotify control failed",
        description: err?.message || "Couldn't reach Spotify.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const handlePause = useCallback(async () => {
    if (controlBusy) return;
    setControlBusy("pause");
    setIsPlaying(false);
    let ok = false;
    if (config.service === "apple") {
      ok = await appleMusic.pause();
    } else if (config.service === "spotify") {
      ok = await runSpotifyControl("pause");
    }
    if (!ok) setIsPlaying(true);
    setControlBusy(null);
  }, [config.service, controlBusy, runSpotifyControl]);

  const handleResume = useCallback(async () => {
    if (controlBusy) return;
    setControlBusy("play");
    setIsPlaying(true);
    let ok = false;
    if (config.service === "apple") {
      ok = await appleMusic.resume();
      // If resume failed (e.g. queue empty after a stop), fall back to
      // re-loading the playlist.
      if (!ok && appleMusic.isInNativeApp() && appleMusic.isAppleMusicPlaylistUrl(config.url)) {
        ok = await appleMusic.playPlaylistNative(config.url);
      }
    } else if (config.service === "spotify") {
      ok = await runSpotifyControl("play");
    }
    if (!ok) setIsPlaying(false);
    setControlBusy(null);
  }, [config.service, config.url, controlBusy, runSpotifyControl]);

  const handleSkipNext = useCallback(async () => {
    if (controlBusy) return;
    setControlBusy("next");
    if (config.service === "apple") await appleMusic.skipNext();
    else if (config.service === "spotify") await runSpotifyControl("next");
    setControlBusy(null);
  }, [config.service, controlBusy, runSpotifyControl]);

  const handleSkipPrevious = useCallback(async () => {
    if (controlBusy) return;
    setControlBusy("prev");
    if (config.service === "apple") await appleMusic.skipPrevious();
    else if (config.service === "spotify") await runSpotifyControl("previous");
    setControlBusy(null);
  }, [config.service, controlBusy, runSpotifyControl]);

  const handleStop = useCallback(async () => {
    if (controlBusy) return;
    setControlBusy("stop");
    setIsPlaying(false);
    if (config.service === "apple") await appleMusic.stop();
    else if (config.service === "spotify") await runSpotifyControl("pause");
    setControlBusy(null);
  }, [config.service, controlBusy, runSpotifyControl]);

  const applyChoice = (service: MusicService, url: string, label: string) => {
    setConfig((prev) => ({ ...prev, service, url, label }));
  };

  const toggleAutoPlay = () => {
    setConfig((prev) => ({ ...prev, autoPlay: !prev.autoPlay }));
  };

  const setFeatureEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, featureEnabled: enabled }));
  };

  const clearPlaylist = () => {
    setConfig((prev) => ({ ...prev, service: "none", url: "", label: "" }));
  };

  const handlePickPin = (pick: PinnedPick) => {
    applyChoice(pick.service, pick.url, pick.label);
    setShowSettings(false);
  };

  const handleSaveCustom = () => {
    const u = urlInput.trim();
    if (!u) return;
    const svc = detectService(u);
    if (svc === "none") return;
    const label = labelInput.trim() || deriveLabel(u);
    applyChoice(svc, u, label);
    if (pinAfterSave && !isPinned(u)) {
      togglePin({ service: svc, url: u, label });
    }
    setUrlInput("");
    setLabelInput("");
    setShowSettings(false);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === CUSTOM_VALUE) { setShowSettings(true); return; }
    if (val === CONNECT_VALUE) { handleConnect(); return; }
    if (val === CONNECT_APPLE_VALUE) { handleAppleConnect(); return; }
    if (val === CLEAR_VALUE) {
      clearPlaylist();
      return;
    }
    // Match against user playlists first (Spotify or Apple), then pins.
    const userPick = userPlaylists.find((p) => p.url === val);
    if (userPick) {
      applyChoice("spotify", userPick.url, userPick.name);
      return;
    }
    const applePick = applePlaylists.find((p) => p.url === val);
    if (applePick) {
      applyChoice("apple", applePick.url, applePick.name);
      return;
    }
    const pin = pins.find((p) => p.url === val);
    if (pin) handlePickPin(pin);
  };

  // The dropdown's selected value: if current config matches a pin OR a user playlist,
  // use that URL. Custom URL → synthetic value so the dropdown shows the custom label.
  const matchedPin = pins.find((p) => p.url === config.url);
  const matchedUserPick = userPlaylists.find((p) => p.url === config.url);
  const matchedApplePick = applePlaylists.find((p) => p.url === config.url);
  const isCustomSaved = config.service !== "none" && !matchedPin && !matchedUserPick && !matchedApplePick;
  const selectValue = matchedPin?.url ?? matchedUserPick?.url ?? matchedApplePick?.url ?? (isCustomSaved ? config.url : "");

  const ServiceIcon = config.service === "spotify" ? SiSpotify : config.service === "apple" ? SiApplemusic : Music;
  const serviceColor = config.service === "spotify" ? "text-green-400" : config.service === "apple" ? "text-pink-400" : "text-cyan-400";

  return (
    <>
      {!config.featureEnabled ? (
        <div className={`flex justify-end ${className}`} data-testid="card-music-widget-collapsed">
          <button
            data-testid="button-music-reenable"
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-blue-950/60 hover:bg-blue-900/70 border border-blue-800/40 text-xs font-semibold text-blue-200 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Music is off — tap to open music settings and re-enable"
            title="Music is off — tap to enable"
          >
            <VolumeX className="w-4 h-4" />
            Music off · Tap to enable
          </button>
        </div>
      ) : (
      <div
        className={`bg-blue-900/75 backdrop-blur-md rounded-2xl border border-blue-700/40 shadow-lg shadow-black/30 ${className}`}
        data-testid="card-music-widget"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button
            data-testid="button-music-open-app"
            onClick={() => {
              // Tap icon → jump to the corresponding music app. Opens the
              // currently selected playlist if set (deep-links into Spotify/
              // Apple Music app via universal link); otherwise opens the
              // service's home page so the user can browse.
              const fallback =
                config.service === "spotify" ? "https://open.spotify.com" :
                config.service === "apple" ? "https://music.apple.com" :
                null;
              const target = config.url || fallback;
              if (!target) { setShowSettings(true); return; }
              try { window.open(target, "_blank", "noopener,noreferrer"); } catch {}
            }}
            className={`shrink-0 w-7 h-7 rounded-full bg-blue-950/60 hover:bg-blue-900/70 active:scale-95 transition-all flex items-center justify-center ${serviceColor} focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
            aria-label={
              config.service === "spotify" ? "Open in Spotify" :
              config.service === "apple" ? "Open in Apple Music" :
              "Open music settings"
            }
            title={
              config.service === "spotify" ? "Open in Spotify" :
              config.service === "apple" ? "Open in Apple Music" :
              "Music settings"
            }
          >
            <ServiceIcon className="w-3.5 h-3.5" />
          </button>

          {/* Native dropdown — takes most of the width */}
          <div className="flex-1 min-w-0 relative">
            <select
              data-testid="select-music-playlist"
              value={selectValue}
              onChange={handleSelectChange}
              className="w-full appearance-none bg-blue-950/40 border border-blue-700/40 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer truncate"
              aria-label="Choose playlist"
            >
              {selectValue === "" && <option value="">🎵 Choose a playlist…</option>}
              {isCustomSaved && <option value={config.url}>🎶 {config.label || "Custom playlist"}</option>}
              {isLoggedIn && isSpotifyConnected && userPlaylists.length > 0 && (
                <optgroup label={`Your Spotify${meQuery.data?.displayName ? ` — ${meQuery.data.displayName}` : ""}`}>
                  {userPlaylists.map((p) => (
                    <option key={p.id} value={p.url}>
                      🎵 {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {appleAuthorized && applePlaylists.length > 0 && (
                <optgroup label="Your Apple Music">
                  {applePlaylists.map((p) => (
                    <option key={p.id} value={p.url}>
                      🍎 {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {pins.length > 0 && (
                <optgroup label="My quick picks">
                  {pins.map((p) => (
                    <option key={p.url} value={p.url}>
                      ⭐ {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {isLoggedIn && !isSpotifyConnected && (
                <option value={CONNECT_VALUE}>🔗 Connect Spotify to see your playlists…</option>
              )}
              {appleAvailable === true && !appleAuthorized && (
                <option value={CONNECT_APPLE_VALUE}>🍎 Connect Apple Music to see your playlists…</option>
              )}
              <option value={CUSTOM_VALUE}>＋ Paste custom Spotify / Apple Music URL…</option>
              {config.service !== "none" && <option value={CLEAR_VALUE}>✕ Clear current playlist</option>}
            </select>
            {/* Custom caret */}
            <svg
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-300"
              viewBox="0 0 20 20" fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>

          <button
            data-testid="button-music-autoplay-toggle"
            onClick={toggleAutoPlay}
            className={`shrink-0 w-8 h-8 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              config.autoPlay
                ? "bg-cyan-950/70 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40"
                : "bg-blue-950/40 text-blue-400 hover:text-blue-200 border border-blue-800/40"
            }`}
            aria-label={config.autoPlay ? "Auto-launch with timer is ON — tap to turn off" : "Auto-launch with timer is OFF — tap to turn on"}
            title={config.autoPlay ? "Auto-launch with timer: ON" : "Auto-launch with timer: OFF"}
          >
            {config.autoPlay ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
          </button>
          <button
            data-testid="button-music-play"
            onClick={handlePlay}
            className="shrink-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-white flex items-center justify-center shadow-md shadow-cyan-500/30"
            aria-label="Play music now"
            title="Listen now (doesn't start the timer)"
          >
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          </button>
          <button
            data-testid="button-music-settings"
            onClick={() => setShowSettings(true)}
            className="shrink-0 w-8 h-8 rounded-full bg-blue-800/60 hover:bg-blue-700/60 active:scale-95 transition-all text-blue-200 flex items-center justify-center"
            aria-label="Music settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Transport controls — only shown when a playlist is selected. Lets
            the user pause / resume / skip / stop the music without leaving
            ColdStreak. Routes to native Apple Music plugin or Spotify Web
            API depending on which service is active. */}
        {config.service !== "none" && config.url && (
          <div className="flex items-center justify-center gap-1.5 px-2 pb-1.5 pt-0.5 border-t border-blue-800/30">
            <button
              data-testid="button-music-skip-previous"
              onClick={handleSkipPrevious}
              disabled={controlBusy !== null}
              className="w-9 h-9 rounded-full bg-blue-950/60 hover:bg-blue-900/70 active:scale-95 transition-all text-blue-100 hover:text-white disabled:opacity-40 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Previous track"
              title="Previous"
            >
              {controlBusy === "prev" ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipBack className="w-4 h-4 fill-current" />}
            </button>
            {isPlaying ? (
              <button
                data-testid="button-music-pause"
                onClick={handlePause}
                disabled={controlBusy !== null}
                className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-white shadow-md shadow-cyan-500/30 disabled:opacity-60 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Pause"
                title="Pause"
              >
                {controlBusy === "pause" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4 fill-white" />}
              </button>
            ) : (
              <button
                data-testid="button-music-resume"
                onClick={handleResume}
                disabled={controlBusy !== null}
                className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-white shadow-md shadow-cyan-500/30 disabled:opacity-60 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Play"
                title="Play"
              >
                {controlBusy === "play" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              </button>
            )}
            <button
              data-testid="button-music-skip-next"
              onClick={handleSkipNext}
              disabled={controlBusy !== null}
              className="w-9 h-9 rounded-full bg-blue-950/60 hover:bg-blue-900/70 active:scale-95 transition-all text-blue-100 hover:text-white disabled:opacity-40 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Next track"
              title="Next"
            >
              {controlBusy === "next" ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4 fill-current" />}
            </button>
            <button
              data-testid="button-music-stop"
              onClick={handleStop}
              disabled={controlBusy !== null}
              className="w-9 h-9 rounded-full bg-blue-950/60 hover:bg-blue-900/70 active:scale-95 transition-all text-blue-100 hover:text-white disabled:opacity-40 flex items-center justify-center ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Stop"
              title="Stop"
            >
              {controlBusy === "stop" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
            </button>
          </div>
        )}
      </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowSettings(false)}
          data-testid="modal-music-settings"
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-blue-700/40 rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-cyan-400" />
                Music Settings
              </h3>
              <button
                data-testid="button-close-music-settings"
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Master feature toggle */}
            <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">Show music bar</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Turn off to hide the music bar entirely. The timer will never auto-launch music.
                    Note: this won't stop music already playing in Spotify or Apple Music — use that app to stop it.
                  </div>
                </div>
                <input
                  type="checkbox"
                  data-testid="checkbox-music-feature-enabled"
                  checked={config.featureEnabled}
                  onChange={(e) => setFeatureEnabled(e.target.checked)}
                  className="w-5 h-5 accent-cyan-500 shrink-0"
                />
              </label>
            </div>

            {/* Spotify connection panel */}
            {isLoggedIn && (
              <div className="mb-4 p-3 rounded-xl bg-green-950/30 border border-green-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <SiSpotify className="w-4 h-4 text-green-400" />
                  <div className="text-xs font-semibold text-white">Spotify Account</div>
                </div>
                {isSpotifyConnected ? (
                  <>
                    <div className="text-[11px] text-green-200 mb-2">
                      Connected as <span className="font-semibold">{meQuery.data?.displayName || "your Spotify account"}</span>.
                      Your playlists ({userPlaylists.length}) appear in the dropdown.
                    </div>
                    <button
                      data-testid="button-spotify-disconnect"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="w-full py-1.5 text-[11px] text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Unlink className="w-3 h-3" />
                      {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect Spotify"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] text-blue-200 mb-2">
                      Sign in with Spotify to pick from your own playlists.
                    </div>
                    {spotifyAuthError && (
                      <div
                        data-testid="text-spotify-auth-error"
                        className="mb-2 p-2 rounded-lg bg-red-950/50 border border-red-800/60 text-[10px] text-red-200 leading-snug"
                      >
                        {spotifyAuthError}
                      </div>
                    )}
                    <button
                      data-testid="button-spotify-connect"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      {connecting ? "Waiting for Spotify…" : "Connect Spotify"}
                    </button>
                  </>
                )}
              </div>
            )}
            {!isLoggedIn && (
              <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 text-[11px] text-slate-300">
                Sign in to ColdStreak to link your Spotify account and use your own playlists.
              </div>
            )}

            {/* Apple Music: when running inside Capacitor, the panel is only
                  shown if the native MusicKit plugin is present in this build
                  (appleAvailable === true). Older TestFlight builds without
                  the plugin fall through to the legacy "link via Safari"
                  fallback below. */}
            {IS_NATIVE_APP && appleAvailable === false && (
              <div className="mb-4 p-3 rounded-xl bg-pink-950/20 border border-pink-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <SiApplemusic className="w-4 h-4 text-pink-400" />
                  <div className="text-xs font-semibold text-white">Apple Music</div>
                </div>
                <div className="text-[11px] text-blue-200 mb-1">
                  This build doesn't include native Apple Music support yet.
                </div>
                <div className="text-[10px] text-slate-400 leading-snug">
                  Update to the latest TestFlight build, or open <span className="font-semibold text-blue-300">coldstreakapp.com</span> in
                  Safari, link your account there, then paste a playlist URL here using the "+ Paste custom Spotify / Apple Music URL…" option.
                </div>
              </div>
            )}

            {/* Apple Music connection panel — works for both web (MusicKit JS)
                  and native (ColdstreakMusickit Capacitor plugin) since
                  appleMusic.ts auto-routes between them. */}
            {appleAvailable === true && (
              <div className="mb-4 p-3 rounded-xl bg-pink-950/20 border border-pink-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <SiApplemusic className="w-4 h-4 text-pink-400" />
                  <div className="text-xs font-semibold text-white">Apple Music</div>
                </div>
                {appleAuthorized ? (
                  <>
                    <div className="text-[11px] text-pink-200 mb-2">
                      Connected. {applePlaylists.length > 0
                        ? <>Your library playlists ({applePlaylists.length}) appear in the dropdown.</>
                        : <>Your library is empty — pick a playlist from <span className="font-semibold text-pink-100">Quick picks</span> below or paste any Apple Music link.</>
                      }
                    </div>
                    <button
                      data-testid="button-apple-disconnect"
                      onClick={handleAppleDisconnect}
                      className="w-full py-1.5 text-[11px] text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Unlink className="w-3 h-3" />
                      Disconnect Apple Music
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] text-blue-200 mb-2">
                      Sign in with your Apple ID to pick from your own Apple Music playlists. Requires an active Apple Music subscription.
                    </div>
                    <button
                      data-testid="button-apple-connect"
                      onClick={handleAppleConnect}
                      disabled={appleConnecting}
                      className="w-full py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {appleConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      {appleConnecting ? "Waiting for Apple…" : "Connect Apple Music"}
                    </button>
                    {appleError && (
                      <div className="mt-2 text-[10px] text-red-300">{appleError}</div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* User's Apple Music playlists */}
            {appleAuthorized && applePlaylists.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-pink-300 mb-2">
                  Your Apple Music playlists
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {applePlaylists.map((p) => {
                    const isActive = config.url === p.url;
                    return (
                      <div
                        key={p.id}
                        className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${
                          isActive
                            ? "border-pink-500 bg-pink-900/30 text-white"
                            : "border-slate-700/60 bg-slate-800/40 hover:border-pink-600/60 hover:bg-slate-800/70 text-slate-200"
                        }`}
                      >
                        <button
                          data-testid={`button-apple-playlist-${p.id}`}
                          onClick={() => { applyChoice("apple", p.url, p.name); setShowSettings(false); }}
                          className="flex-1 min-w-0 text-left flex items-center gap-2"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-8 h-8 rounded shrink-0 object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded shrink-0 bg-pink-950/50 flex items-center justify-center">
                              <SiApplemusic className="w-4 h-4 text-pink-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold truncate">{p.name}</div>
                            {p.trackCount > 0 && <div className="text-[10px] text-slate-400">{p.trackCount} track{p.trackCount === 1 ? "" : "s"}</div>}
                          </div>
                          {isActive && <Check className="w-4 h-4 text-pink-400 shrink-0" />}
                        </button>
                        <button
                          data-testid={`button-apple-playlist-pin-${p.id}`}
                          onClick={() => togglePin({ service: "apple", url: p.url, label: p.name })}
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            isPinned(p.url)
                              ? "bg-yellow-500/20 text-yellow-300 hover:text-yellow-200"
                              : "bg-slate-900/60 text-slate-500 hover:text-yellow-400"
                          }`}
                          aria-label={isPinned(p.url) ? `Unpin ${p.name} from quick picks` : `Pin ${p.name} to quick picks`}
                          title={isPinned(p.url) ? "Unpin from quick picks" : "Pin to quick picks"}
                        >
                          <Star className={`w-3.5 h-3.5 ${isPinned(p.url) ? "fill-yellow-400" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User's Spotify playlists */}
            {isLoggedIn && isSpotifyConnected && userPlaylists.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 mb-2">
                  Your Spotify playlists
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {userPlaylists.map((p) => {
                    const isActive = config.url === p.url;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                          isActive
                            ? "bg-cyan-950/60 border-cyan-500/60 text-white"
                            : "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-cyan-500/40"
                        }`}
                      >
                        <button
                          data-testid={`button-spotify-playlist-${p.id}`}
                          onClick={() => { applyChoice("spotify", p.url, p.name); setShowSettings(false); }}
                          className="flex-1 min-w-0 text-left flex items-center gap-2 active:scale-[0.99]"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center shrink-0">
                              <SiSpotify className="w-4 h-4 text-green-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{p.trackCount} tracks{p.owner ? ` · ${p.owner}` : ""}</div>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        </button>
                        <button
                          data-testid={`button-spotify-playlist-pin-${p.id}`}
                          onClick={() => togglePin({ service: "spotify", url: p.url, label: p.name })}
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            isPinned(p.url)
                              ? "bg-yellow-500/20 text-yellow-300 hover:text-yellow-200"
                              : "bg-slate-900/60 text-slate-500 hover:text-yellow-400"
                          }`}
                          aria-label={isPinned(p.url) ? `Unpin ${p.name} from quick picks` : `Pin ${p.name} to quick picks`}
                          title={isPinned(p.url) ? "Unpin from quick picks" : "Pin to quick picks"}
                        >
                          <Star className={`w-3.5 h-3.5 ${isPinned(p.url) ? "fill-yellow-400" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">My quick picks</div>
                {pins.length > 0 && (
                  <div className="text-[10px] text-slate-500">{pins.length}/{MAX_PINS}</div>
                )}
              </div>
              {pins.length === 0 ? (
                <div
                  data-testid="text-music-pins-empty"
                  className="p-3 rounded-xl bg-slate-800/40 border border-dashed border-slate-700/60 text-[11px] text-slate-300 leading-relaxed"
                >
                  No quick picks yet. Tap the ⭐ next to any of your Spotify or Apple Music playlists below to pin it here.
                  Or paste a link to an artist, playlist, or radio station and check "Pin to quick picks".
                  <div className="mt-1.5 text-[10px] text-slate-400">
                    💡 Apple Music radio stations work too — open one in Apple Music, tap Share → Copy Link.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {pins.map((p) => {
                    const isActive = config.url === p.url;
                    const isApple = p.service === "apple";
                    const kind = pickKindLabel(p.url);
                    return (
                      <div
                        key={p.url}
                        className={`relative text-left p-2.5 rounded-xl border transition-all ${
                          isActive
                            ? "bg-cyan-950/60 border-cyan-500/60 text-white"
                            : "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-cyan-500/40"
                        }`}
                      >
                        <button
                          data-testid={`button-music-pin-${p.url.slice(-12)}`}
                          onClick={() => handlePickPin(p)}
                          className="w-full text-left pr-5"
                        >
                          <div className="flex items-start gap-1.5">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{p.label}</div>
                              <div className={`text-[10px] flex items-center gap-1 mt-0.5 ${isApple ? "text-pink-400" : "text-green-400"}`}>
                                {isApple ? <SiApplemusic className="w-2.5 h-2.5" /> : <SiSpotify className="w-2.5 h-2.5" />}
                                {kind}
                              </div>
                            </div>
                            {isActive && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                          </div>
                        </button>
                        <button
                          data-testid={`button-music-pin-remove-${p.url.slice(-12)}`}
                          onClick={(e) => { e.stopPropagation(); removePin(p.url); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full text-slate-500 hover:text-red-400 hover:bg-slate-900/60 flex items-center justify-center"
                          aria-label={`Remove ${p.label} from quick picks`}
                          title="Remove from quick picks"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 mb-2">Or paste a link</div>
              <input
                type="url"
                data-testid="input-music-url"
                placeholder="Spotify or Apple Music URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                data-testid="input-music-label"
                placeholder="Display name (optional)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="checkbox-music-pin-after-save"
                  checked={pinAfterSave}
                  onChange={(e) => setPinAfterSave(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500"
                />
                Pin to quick picks
              </label>
              <button
                data-testid="button-save-music-custom"
                onClick={handleSaveCustom}
                disabled={!urlInput.trim() || detectService(urlInput) === "none"}
                className="w-full mt-2 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                Save playlist
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Works with Spotify and Apple Music links — playlists, artists, albums, or radio stations.
                In each app, tap Share → Copy Link, then paste here.
              </p>
            </div>

            {config.service !== "none" && (
              <div className="mb-3 p-2.5 bg-slate-800/50 rounded-lg">
                <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="checkbox-music-autoplay"
                    checked={config.autoPlay}
                    onChange={(e) => setConfig((prev) => ({ ...prev, autoPlay: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  Auto-launch playlist when timer starts
                </label>
              </div>
            )}

            {config.service !== "none" && (
              <button
                data-testid="button-music-clear"
                onClick={() => {
                  clearPlaylist();
                  setShowSettings(false);
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Clear current playlist
              </button>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Music opens in Spotify or Apple Music. To stop playback, use that app or your phone's lock screen controls.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
