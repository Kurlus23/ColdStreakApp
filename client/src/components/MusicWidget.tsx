import { useState, useEffect, useCallback } from "react";
import { Music, Play, Settings, X, ExternalLink, Check } from "lucide-react";
import { SiSpotify, SiApplemusic } from "react-icons/si";

export type MusicService = "spotify" | "apple" | "none";

interface MusicConfig {
  service: MusicService;
  url: string;
  label: string;
  autoPlay: boolean;
}

const STORAGE_KEY = "coldstreak-music-config";

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

interface MusicWidgetProps {
  className?: string;
}

export function MusicWidget({ className = "" }: MusicWidgetProps) {
  const [config, setConfig] = useState<MusicConfig>(() => loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => { saveConfig(config); }, [config]);

  const handlePlay = useCallback(() => {
    if (!config.url) { setShowSettings(true); return; }
    try { window.open(config.url, "_blank", "noopener,noreferrer"); } catch {}
  }, [config.url]);

  const handleSavePreset = (preset: typeof PRESETS[number]) => {
    setConfig({ service: preset.service, url: preset.url, label: preset.label, autoPlay: config.autoPlay });
    setShowSettings(false);
  };

  const handleSaveCustom = () => {
    const u = urlInput.trim();
    if (!u) return;
    const svc = detectService(u);
    if (svc === "none") return;
    const label = labelInput.trim() || deriveLabel(u);
    setConfig({ service: svc, url: u, label, autoPlay: config.autoPlay });
    setUrlInput("");
    setLabelInput("");
    setShowSettings(false);
  };

  const ServiceIcon = config.service === "spotify" ? SiSpotify : config.service === "apple" ? SiApplemusic : Music;
  const serviceColor = config.service === "spotify" ? "text-green-400" : config.service === "apple" ? "text-pink-400" : "text-cyan-400";

  return (
    <>
      <div
        className={`bg-blue-900/75 backdrop-blur-md rounded-2xl p-3 border border-blue-700/40 ${className}`}
        data-testid="card-music-widget"
      >
        <div className="flex items-center gap-2">
          <div className={`shrink-0 w-9 h-9 rounded-full bg-blue-950/60 flex items-center justify-center ${serviceColor}`}>
            <ServiceIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-blue-300 leading-tight">Music</div>
            <div className="text-xs font-semibold text-white truncate" data-testid="text-music-label">
              {config.label || "Choose a playlist"}
            </div>
          </div>
          <button
            data-testid="button-music-play"
            onClick={handlePlay}
            className="shrink-0 w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all text-white flex items-center justify-center shadow-lg shadow-cyan-500/30"
            aria-label="Play music now"
            title="Listen now (free mode)"
          >
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </button>
          <button
            data-testid="button-music-settings"
            onClick={() => setShowSettings(true)}
            className="shrink-0 w-9 h-9 rounded-full bg-blue-800/60 hover:bg-blue-700/60 active:scale-95 transition-all text-blue-200 flex items-center justify-center"
            aria-label="Music settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        {config.service !== "none" && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-800/40">
            <label className="flex items-center gap-1.5 text-[10px] text-blue-200 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="checkbox-music-autoplay"
                checked={config.autoPlay}
                onChange={(e) => setConfig({ ...config, autoPlay: e.target.checked })}
                className="w-3 h-3 accent-cyan-500"
              />
              Auto-play when timer starts
            </label>
          </div>
        )}
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowSettings(false)}
          data-testid="modal-music-settings"
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-blue-700/40 rounded-2xl p-5 shadow-2xl"
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
