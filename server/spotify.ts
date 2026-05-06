// Spotify OAuth + API helpers (per-user Auth Code flow with client secret).
// Tokens are stored per ColdStreak user in `spotify_accounts` and refreshed
// lazily when expired.
import jwt from "jsonwebtoken";
import { getSpotifyAccount, updateSpotifyTokens, deleteSpotifyAccount } from "./storage";

if (!process.env.SESSION_SECRET) {
  console.warn("[spotify] SESSION_SECRET is not set — using insecure fallback. Set SESSION_SECRET in production.");
}

const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

// Minimum scopes for current features: identity (display name) + playlist reads.
// Do NOT add email/library/top scopes unless we actually use them.
export const SPOTIFY_SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

function getRedirectUri(): string {
  const origin = (process.env.SITE_URL || "https://coldstreakapp.com").replace(/\/$/, "");
  return `${origin}/api/spotify/callback`;
}

// Short-lived signed state binding the OAuth callback to the originating user.
export function signState(userId: number): string {
  return jwt.sign({ uid: userId, n: Math.random().toString(36).slice(2, 10) }, JWT_SECRET, { expiresIn: "10m" });
}
export function verifyState(state: string): { uid: number } | null {
  try {
    const decoded = jwt.verify(state, JWT_SECRET) as { uid: number };
    if (typeof decoded?.uid !== "number") return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "false",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Spotify token exchange failed: ${r.status} ${txt}`);
  }
  return (await r.json()) as TokenResponse;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return postToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  }));
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }));
}

export interface SpotifyMe {
  id: string;
  display_name: string | null;
  email?: string;
}

export async function fetchSpotifyMe(accessToken: string): Promise<SpotifyMe> {
  const r = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error(`[spotify] /me ${r.status} body:`, body);
    // 403 in Development Mode = user not on app's allowlist. Surface a friendly
    // message so the connection-failed page tells the user what to do.
    if (r.status === 403) {
      throw new Error(
        `Your Spotify account isn't on this app's tester list yet. Open the Spotify Developer Dashboard → ColdStreak app → User Management, and add the EXACT email Spotify has on file for your account (check spotify.com/account if you signed up with Facebook). Then try again. (Spotify said: ${body.slice(0, 200)})`
      );
    }
    throw new Error(`Spotify /me failed: ${r.status} ${body.slice(0, 200)}`);
  }
  return (await r.json()) as SpotifyMe;
}

// Returns a fresh access token, refreshing if necessary. Returns null if the
// user has no connected Spotify account or the refresh failed (in which case
// the stored account should be considered broken — caller may surface a
// "reconnect" prompt to the user).
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const acct = await getSpotifyAccount(userId);
  if (!acct) return null;
  const safetyMs = 60_000; // refresh if <60s remaining
  if (acct.expiresAt.getTime() > Date.now() + safetyMs) return acct.accessToken;
  try {
    const refreshed = await refreshAccessToken(acct.refreshToken);
    const newExpires = new Date(Date.now() + refreshed.expires_in * 1000);
    await updateSpotifyTokens(userId, refreshed.access_token, newExpires, refreshed.refresh_token);
    return refreshed.access_token;
  } catch (err) {
    console.error("[spotify] token refresh failed for user", userId, "— disconnecting:", err);
    // Refresh token is dead (revoked / expired / scope changed). Drop the row so
    // /api/spotify/me reports connected:false and the UI surfaces "Reconnect".
    try { await deleteSpotifyAccount(userId); } catch (e) { console.error("[spotify] cleanup failed", e); }
    return null;
  }
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  url: string; // open.spotify.com URL for deep-linking
  imageUrl: string | null;
  trackCount: number;
  owner: string;
}

export async function fetchUserPlaylists(accessToken: string, limit = 50): Promise<SpotifyPlaylistSummary[]> {
  const r = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Spotify playlists failed: ${r.status}`);
  const data = await r.json() as { items: any[] };
  return (data.items ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? "Untitled",
    url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
    imageUrl: Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : null,
    trackCount: p.tracks?.total ?? 0,
    owner: p.owner?.display_name ?? "",
  }));
}

export function isSpotifyConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}
