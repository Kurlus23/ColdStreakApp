// Apple Music wrapper.
//
// Two code paths share this module:
//
//   • Web (browser): we use Apple's MusicKit JS, which manages auth + the
//     per-user music-user-token entirely client-side.
//   • Capacitor (TestFlight / Play): MusicKit JS is broken inside WKWebView
//     (Apple's auth popup loses its window.opener reference and the auth
//     token never makes it back). We instead call our native Capacitor
//     plugin `coldstreak-musickit` which wraps iOS's StoreKit
//     `SKCloudServiceController`. The plugin returns a music-user-token
//     which we cache in localStorage and send directly to api.music.apple.com.
//
// The exported helpers — isAvailable, isAuthorized, authorize, unauthorize,
// fetchLibraryPlaylists — present the same surface for both paths.

import { Capacitor, registerPlugin } from "@capacitor/core";

declare global {
  interface Window {
    MusicKit?: any;
  }
}

const APP_NAME = "ColdStreak";
const APP_BUILD = "1.0.0";

const NATIVE_TOKEN_STORAGE_KEY = "coldstreak-apple-music-user-token";

export function isInNativeApp(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Native (Capacitor) plugin bridge
// ─────────────────────────────────────────────────────────────────────────────

interface NativeMusicKitPlugin {
  requestAuthorization(): Promise<{ status: string; authorized: boolean }>;
  getUserToken(opts: { developerToken: string }): Promise<{ userToken: string }>;
  playPlaylist(opts: { url: string }): Promise<{ played: boolean }>;
}

// registerPlugin works even if the underlying native code isn't present — it
// returns a proxy that throws on call. We detect that via isPluginAvailable
// to decide whether the native path is usable.
const NativeMusicKit = registerPlugin<NativeMusicKitPlugin>("ColdstreakMusickit", {
  web: () => ({
    requestAuthorization: async () => { throw new Error("Native MusicKit plugin not available on web"); },
    getUserToken: async () => { throw new Error("Native MusicKit plugin not available on web"); },
    playPlaylist: async () => { throw new Error("Native MusicKit plugin not available on web"); },
  }),
});

/** True for any music.apple.com playlist URL (catalog or library). */
export function isAppleMusicPlaylistUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith("music.apple.com") && u.pathname.includes("/playlist/");
  } catch {
    return false;
  }
}

/**
 * Native-only: hand an Apple Music playlist URL to iOS's
 * `ApplicationMusicPlayer` so playback starts immediately (instead of just
 * deep-linking to the Apple Music app where the user has to tap play).
 * Returns true on success, false if not in native or plugin missing.
 * Throws on real failures (permission denied, playlist not found, etc).
 */
export async function playPlaylistNative(url: string): Promise<boolean> {
  if (!isInNativeApp() || !isNativePluginAvailable()) return false;
  const result = await NativeMusicKit.playPlaylist({ url });
  return !!result?.played;
}

function isNativePluginAvailable(): boolean {
  if (!isInNativeApp()) return false;
  try {
    return Capacitor.isPluginAvailable("ColdstreakMusickit");
  } catch {
    return false;
  }
}

function getCachedNativeUserToken(): string | null {
  try {
    const t = localStorage.getItem(NATIVE_TOKEN_STORAGE_KEY);
    return t && t.length > 0 ? t : null;
  } catch { return null; }
}

function setCachedNativeUserToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(NATIVE_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(NATIVE_TOKEN_STORAGE_KEY);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server developer token
// ─────────────────────────────────────────────────────────────────────────────

let cachedDeveloperToken: string | null = null;

async function fetchDeveloperToken(): Promise<string> {
  if (cachedDeveloperToken) return cachedDeveloperToken;
  const r = await fetch("/api/apple-music/developer-token", { credentials: "same-origin" });
  if (!r.ok) {
    if (r.status === 503) throw new Error("Apple Music isn't enabled on this server.");
    throw new Error(`Failed to fetch Apple Music developer token (${r.status})`);
  }
  const data = await r.json() as { token?: string; error?: string };
  if (!data.token) throw new Error(data.error || "Empty developer token");
  cachedDeveloperToken = data.token;
  return data.token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web (MusicKit JS) path
// ─────────────────────────────────────────────────────────────────────────────

let configurePromise: Promise<any> | null = null;

function waitForMusicKit(timeoutMs = 8000): Promise<any> {
  if (window.MusicKit) return Promise.resolve(window.MusicKit);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.MusicKit) return resolve(window.MusicKit);
      if (Date.now() - start > timeoutMs) return reject(new Error("MusicKit JS failed to load"));
      setTimeout(check, 100);
    };
    document.addEventListener("musickitloaded", () => {
      if (window.MusicKit) resolve(window.MusicKit);
    }, { once: true });
    check();
  });
}

