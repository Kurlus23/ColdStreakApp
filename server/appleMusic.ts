// Apple MusicKit developer-token generator.
//
// Apple Music's auth model is very different from Spotify's. The SERVER only
// issues a long-lived JWT "developer token" (ES256-signed with a .p8 private
// key, max 6-month expiry). The frontend loads MusicKit JS, configures it with
// that developer token, and calls `music.authorize()` which opens Apple's own
// popup to get a per-user "music-user-token" stored in the browser. All
// playlist/library calls then happen client-side with both tokens.
//
// We therefore have nothing to store per-user on the server — no DB table,
// no refresh flow, no OAuth callback. Just sign a token and serve it.
import jwt from "jsonwebtoken";

const TEAM_ID = (process.env.APPLE_MUSIC_TEAM_ID || "").trim();
const KEY_ID = (process.env.APPLE_MUSIC_KEY_ID || "").trim();

// Normalize whatever shape the user pasted into a valid PKCS#8 PEM. Accepts:
//   • Full PEM with BEGIN/END headers and real newlines
//   • Full PEM with literal "\n" sequences (common paste-into-UI artifact)
//   • Bare base64 body only (no headers), with or without spaces / line breaks
function normalizePrivateKey(raw: string): string {
  if (!raw) return "";
  // Decode literal "\n" sequences first.
  let s = raw.replace(/\\n/g, "\n");
  // If it already has BEGIN/END markers, just return as-is.
  if (s.includes("BEGIN PRIVATE KEY") && s.includes("END PRIVATE KEY")) return s;
  // Otherwise treat the whole input as a base64 body. Strip ALL whitespace
  // (newlines, spaces, tabs) since base64 is whitespace-insensitive but the
  // PEM parser isn't tolerant of mid-line spaces.
  const body = s.replace(/\s+/g, "");
  // Re-wrap to 64-char lines (PEM convention).
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
}

const PRIVATE_KEY = normalizePrivateKey(process.env.APPLE_MUSIC_PRIVATE_KEY || "");

// Apple's hard cap is 6 months. We use 5 months to leave headroom and refresh
// proactively when within 1 day of expiry.
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30 * 5; // ~5 months
const REFRESH_BEFORE_SEC = 60 * 60 * 24; // refresh if <1 day remaining

let cached: { token: string; expiresAt: number } | null = null;

export function isAppleMusicConfigured(): boolean {
  return !!TEAM_ID && !!KEY_ID && !!PRIVATE_KEY && PRIVATE_KEY.includes("BEGIN PRIVATE KEY");
}

export function generateDeveloperToken(): string {
  if (!isAppleMusicConfigured()) {
    throw new Error("Apple Music is not configured: missing APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, or APPLE_MUSIC_PRIVATE_KEY");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - nowSec > REFRESH_BEFORE_SEC) {
    return cached.token;
  }
  const token = jwt.sign(
    {
      iss: TEAM_ID,
      iat: nowSec,
      exp: nowSec + TOKEN_TTL_SEC,
    },
    PRIVATE_KEY,
    {
      algorithm: "ES256",
      header: { alg: "ES256", kid: KEY_ID },
    }
  );
  cached = { token, expiresAt: nowSec + TOKEN_TTL_SEC };
  return token;
}
