import { useState, useEffect, useCallback, useRef } from "react";
import { Music, Play, Settings, X, ExternalLink, Check, Link2, Unlink, Loader2 } from "lucide-react";
import { SiSpotify, SiApplemusic } from "react-icons/si";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthToken } from "@/hooks/use-auth";

export type MusicService = "spotify" | "apple" | "none";

interface MusicConfig {
  service: MusicService;
  url: string;
  label: string;
  autoPlay: boolean;
}

const STORAGE_KEY = "coldstreak-music-config";
const CUSTOM_VALUE = "__custom__";
const CLEAR_VALUE = "__clear__";
const CONNECT_VALUE = "__connect_spotify__";

const PRESETS: { service: MusicService; label: string; url: string; emoji: string }[] = [
  { service: "spotify", label: "Cold Plunge Focus", url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ", emoji: "❄️" },
  { service: "spotify", label: "Wim Hof Breathing", url: "https://open.spotify.com/playlist/37i9dQZF1DX9uKNf5jGX6m", emoji: "🌬️" },
  { service: "spotify", label: "Deep Focus", url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ", emoji: "🧘" },
  { service: "spotify", label: "Workout Beast Mode", url: "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP", emoji: "🔥" },
];

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
        };
      }
    }
  } catch {}
  return { service: "none", url: "", label: "", autoPlay: true };
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
  if (cfg.service === "none" || !cfg.url) return false;
  try {
    window.open(cfg.url, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

export function shouldAutoPlay(): boolean {
  const cfg = loadConfig();
  return cfg.autoPlay && cfg.service !== "none" && !!cfg.url;
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
  const lastConfig = useRef(config);

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
    try {
      setConnecting(true);
      const res = await apiRequest("GET", "/api/spotify/login");
      const data = await res.json() as { url: string };
      if (data?.url) {
        // Try popup first; if blocked, fall back to top-level navigation in a new tab
        const popup = window.open(data.url, "spotify-oauth", "width=520,height=720");
        if (!popup) window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("[spotify] connect failed", err);
      setConnecting(false);
    }
  }, [isLoggedIn]);

  const handlePlay = useCallback(() => {
    if (!config.url) { setShowSettings(true); return; }
    try { window.open(config.url, "_blank", "noopener,noreferrer"); } catch {}
  }, [config.url]);

  const applyChoice = (service: MusicService, url: string, label: string) => {
    setConfig({ service, url, label, autoPlay: config.autoPlay });
  };

  const handleSavePreset = (preset: typeof PRESETS[number]) => {
    applyChoice(preset.service, preset.url, preset.label);
    setShowSettings(false);
  };

  const handleSaveCustom = () => {
    const u = urlInput.trim();
    if (!u) return;
    const svc = detectService(u);
    if (svc === "none") return;
    const label = labelInput.trim() || deriveLabel(u);
    applyChoice(svc, u, label);
    setUrlInput("");
    setLabelInput("");
    setShowSettings(false);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === CUSTOM_VALUE) { setShowSettings(true); return; }
    if (val === CONNECT_VALUE) { handleConnect(); return; }
    if (val === CLEAR_VALUE) {
      setConfig({ service: "none", url: "", label: "", autoPlay: config.autoPlay });
      return;
    }
    // Match against user playlists first, then presets
    const userPick = userPlaylists.find((p) => p.url === val);
    if (userPick) {
      applyChoice("spotify", userPick.url, userPick.name);
      return;
    }
    const preset = PRESETS.find((p) => p.url === val);
    if (preset) handleSavePreset(preset);
  };

  // The dropdown's selected value: if current config matches a preset OR a user playlist,
  // use that URL. Custom URL → synthetic value so the dropdown shows the custom label.
  const matchedPreset = PRESETS.find((p) => p.url === config.url);
  const matchedUserPick = userPlaylists.find((p) => p.url === config.url);
  const isCustomSaved = config.service !== "none" && !matchedPreset && !matchedUserPick;
  const selectValue = matchedPreset?.url ?? matchedUserPick?.url ?? (isCustomSaved ? config.url : "");

  const ServiceIcon = config.service === "spotify" ? SiSpotify : config.service === "apple" ? SiApplemusic : Music;
  const serviceColor = config.service === "spotify" ? "text-green-400" : config.service === "apple" ? "text-pink-400" : "text-cyan-400";

  return (
    <>
      <div
        className={`bg-blue-900/75 backdrop-blur-md rounded-2xl border border-blue-700/40 shadow-lg shadow-black/30 ${className}`}
        data-testid="card-music-widget"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <div className={`shrink-0 w-7 h-7 rounded-full bg-blue-950/60 flex items-center justify-center ${serviceColor}`}>
            <ServiceIcon className="w-3.5 h-3.5" />
          </div>

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
              <optgroup label="Quick picks">
                {PRESETS.map((p) => (
                  <option key={p.url + p.label} value={p.url}>
                    {p.emoji} {p.label}
                  </option>
                ))}
              </optgroup>
              {isLoggedIn && !isSpotifyConnected && (
                <option value={CONNECT_VALUE}>🔗 Connect Spotify to see your playlists…</option>
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
            data-testid="button-music-play"
            onClick={handlePlay}
            className="shrink-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-white flex items-center justify-center shadow-md shadow-cyan-500/30"
            aria-label="Play music now"
            title="Listen now"
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
      </div>

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
                      <button
                        key={p.id}
                        data-testid={`button-spotify-playlist-${p.id}`}
                        onClick={() => { applyChoice("spotify", p.url, p.name); setShowSettings(false); }}
                        className={`w-full text-left flex items-center gap-2 p-2 rounded-lg border transition-all active:scale-[0.99] ${
                          isActive
                            ? "bg-cyan-950/60 border-cyan-500/60 text-white"
                            : "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-cyan-500/40"
                        }`}
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
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 mb-2">Quick picks</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const isActive = config.url === p.url;
                  return (
                    <button
                      key={p.url + p.label}
                      data-testid={`button-music-preset-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => handleSavePreset(p)}
                      className={`text-left p-2.5 rounded-xl border transition-all active:scale-95 ${
                        isActive
                          ? "bg-cyan-950/60 border-cyan-500/60 text-white"
                          : "bg-slate-800/60 border-slate-700/60 text-slate-200 hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-base leading-none">{p.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{p.label}</div>
                          <div className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                            <SiSpotify className="w-2.5 h-2.5" />
                            Spotify
                          </div>
                        </div>
                        {isActive && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
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
              <button
                data-testid="button-save-music-custom"
                onClick={handleSaveCustom}
                disabled={!urlInput.trim() || detectService(urlInput) === "none"}
                className="w-full mt-2 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all active:scale-95"
              >
                Save custom playlist
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                Tip: open Spotify or Apple Music, find a playlist or station, tap Share → Copy Link, then paste here.
              </p>
            </div>

            {config.service !== "none" && (
              <div className="mb-3 p-2.5 bg-slate-800/50 rounded-lg">
                <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="checkbox-music-autoplay"
                    checked={config.autoPlay}
                    onChange={(e) => setConfig({ ...config, autoPlay: e.target.checked })}
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
                  setConfig({ service: "none", url: "", label: "", autoPlay: config.autoPlay });
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