export async function getInstance(): Promise<any> {
  if (configurePromise) return configurePromise;
  configurePromise = (async () => {
    const MusicKit = await waitForMusicKit();
    const developerToken = await fetchDeveloperToken();
    const instance = await MusicKit.configure({
      developerToken,
      app: { name: APP_NAME, build: APP_BUILD },
    });
    return instance;
  })();
  try {
    return await configurePromise;
  } catch (err) {
    configurePromise = null;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API (auto-routes web vs native)
// ─────────────────────────────────────────────────────────────────────────────

export async function isAvailable(): Promise<boolean> {
  if (isInNativeApp()) {
    // Native path is available iff the plugin is installed in this build.
    // (Older TestFlight builds without the plugin will return false here and
    // continue showing the "link via Safari" panel.)
    return isNativePluginAvailable();
  }
  try {
    await getInstance();
    return true;
  } catch {
    return false;
  }
}

export async function isAuthorized(): Promise<boolean> {
  if (isInNativeApp()) {
    return !!getCachedNativeUserToken();
  }
  try {
    const inst = await getInstance();
    return !!inst.isAuthorized;
  } catch {
    return false;
  }
}

export async function authorize(): Promise<string | null> {
  if (isInNativeApp()) {
    if (!isNativePluginAvailable()) return null;
    try {
      const auth = await NativeMusicKit.requestAuthorization();
      if (!auth.authorized) return null;
      const developerToken = await fetchDeveloperToken();
      const { userToken } = await NativeMusicKit.getUserToken({ developerToken });
      if (userToken) setCachedNativeUserToken(userToken);
      return userToken || null;
    } catch (err) {
      console.error("[apple-music/native] authorize failed", err);
      return null;
    }
  }

  // Web (MusicKit JS) path.
  const inst = await getInstance();
  const TIMEOUT_MS = 90_000;
  const result: string | null = await Promise.race([
    inst.authorize().then((t: any) => t || null).catch(() => null),
    new Promise<string | null>((resolve) =>
      setTimeout(() => resolve(inst.isAuthorized && inst.musicUserToken ? inst.musicUserToken : null), TIMEOUT_MS)
    ),
  ]);
  return result;
}

export async function unauthorize(): Promise<void> {
  if (isInNativeApp()) {
    setCachedNativeUserToken(null);
    return;
  }
  try {
    const inst = await getInstance();
    await inst.unauthorize();
  } catch { /* ignore */ }
}

export interface AppleMusicPlaylistSummary {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  trackCount: number;
}

function mapPlaylistItem(p: any): AppleMusicPlaylistSummary {
  const id: string = p.id;
  const attrs = p.attributes ?? {};
  const name: string = attrs.name ?? "Untitled playlist";
  const artworkUrl: string | null = attrs.artwork?.url
    ? String(attrs.artwork.url).replace("{w}", "200").replace("{h}", "200")
    : null;
  const trackCount: number = attrs.trackCount ?? attrs.tracks?.length ?? 0;
  const url = `https://music.apple.com/library/playlist/${id}`;
  return { id, name, url, imageUrl: artworkUrl, trackCount };
}

export async function fetchLibraryPlaylists(): Promise<AppleMusicPlaylistSummary[]> {
  if (isInNativeApp()) {
    const userToken = getCachedNativeUserToken();
    if (!userToken) throw new Error("Not authorized");
    const developerToken = await fetchDeveloperToken();
    const r = await fetch("https://api.music.apple.com/v1/me/library/playlists?limit=100", {
      headers: {
        Authorization: `Bearer ${developerToken}`,
        "Music-User-Token": userToken,
      },
    });
    if (r.status === 401 || r.status === 403) {
      // Token expired / revoked — clear cache so the UI re-prompts.
      setCachedNativeUserToken(null);
      throw new Error("Apple Music session expired. Please reconnect.");
    }
    if (!r.ok) throw new Error(`Apple Music API error (${r.status})`);
    const data = await r.json() as { data?: any[] };
    const items = Array.isArray(data?.data) ? data.data : [];
    return items.map(mapPlaylistItem);
  }

  // Web (MusicKit JS) path.
  const inst = await getInstance();
  if (!inst.isAuthorized) throw new Error("Not authorized");
  const res = await inst.api.music("v1/me/library/playlists", { limit: 100 });
  const data = res?.data ?? res;
  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  return items.map(mapPlaylistItem);
}
