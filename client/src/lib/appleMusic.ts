// Apple MusicKit JS wrapper.
//
// Apple's MusicKit JS handles user auth + per-user "music-user-token"
// management entirely in the browser. We just need to (a) wait for the script
// to load, (b) configure it once with our server-issued developer token, and
// (c) expose authorize/playlists helpers to the UI.

import { Capacitor } from "@capacitor/core";

declare global {
  interface Window {
    MusicKit?: any;
  }
}

const APP_NAME = "ColdStreak";
const APP_BUILD = "1.0.0";

// MusicKit JS uses iframe + postMessage for its auth popup. That model is
// effectively broken inside iOS WKWebView (Capacitor) — the user can complete
// Apple's auth, but the result never propagates back to our WebView, so the
// authorize() promise hangs forever. Until we add a native iOS MusicKit
// plugin, we hard-disable Apple Music inside the native app and tell users
// to link from the web.
export function isInNativeApp(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

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

async function fetchDeveloperToken(): Promise<string> {
  const r = await fetch("/api/apple-music/developer-token", { credentials: "same-origin" });
  if (!r.ok) {
    if (r.status === 503) throw new Error("Apple Music isn't enabled on this server.");
    throw new Error(`Failed to fetch Apple Music developer token (${r.status})`);
  }
  const data = await r.json() as { token?: string; error?: string };
  if (!data.token) throw new Error(data.error || "Empty developer token");
  return data.token;
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
    // Allow retry on next call instead of permanently caching the failure.
    configurePromise = null;
    throw err;
  }
}

export async function isAvailable(): Promise<boolean> {
  // Hard-disable inside Capacitor — see note at top of file.
  if (isInNativeApp()) return false;
  try {
    await getInstance();
    return true;
  } catch {
    return false;
  }
}

export async function isAuthorized(): Promise<boolean> {
  try {
    const inst = await getInstance();
    return !!inst.isAuthorized;
  } catch {
    return false;
  }
}

export async function authorize(): Promise<string | null> {
  const inst = await getInstance();
  // MusicKit's authorize() opens Apple's own popup and returns the
  // music-user-token on success, or throws / returns falsy on cancel.
  // We race against a 90s timeout because in some browser/popup-blocker
  // configurations the promise never settles even though the popup closed.
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
  try {
    const inst = await getInstance();
    await inst.unauthorize();
  } catch {
    /* ignore */
  }
}

export interface AppleMusicPlaylistSummary {
  id: string;
  name: string;
  url: string;          // music.apple.com deep link (works on iOS/macOS Apple Music app via universal link)
  imageUrl: string | null;
  trackCount: number;
}

export async function fetchLibraryPlaylists(): Promise<AppleMusicPlaylistSummary[]> {
  const inst = await getInstance();
  if (!inst.isAuthorized) throw new Error("Not authorized");

  // MusicKit v3 exposes inst.api.music(path, params) which adds both the
  // developer token and music-user-token automatically.
  const res = await inst.api.music("v1/me/library/playlists", { limit: 100 });
  const data = res?.data ?? res;
  const items: any[] = Array.isArray(data?.data) ? data.data : [];

  return items.map((p) => {
    const id: string = p.id;
    const attrs = p.attributes ?? {};
    const name: string = attrs.name ?? "Untitled playlist";
    const artworkUrl: string | null = attrs.artwork?.url
      ? String(attrs.artwork.url).replace("{w}", "200").replace("{h}", "200")
      : null;
    const trackCount: number = attrs.trackCount ?? attrs.tracks?.length ?? 0;
    // Library playlists deep-link via the user's library on music.apple.com.
    // On iOS/macOS this opens the Apple Music app through Apple's universal-
    // link handling. On Android/Windows it falls back to the web player.
    const url = `https://music.apple.com/library/playlist/${id}`;
    return { id, name, url, imageUrl: artworkUrl, trackCount };
  });
}
