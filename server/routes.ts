import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import type { UserLocation } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail, sendMilestoneEmail, sendAdminSecurityAlert, sendSupportEmail, sendAdminReplyEmail, sendCoManagerInviteEmail } from "./email";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:ColdStreakApp17@gmail.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const TEST_MODE = process.env.USE_STRIPE_TEST === "true";
const stripeSecretKey = TEST_MODE
  ? process.env.STRIPE_TEST_SECRET_KEY!
  : process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });

if (TEST_MODE) console.log("[stripe] ⚠️  TEST MODE — using Stripe test keys");
if (TEST_MODE) console.log("[stripe] TEST_PRICE_ID:", process.env.STRIPE_TEST_PRICE_ID);
if (TEST_MODE) console.log("[stripe] TEST_ANNUAL_PRICE_ID:", process.env.STRIPE_TEST_ANNUAL_PRICE_ID);
if (TEST_MODE) console.log("[stripe] TEST_MONTHLY_PRICE_ID:", process.env.STRIPE_TEST_MONTHLY_PRICE_ID);

// Lifetime pricing phases
const LIFETIME_PRICE_IDS: Record<1 | 2 | 3, string> = TEST_MODE
  ? {
      1: process.env.STRIPE_TEST_PRICE_ID!,
      2: process.env.STRIPE_TEST_PRICE_ID!,
      3: process.env.STRIPE_TEST_PRICE_ID!,
    }
  : {
      1: process.env.STRIPE_PRICE_ID!,          // $19.99 — Early Adopter
      2: process.env.STRIPE_LIFETIME_PRICE_ID_P2 || process.env.STRIPE_PRICE_ID!, // $24.99
      3: process.env.STRIPE_LIFETIME_PRICE_ID_P3 || process.env.STRIPE_PRICE_ID!, // $29.99
    };
const LIFETIME_PRICES: Record<1 | 2 | 3, number> = { 1: 19.99, 2: 24.99, 3: 29.99 };
const LIFETIME_LABELS: Record<1 | 2 | 3, string> = {
  1: "Early Adopter",
  2: "Standard",
  3: "Standard",
};

function getLifetimePhase(fpRemaining: number): 1 | 2 | 3 {
  const override = process.env.LIFETIME_PRICE_PHASE;
  if (override === "3") return 3;
  if (override === "2") return 2;
  return fpRemaining > 0 ? 1 : 2;
}

// Legacy alias so existing checkout code still compiles
const PRICE_ID = TEST_MODE ? process.env.STRIPE_TEST_PRICE_ID! : process.env.STRIPE_PRICE_ID!;

function getSiteOrigin(req: Request): string {
  const origin = req.headers.origin || "";
  if (origin && origin.startsWith("http") && !origin.includes("localhost")) return origin;
  return process.env.SITE_URL || "https://coldstreakapp.com";
}

// Trusted, request-independent canonical origin. Use this (NOT req.headers.host
// or req.get("host")) for any URL that will be embedded in outbound emails,
// open-graph tags, or other content where Host-header poisoning would let an
// attacker swap in a malicious domain.
function getCanonicalOrigin(): string {
  return (process.env.SITE_URL || "https://coldstreakapp.com").replace(/\/$/, "");
}
const ANNUAL_PRICE_ID = TEST_MODE
  ? process.env.STRIPE_TEST_ANNUAL_PRICE_ID!
  : process.env.STRIPE_ANNUAL_PRICE_ID!;
const MONTHLY_PRICE_ID = TEST_MODE
  ? process.env.STRIPE_TEST_MONTHLY_PRICE_ID!
  : (process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID!);
const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const ADMIN_EMAILS = new Set(["coldstreakapp17@gmail.com"]);
// Usernames whose login/reset events trigger a security alert to coldstreakapp17@gmail.com
const MONITORED_USERNAMES = new Set(["CStreak28"]);
const MONITORED_EMAILS = new Set(["coldstreakapp17@gmail.com"]);

// In-memory cache for pro-status Stripe lookups (avoids ~1.5s Stripe API call on every load)
// Caches: customer IDs (slow lookup), subscription status (monthly/annual)
// NOT cached: one-time payment check (needed to detect lifetime upgrades immediately)
const customerIdCache = new Map<string, { ids: string[]; expiresAt: number }>();
const subscriptionCache = new Map<string, { result: object; expiresAt: number }>();
const CUSTOMER_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SUB_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedCustomerIds(email: string): string[] | null {
  const c = customerIdCache.get(email);
  return c && c.expiresAt > Date.now() ? c.ids : null;
}
function setCachedCustomerIds(email: string, ids: string[]) {
  // Never cache an empty list — the user may not have a Stripe customer yet but could create one
  // immediately via checkout. An empty cache hit would block detection for 10 minutes.
  if (ids.length === 0) return;
  customerIdCache.set(email, { ids, expiresAt: Date.now() + CUSTOMER_TTL_MS });
}
function getCachedSubscription(email: string) {
  const c = subscriptionCache.get(email);
  return c && c.expiresAt > Date.now() ? c.result : null;
}
function setCachedSubscription(email: string, result: object) {
  subscriptionCache.set(email, { result, expiresAt: Date.now() + SUB_TTL_MS });
}
function clearProStatusCache(email: string) {
  customerIdCache.delete(email);
  subscriptionCache.delete(email);
}
// Legacy alias used in pro-status endpoint
function setProStatusCache(email: string, result: object) { setCachedSubscription(email, result); }
function getProStatusCache(email: string) { return getCachedSubscription(email); }

interface JwtPayload { userId: number; email: string; isAdmin?: boolean; }

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "90d" });
}

function isCallerAdmin(caller: JwtPayload | null): boolean {
  if (!caller) return false;
  const email = caller.email.toLowerCase().trim();
  return !!caller.isAdmin || ADMIN_EMAILS.has(email);
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function extractUser(req: Request): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

async function seedPromoCodes() {
  try {
    const { db } = await import("./db");
    const { promoCodes } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const seeds = [
      { code: "TESTINGPRO", durationDays: 30, maxUses: 20 },
    ];
    for (const seed of seeds) {
      const [existing] = await db.select().from(promoCodes).where(eq(promoCodes.code, seed.code));
      if (!existing) {
        await db.insert(promoCodes).values(seed);
        console.log(`[seed] Created promo code: ${seed.code}`);
      } else if (existing.maxUses !== seed.maxUses) {
        await db.update(promoCodes).set({ maxUses: seed.maxUses }).where(eq(promoCodes.code, seed.code));
        console.log(`[seed] Updated promo code ${seed.code} maxUses to ${seed.maxUses}`);
      }
    }
  } catch (err) {
    console.error("[seed] Failed to seed promo codes:", err);
  }
}

async function seedAdminAccount() {
  try {
    // Primary admin (legacy)
    const adminEmail = process.env.ADMIN_EMAIL || "admin@coldstreakapp.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "ColdStreak-Admin-2026!";
    const hash = await bcrypt.hash(adminPassword, 12);
    await storage.upsertAdminAccount(adminEmail, hash);

    // CStreak28 admin — login by username, recovery by email
    const cstreakEmail = process.env.CSTREAK_EMAIL || "coldstreakapp17@gmail.com";
    const cstreakPassword = process.env.CSTREAK_PASSWORD || "Shaf@28135!28135!";
    const cstreakHash = await bcrypt.hash(cstreakPassword, 12);
    await storage.upsertAdminAccount(cstreakEmail, cstreakHash, { username: "CStreak28" });
  } catch (err) {
    console.error("[seed] Failed to seed admin account:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Object Storage upload routes ────────────────────────────────────────
  const { registerObjectStorageRoutes } = await import("./replit_integrations/object_storage");
  registerObjectStorageRoutes(app);

  // ── Android App Links verification ──────────────────────────────────────
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const sha256 = process.env.ANDROID_SHA256_CERT;
    const links = sha256
      ? [{
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.coldstreak.app",
            sha256_cert_fingerprints: [sha256],
          },
        }]
      : [];
    res.setHeader("Content-Type", "application/json");
    res.json(links);
  });

  await seedPromoCodes();
  await seedAdminAccount();

  // ── Auth ──────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "An account with this email already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser(email, passwordHash);
      const token = signToken({ userId: user.id, email: user.email });

      // Send verification email (fire and forget — don't block signup)
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await storage.setVerifyToken(user.id, verifyToken);
      const origin = getSiteOrigin(req);
      sendVerificationEmail(email, `${origin}/verify-email?token=${verifyToken}`).catch(console.error);

      // Milestone notification — fire and forget
      const MILESTONES = [100, 500, 1000, 2500, 5000, 10000];
      storage.getUserCount().then((count) => {
        if (MILESTONES.includes(count)) {
          sendMilestoneEmail(count, count).catch(console.error);
        }
      }).catch(console.error);

      res.status(201).json({ token, user: { id: user.id, email: user.email, emailVerified: false } });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // One-time admin password reset, gated by a long shared secret.
  // Used to recover admin access on production where direct DB writes are off-limits.
  // Requires header: X-Admin-Reset-Secret to exactly match env ADMIN_RESET_SECRET.
  app.post("/api/admin/force-password-reset", async (req, res) => {
    const expected = process.env.ADMIN_RESET_SECRET;
    if (!expected || expected.length < 8) {
      return res.status(503).json({ message: "Endpoint not configured" });
    }
    const provided = req.headers["x-admin-reset-secret"];
    if (typeof provided !== "string" || provided !== expected) {
      console.warn("[admin-reset] denied — bad/missing secret from", req.ip);
      return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = z.object({
      email: z.string().email(),
      newPassword: z.string().min(10).max(200),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await storage.updatePassword(user.id, passwordHash);
    console.log(`[admin-reset] password reset for user id=${user.id} email=${user.email}`);
    res.json({ success: true, userId: user.id, email: user.email });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      // Accept email address OR username in the same field
      const { email: loginId, password } = z.object({
        email: z.string().min(1, "Email or username is required"),
        password: z.string().min(1),
      }).parse(req.body);

      const isEmail = loginId.includes("@");
      const user = isEmail
        ? await storage.getUserByEmail(loginId)
        : await storage.getUserByUsername(loginId);

      if (!user) return res.status(401).json({ message: "Invalid email/username or password" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email/username or password" });

      if (user.isDisabled) return res.status(403).json({ message: "This account is currently disabled." });

      // Security alert for monitored admin accounts (fire-and-forget)
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress;
      if ((user.username && MONITORED_USERNAMES.has(user.username)) || MONITORED_EMAILS.has(user.email)) {
        sendAdminSecurityAlert("login", user.username ?? user.email, ip).catch(console.error);
      }

      const token = signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin });
      res.json({ token, user: { id: user.id, email: user.email, emailVerified: user.emailVerified, isAdmin: user.isAdmin } });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user.id, email: user.email, emailVerified: user.emailVerified, isAdmin: !!user.isAdmin });
  });

  app.get("/api/auth/profile", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ displayName: user.displayName ?? null, bodyWeight: user.bodyWeight ?? null });
  });

  app.patch("/api/auth/profile", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const existing = await storage.getUserById(payload.userId);
    if (!existing) return res.status(401).json({ message: "User not found" });
    const { displayName, bodyWeight } = req.body;
    const patch: { displayName?: string; bodyWeight?: number } = {};
    if (typeof displayName === "string") patch.displayName = displayName.trim().slice(0, 32);
    if (typeof bodyWeight === "number" && bodyWeight > 0) patch.bodyWeight = Math.round(bodyWeight);
    const user = await storage.updateUserProfile(payload.userId, patch);
    res.json({ displayName: user.displayName ?? null, bodyWeight: user.bodyWeight ?? null });
  });

  app.delete("/api/auth/account", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(payload.userId);
    if (user?.email) {
      await storage.deleteProUser(user.email).catch(() => {});
      customerIdCache.delete(user.email);
      subscriptionCache.delete(user.email);
    }
    await storage.deleteUser(payload.userId);
    res.json({ ok: true });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ message: "Missing token" });
    try {
      const user = await storage.verifyEmailToken(token);
      if (!user) return res.status(400).json({ message: "Invalid or already used verification link" });
      res.json({ ok: true, emailVerified: true });
    } catch (err) {
      console.error("[verify-email] DB error:", err);
      res.status(503).json({ message: "Server temporarily unavailable — please try again in a moment." });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.emailVerified) return res.json({ ok: true, already: true });
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await storage.setVerifyToken(user.id, verifyToken);
    const origin = getSiteOrigin(req);
    sendVerificationEmail(user.email, `${origin}/verify-email?token=${verifyToken}`).catch(console.error);
    res.json({ ok: true });
  });

  // Claim local (clientId) plunges to the logged-in account
  app.post("/api/auth/sync", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { clientId } = z.object({ clientId: z.string().min(1) }).parse(req.body);
      await storage.claimPlunges(clientId, payload.userId);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const found = await storage.setResetToken(email, token, expiry);
      if (found) {
        const origin = getSiteOrigin(req);
        const resetUrl = `${origin}/reset-password?token=${token}`;
        await sendPasswordResetEmail(email, resetUrl);

        // Security alert for monitored admin accounts (fire-and-forget)
        if (MONITORED_EMAILS.has(email.toLowerCase())) {
          const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress;
          sendAdminSecurityAlert("password_reset", email, ip).catch(console.error);
        }
      }
      // Always respond OK — don't reveal whether email exists
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return res.status(400).json({ message: "Reset link is invalid or has expired" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updatePassword(user.id, passwordHash);
      await storage.clearResetToken(user.id);

      const authToken = signToken({ userId: user.id, email: user.email });
      res.json({ token: authToken, user: { id: user.id, email: user.email } });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // ── Plunges ────────────────────────────────────────────────────────────

  app.get(api.plunges.list.path, async (req, res) => {
    const authUser = extractUser(req);
    if (authUser) {
      const allPlunges = await storage.getPlunges(undefined, authUser.userId);
      return res.json(allPlunges);
    }
    const clientId = req.query.clientId as string | undefined;
    const allPlunges = await storage.getPlunges(clientId);
    res.json(allPlunges);
  });

  app.post(api.plunges.create.path, async (req, res) => {
    try {
      const authUser = extractUser(req);
      const { createdAt: customDateStr, ...input } = api.plunges.create.input.parse(req.body);
      const plungeData: any = { ...input, score: String(input.score) };
      if (customDateStr) plungeData.createdAt = new Date(customDateStr);
      if (authUser) plungeData.userId = authUser.userId;
      const tzHeader = req.headers["x-client-timezone"];
      if (typeof tzHeader === "string" && tzHeader.length > 0 && tzHeader.length <= 64) {
        plungeData.timezone = tzHeader;
      }
      const newPlunge = await storage.createPlunge(plungeData);
      res.status(201).json(newPlunge);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch("/api/plunges/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const patch = api.plunges.update.input.parse(req.body);
      const updated = await storage.updatePlunge(id, patch);
      if (!updated) return res.status(404).json({ message: "Plunge not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.plunges.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deletePlunge(id);
    res.status(204).send();
  });

  // ── Leaderboard ────────────────────────────────────────────────────────

  app.get("/api/leaderboard/:locationId", async (req, res) => {
    const { locationId } = req.params;
    const entries = await storage.getLeaderboard(locationId);
    res.json(entries);
  });

  app.post("/api/leaderboard", async (req, res) => {
    try {
      const input = api.leaderboard.submit.input.parse(req.body);

      // ── Range validation: reject entries outside realistic bounds ──
      const TEMP_MIN = 33; // °F — water freezes at 32°F; 33 is the realistic floor
      const TEMP_MAX = 65; // °F — above this it's not cold exposure
      const DURATION_MIN = 5;    // seconds
      const DURATION_MAX = 1800; // 30 minutes
      if (input.temperature < TEMP_MIN || input.temperature > TEMP_MAX) {
        return res.status(400).json({ message: `Temperature must be between ${TEMP_MIN}°F and ${TEMP_MAX}°F for leaderboard submission.` });
      }
      if (input.duration < DURATION_MIN || input.duration > DURATION_MAX) {
        return res.status(400).json({ message: `Duration must be between ${DURATION_MIN}s and ${DURATION_MAX}s for leaderboard submission.` });
      }

      const entry = await storage.addLeaderboardEntry({ ...input, score: String(input.score) });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/leaderboard/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteLeaderboardEntry(id);
    res.status(204).send();
  });

  // ── Streak freezes (Pro feature) ───────────────────────────────────────
  // Pro users get up to MAX_FREEZES_PER_MONTH (2) calendar-month freezes that retroactively
  // protect a missed day so the streak doesn't break. Date is YYYY-MM-DD in user local tz.
  const MAX_FREEZES_PER_MONTH = 2;

  app.get("/api/streak-freezes", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const { getStreakFreezes } = await import("./storage");
    const freezes = await getStreakFreezes(caller.userId);
    const yearMonth = new Date().toISOString().slice(0, 7);
    const usedThisMonth = freezes.filter(f => (f.freezeDate ?? "").startsWith(yearMonth)).length;
    res.json({
      freezes: freezes.map(f => f.freezeDate),
      usedThisMonth,
      remainingThisMonth: Math.max(0, MAX_FREEZES_PER_MONTH - usedThisMonth),
      monthlyLimit: MAX_FREEZES_PER_MONTH,
    });
  });

  app.post("/api/streak-freezes", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const proUser = await storage.getProUser(caller.email);
    if (!proUser?.active) return res.status(403).json({ error: "Pro subscription required" });
    const { freezeDate } = req.body ?? {};
    if (typeof freezeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(freezeDate)) {
      return res.status(400).json({ error: "freezeDate must be YYYY-MM-DD" });
    }
    // Strict calendar-date validation — regex alone allows e.g. 2026-99-99 → Invalid Date
    const [yy, mm, dd] = freezeDate.split("-").map(Number);
    const target = new Date(yy, mm - 1, dd);
    if (target.getFullYear() !== yy || target.getMonth() !== mm - 1 || target.getDate() !== dd) {
      return res.status(400).json({ error: "freezeDate is not a valid calendar date" });
    }
    target.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
    if (diffDays < 1 || diffDays > 6) {
      return res.status(400).json({ error: "Can only freeze a missed day from the past 6 days" });
    }
    // Enforce "missed day" rule — reject if user actually plunged on that local date
    const userPlunges = await storage.getPlunges(undefined, caller.userId);
    const plungedOnDay = userPlunges.some((p) => {
      const pd = new Date(p.createdAt);
      return pd.getFullYear() === yy && pd.getMonth() === mm - 1 && pd.getDate() === dd;
    });
    if (plungedOnDay) {
      return res.status(400).json({ error: "You already plunged on that day — no freeze needed" });
    }
    // Check monthly limit + duplicate (race-tolerant: rely on DB unique index for final guard)
    const { getStreakFreezes, createStreakFreeze } = await import("./storage");
    const existing = await getStreakFreezes(caller.userId);
    if (existing.some(f => f.freezeDate === freezeDate)) {
      return res.status(409).json({ error: "Day already frozen" });
    }
    const yearMonth = freezeDate.slice(0, 7);
    const usedInMonth = existing.filter(f => (f.freezeDate ?? "").startsWith(yearMonth)).length;
    if (usedInMonth >= MAX_FREEZES_PER_MONTH) {
      return res.status(429).json({ error: `Monthly limit reached (${MAX_FREEZES_PER_MONTH} freezes per calendar month)` });
    }
    try {
      const created = await createStreakFreeze(caller.userId, freezeDate);
      res.json({ freeze: created });
    } catch (err: any) {
      // Unique index violation (concurrent duplicate) — convert to 409
      if (err?.code === "23505") return res.status(409).json({ error: "Day already frozen" });
      throw err;
    }
  });

  // ── Spotify OAuth (per-user) ───────────────────────────────────────────
  // Auth Code flow w/ client secret. State is a short-lived signed JWT binding
  // the callback to the user that initiated the flow. Tokens stored per-user
  // in spotify_accounts and refreshed lazily.
  app.get("/api/spotify/login", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const sp = await import("./spotify");
    if (!sp.isSpotifyConfigured()) return res.status(503).json({ error: "Spotify not configured" });
    const state = sp.signState(caller.userId);
    const url = sp.buildAuthorizeUrl(state);
    res.json({ url });
  });

  app.get("/api/spotify/callback", async (req, res) => {
    const sp = await import("./spotify");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const errParam = typeof req.query.error === "string" ? req.query.error : "";
    const renderClose = (ok: boolean, message: string) => {
      const safe = message.replace(/[<>&]/g, "");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? "Spotify connected" : "Spotify connection failed"}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center}.card{max-width:380px;background:#162033;border:1px solid #1e3a5f;border-radius:16px;padding:1.75rem}.ok{color:#34d399}.err{color:#f87171}h1{font-size:1.1rem;margin:.5rem 0}p{font-size:.85rem;color:#94a3b8;margin:.5rem 0 1rem}button{background:#06b6d4;color:white;border:0;padding:.6rem 1.25rem;border-radius:9999px;font-weight:600;font-size:.85rem;cursor:pointer}</style>
</head><body><div class="card"><div class="${ok ? 'ok' : 'err'}" style="font-size:2rem">${ok ? '✓' : '✕'}</div><h1>${ok ? 'Spotify connected!' : 'Connection failed'}</h1><p>${safe}</p><button onclick="window.close()">Close window</button></div>
<script>try{if(window.opener){window.opener.postMessage({type:'spotify:${ok ? 'connected' : 'error'}'},'*');}}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},800);</script>
</body></html>`);
    };
    if (errParam) return renderClose(false, `Spotify returned: ${errParam}`);
    if (!code || !state) return renderClose(false, "Missing code or state.");
    const verified = sp.verifyState(state);
    if (!verified) return renderClose(false, "State token expired or invalid. Please try connecting again.");
    try {
      const tokens = await sp.exchangeCodeForTokens(code);
      const me = await sp.fetchSpotifyMe(tokens.access_token);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      const { upsertSpotifyAccount } = await import("./storage");
      await upsertSpotifyAccount({
        userId: verified.uid,
        spotifyUserId: me.id,
        displayName: me.display_name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt,
        scope: tokens.scope ?? null,
      });
      return renderClose(true, `Linked as ${me.display_name || me.id}. You can close this window and return to ColdStreak.`);
    } catch (err: any) {
      console.error("[spotify] callback error", err);
      return renderClose(false, err?.message || "Something went wrong exchanging the code.");
    }
  });

  app.get("/api/spotify/me", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const { getSpotifyAccount } = await import("./storage");
    const acct = await getSpotifyAccount(caller.userId);
    if (!acct) return res.json({ connected: false });
    res.json({
      connected: true,
      spotifyUserId: acct.spotifyUserId,
      displayName: acct.displayName,
      scope: acct.scope,
    });
  });

  app.get("/api/spotify/playlists", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const sp = await import("./spotify");
    const token = await sp.getValidAccessToken(caller.userId);
    if (!token) return res.status(401).json({ error: "Spotify not connected or token refresh failed", reconnect: true });
    try {
      const playlists = await sp.fetchUserPlaylists(token);
      res.json({ playlists });
    } catch (err: any) {
      console.error("[spotify] playlists error", err);
      res.status(502).json({ error: "Failed to fetch playlists from Spotify" });
    }
  });

  app.post("/api/spotify/disconnect", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.userId) return res.status(401).json({ error: "Auth required" });
    const { deleteSpotifyAccount } = await import("./storage");
    await deleteSpotifyAccount(caller.userId);
    res.json({ ok: true });
  });

  // ── Apple Music ────────────────────────────────────────────────────────
  // Returns a developer token (long-lived, ~5-month expiry) for MusicKit JS to
  // configure itself with. This token is intentionally public — it identifies
  // OUR app to Apple Music, not the end user. Per-user auth (the music-user-
  // token) is handled entirely in the browser by MusicKit JS.
  app.get("/api/apple-music/developer-token", async (_req, res) => {
    try {
      const { generateDeveloperToken, isAppleMusicConfigured } = await import("./appleMusic");
      if (!isAppleMusicConfigured()) {
        return res.status(503).json({ error: "Apple Music not configured" });
      }
      const token = generateDeveloperToken();
      // Allow the browser to cache for an hour; we refresh server-side anyway.
      res.set("Cache-Control", "private, max-age=3600");
      res.json({ token });
    } catch (err) {
      console.error("[apple-music] developer token generation failed", err);
      res.status(500).json({ error: "Failed to generate developer token" });
    }
  });

  // ── Community locations ────────────────────────────────────────────────

  app.get("/api/community-locations", async (req, res) => {
    const country = req.query.country as string | undefined;
    const caller = extractUser(req);
    const callerEmail = caller?.email?.toLowerCase().trim() ?? null;
    const admin = isCallerAdmin(caller);
    const locations = await storage.getUserLocations(country, admin);
    const sanitized = locations.map(({ contactEmail, ...rest }) => ({
      ...rest,
      isOwner: callerEmail ? callerEmail === (contactEmail ?? "").toLowerCase().trim() : false,
      isAdmin: admin,
    }));
    res.json(sanitized);
  });

  const locationInputSchema = z.object({
    name: z.string().min(2).max(100),
    country: z.string().min(2).max(60),
    state: z.string().max(60).optional(),
    city: z.string().max(60).optional(),
    description: z.string().max(300).optional(),
    submittedBy: z.string().max(50).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accessLat: z.number().min(-90).max(90).nullable().optional(),
    accessLng: z.number().min(-180).max(180).nullable().optional(),
    isBusiness: z.boolean().optional(),
    websiteUrl: z.string().url().max(300).optional().or(z.literal("")),
    phone: z.string().max(30).optional(),
    yelpUrl: z.string().url().max(300).optional().or(z.literal("")),
    facebookUrl: z.string().url().max(300).optional().or(z.literal("")),
    bookingUrl: z.string().url().max(300).optional().or(z.literal("")),
    contactEmail: z.string().email().max(200).optional(),
    fullAddress: z.string().max(200).optional(),
    modalities: z.array(z.string().max(50)).max(20).optional(),
  });

  app.post("/api/community-locations", async (req, res) => {
    try {
      const input = locationInputSchema.parse(req.body);
      const caller = extractUser(req);
      // Auto-attach the caller's email for ownership tracking
      if (caller?.email && !input.contactEmail) {
        (input as any).contactEmail = caller.email.toLowerCase().trim();
      }
      const loc = await storage.createUserLocation(input);
      res.status(201).json(loc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/community-locations/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const caller = extractUser(req);
      if (!caller) return res.status(401).json({ message: "Unauthorized" });
      const loc = await storage.getUserLocationById(id);
      if (!loc) return res.status(404).json({ message: "Location not found" });
      const admin = isCallerAdmin(caller);
      const isOwner = loc.contactEmail
        ? loc.contactEmail.toLowerCase().trim() === caller.email.toLowerCase().trim()
        : false;
      if (!admin && !isOwner) {
        return res.status(403).json({ message: "Not the owner of this location" });
      }
      const updates = locationInputSchema.partial().parse(req.body);
      const updated = await storage.updateUserLocation(id, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/community-locations/:id/nominate", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const loc = await storage.getUserLocationById(id);
    if (!loc) return res.status(404).json({ message: "Location not found" });
    const caller = extractUser(req);
    if (caller?.email && loc.contactEmail &&
        caller.email.toLowerCase().trim() === loc.contactEmail.toLowerCase().trim()) {
      return res.status(403).json({ message: "You cannot vote for your own listing." });
    }
    const updated = await storage.nominateUserLocation(id);
    if (!updated) return res.status(404).json({ message: "Location not found" });
    res.json(updated);
  });

  app.post("/api/community-locations/:id/view", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const caller = extractUser(req);
    const clientId = (req.headers["x-client-id"] as string | undefined) ?? null;
    try {
      await storage.recordLocationView({ locationId: id, userId: caller?.userId ?? null, clientId });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === "23503") return res.status(404).json({ message: "Listing not found" });
      console.error("[view tracking]", err);
      res.status(500).json({ message: "Tracking failed" });
    }
  });

  // ── Click endpoint rate limit ──────────────────────────────────────────────
  // Simple in-memory token bucket: max 30 clicks per IP per listing per minute.
  // Protects analytics from bot inflation. Map sweep on access keeps memory bounded.
  const CLICK_LIMIT = 30;
  const CLICK_WINDOW_MS = 60_000;
  const clickHits = new Map<string, { count: number; resetAt: number }>();
  function clickRateLimitOk(ip: string, listingId: number): boolean {
    const key = `${ip}:${listingId}`;
    const now = Date.now();
    const cur = clickHits.get(key);
    if (!cur || cur.resetAt < now) {
      clickHits.set(key, { count: 1, resetAt: now + CLICK_WINDOW_MS });
      // Opportunistic sweep — 1% of requests scrub expired entries.
      if (Math.random() < 0.01) {
        for (const [k, v] of clickHits) if (v.resetAt < now) clickHits.delete(k);
      }
      return true;
    }
    if (cur.count >= CLICK_LIMIT) return false;
    cur.count++;
    return true;
  }

  app.post("/api/community-locations/:id/click", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = z.object({
      kind: z.enum(["website", "booking", "directions", "phone", "yelp", "facebook", "share"]),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid kind" });
    // Use `req.ip` (resolved by Express via the trusted proxy chain configured
    // in server/index.ts) instead of raw `X-Forwarded-For` so attackers can't
    // bypass the limit by rotating spoofed header values.
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!clickRateLimitOk(ip, id)) {
      return res.status(429).json({ message: "Too many clicks. Try again in a moment." });
    }
    const caller = extractUser(req);
    const clientId = (req.headers["x-client-id"] as string | undefined) ?? null;
    try {
      await storage.recordLocationClick({ locationId: id, kind: parsed.data.kind, userId: caller?.userId ?? null, clientId });
      res.json({ ok: true });
    } catch (err: any) {
      // FK violation (unknown location) → 404; other errors → 500
      if (err?.code === "23503") return res.status(404).json({ message: "Listing not found" });
      console.error("[click tracking]", err);
      res.status(500).json({ message: "Tracking failed" });
    }
  });

  // ── Business owner dashboard ────────────────────────────────────────────────
  // Auth: caller must be signed in AND own the listing (caller.email matches
  // userLocations.contactEmail). All endpoints enforce this.
  async function requireBusinessOwner(req: any, res: any, locationId: number, opts?: { ownerOnly?: boolean }): Promise<{ email: string; loc: UserLocation; isOwner: boolean } | null> {
    const caller = extractUser(req);
    if (!caller?.email) {
      res.status(401).json({ message: "Sign in required" });
      return null;
    }
    const loc = await storage.getUserLocationById(locationId);
    if (!loc) {
      res.status(404).json({ message: "Listing not found" });
      return null;
    }
    const callerEmail = caller.email.toLowerCase().trim();
    const locEmail = loc.contactEmail?.toLowerCase().trim();
    const coManagers = (loc.coManagerEmails ?? []).map((e) => e.toLowerCase().trim());
    const isOwner = !!locEmail && callerEmail === locEmail;
    const isCoManager = coManagers.includes(callerEmail);
    const allowed = isOwner || (!opts?.ownerOnly && isCoManager) || isCallerAdmin(caller);
    if (!allowed) {
      res.status(403).json({ message: opts?.ownerOnly ? "Owner only." : "You don't own this listing." });
      return null;
    }
    return { email: caller.email, loc, isOwner: isOwner || isCallerAdmin(caller) };
  }

  app.get("/api/business/my-listings", async (req, res) => {
    const caller = extractUser(req);
    if (!caller?.email) return res.status(401).json({ message: "Sign in required" });
    // Admins (support staff) see every verified listing for support visibility.
    const listings = isCallerAdmin(caller)
      ? await storage.getAllVerifiedListings()
      : await storage.getMyVerifiedListings(caller.email);
    res.json(listings);
  });

  app.get("/api/business/:id/stats", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1), 365);
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    const stats = await storage.getLocationStats(id, days);
    res.json(stats);
  });

  app.get("/api/business/:id/trend", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1), 90);
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    const trend = await storage.getLocationTrend(id, days);
    res.json(trend);
  });

  app.get("/api/business/:id/leaderboard", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    const leaderboard = await storage.getLocationLeaderboard(id, limit);
    res.json(leaderboard);
  });

  // Returns (and lazily creates) the public-profile slug for an owned listing.
  app.post("/api/business/:id/slug", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    try {
      const slug = await storage.ensureLocationSlug(id);
      res.json({ slug });
    } catch (err: any) {
      console.error("[slug]", err);
      res.status(500).json({ message: "Could not generate slug" });
    }
  });

  // Update business hours. Pass null to clear.
  app.put("/api/business/:id/hours", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    const dayShape = z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
      closed: z.boolean(),
    });
    const parsed = z.object({
      hours: z.union([
        z.null(),
        z.object({ mon: dayShape, tue: dayShape, wed: dayShape, thu: dayShape, fri: dayShape, sat: dayShape, sun: dayShape }),
      ]),
      timezone: z.union([z.string().min(1).max(64), z.null()]).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid hours" });
    await storage.updateLocationHours(id, parsed.data.hours);
    if (parsed.data.timezone !== undefined) {
      await storage.updateLocationTimezone(id, parsed.data.timezone);
    }
    res.json({ ok: true });
  });

  // Co-manager management — owner-only (co-managers can't add other co-managers).
  app.post("/api/business/:id/co-managers", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ctx = await requireBusinessOwner(req, res, id, { ownerOnly: true });
    if (!ctx) return;
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Valid email required" });
    const before = ctx.loc.coManagerEmails ?? [];
    const next = await storage.addCoManager(id, parsed.data.email);
    // Send invite email only when the address was newly added (best-effort).
    const wasAdded = next.length > before.length;
    if (wasAdded) {
      // Trusted origin only — never derive email links from req.host (poisoning).
      const origin = getCanonicalOrigin();
      sendCoManagerInviteEmail({
        to: parsed.data.email,
        businessName: ctx.loc.name,
        inviterEmail: ctx.email,
        dashboardUrl: `${origin}/business`,
      }).catch((err) => console.error("[co-manager invite email]", err));
    }
    res.json({ coManagerEmails: next });
  });

  app.delete("/api/business/:id/co-managers", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ctx = await requireBusinessOwner(req, res, id, { ownerOnly: true });
    if (!ctx) return;
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Valid email required" });
    const next = await storage.removeCoManager(id, parsed.data.email);
    res.json({ coManagerEmails: next });
  });

  // CSV export for plungers at this location, with sortable column.
  app.get("/api/business/:id/export.csv", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const ctx = await requireBusinessOwner(req, res, id);
    if (!ctx) return;
    const sortBy = (String(req.query.sort ?? "bestScore")) as any;
    const allowed = ["bestScore", "plungeCount", "periodPlunges", "lastPlungeAt"];
    const safeSort = allowed.includes(sortBy) ? sortBy : "bestScore";
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1), 365);
    try {
      const csv = await storage.exportLocationPlungersCSV(id, { sortBy: safeSort, days });
      const safeName = (ctx.loc.name ?? "listing").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-plungers-${days}d.csv"`);
      res.send(csv);
    } catch (err: any) {
      console.error("[csv export]", err);
      res.status(500).json({ message: "Export failed" });
    }
  });

  // ── Public business profile (no auth) ──────────────────────────────────────
  // Sanitized view for shareable /biz/:slug pages. Never exposes contact email
  // or co-managers. Increments view count via existing tracking endpoint.
  app.get("/api/biz/:slug", async (req, res) => {
    const slug = String(req.params.slug ?? "").toLowerCase().trim();
    if (!slug) return res.status(400).json({ message: "Invalid slug" });
    const loc = await storage.getLocationBySlug(slug);
    if (!loc || !loc.isBusiness || !loc.businessVerified) {
      return res.status(404).json({ message: "Not found" });
    }
    const [leaderboard] = await Promise.all([
      storage.getLocationLeaderboard(loc.id, 10),
    ]);
    res.json({
      id: loc.id,
      slug: loc.slug,
      name: loc.name,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      fullAddress: loc.fullAddress,
      description: loc.description,
      modalities: loc.modalities,
      websiteUrl: loc.websiteUrl,
      phone: loc.phone,
      yelpUrl: loc.yelpUrl,
      facebookUrl: loc.facebookUrl,
      bookingUrl: loc.bookingUrl,
      latitude: loc.latitude,
      longitude: loc.longitude,
      hours: loc.hours ?? null,
      timezone: loc.timezone ?? null,
      viewCount: loc.viewCount,
      leaderboard,
    });
  });

  // ── OG image for /biz/:slug — dynamic SVG, cached ──────────────────────────
  // Keep it pure SVG so we don't pull in sharp/satori. Modern social platforms
  // (Twitter/X, LinkedIn, Discord, Slack, Telegram) accept image/svg+xml. For
  // platforms that don't, the og:title and og:description still drive a usable
  // link preview.
  app.get("/api/og/biz/:slug.svg", async (req, res) => {
    const slug = String(req.params.slug ?? "").toLowerCase().trim();
    if (!slug) return res.status(400).send("Invalid slug");
    const loc = await storage.getLocationBySlug(slug);
    if (!loc || !loc.isBusiness || !loc.businessVerified) {
      return res.status(404).send("Not found");
    }
    const escape = (s: string) => s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
    const name = escape(loc.name).slice(0, 60);
    const cityState = escape([loc.city, loc.state].filter(Boolean).join(", ")).slice(0, 60);
    const desc = escape((loc.description ?? "Cold plunge studio on ColdStreak").slice(0, 90));
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1430"/>
      <stop offset="1" stop-color="#0f3a5f"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.85" cy="0.15" r="0.6">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>
  <g transform="translate(80,90)">
    <text x="0" y="0" fill="#22d3ee" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="28" font-weight="700">🧊 COLDSTREAK</text>
    <text x="0" y="120" fill="#ffffff" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="76" font-weight="800">${name}</text>
    ${cityState ? `<text x="0" y="180" fill="#94a3b8" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="32" font-weight="500">${cityState}</text>` : ""}
    <text x="0" y="280" fill="#cbd5e1" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="28" font-weight="400">${desc}</text>
  </g>
  <g transform="translate(80,500)">
    <rect x="0" y="0" rx="14" ry="14" width="260" height="56" fill="#22d3ee"/>
    <text x="130" y="37" text-anchor="middle" fill="#0b1430" font-family="DM Sans, Helvetica, Arial, sans-serif" font-size="22" font-weight="800">VERIFIED ON COLDSTREAK</text>
  </g>
</svg>`;
    res.set({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    });
    res.send(svg);
  });

  // ── OG meta-tag injection for /biz/:slug (crawler-only) ────────────────────
  // For social-media crawlers we serve a minimal HTML shell with og: tags so
  // shared links produce rich previews. Real browsers fall through to the SPA.
  const CRAWLER_RE = /(facebookexternalhit|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|googlebot|bingbot|duckduckbot|applebot|pinterestbot|redditbot|embedly)/i;
  app.get("/biz/:slug", async (req, res, next) => {
    const ua = (req.headers["user-agent"] ?? "").toString();
    if (!CRAWLER_RE.test(ua)) return next(); // browsers → SPA via vite/serveStatic
    const slug = String(req.params.slug ?? "").toLowerCase().trim();
    const loc = slug ? await storage.getLocationBySlug(slug) : null;
    if (!loc || !loc.isBusiness || !loc.businessVerified) return next();
    const escape = (s: string) => s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));
    // Trusted origin only — never derive OG/canonical URLs from req.host.
    const origin = getCanonicalOrigin();
    const url = `${origin}/biz/${slug}`;
    const title = escape(`${loc.name} on ColdStreak`);
    const cityState = [loc.city, loc.state].filter(Boolean).join(", ");
    const desc = escape(loc.description ?? `${cityState ? cityState + " — " : ""}Verified cold-plunge studio on ColdStreak.`);
    const img = `${origin}/api/og/biz/${slug}.svg`;
    // Vary: User-Agent — this route serves *different* HTML based on UA (crawler
    // vs browser fall-through). Without Vary, a shared cache could pin one
    // variant and serve it to the wrong audience (broken SPA for browsers, or
    // the SPA shell for crawlers). Keep the cache short for the same reason.
    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Vary": "User-Agent",
    });
    res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:type" content="image/svg+xml"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${img}"/>
</head><body><h1>${title}</h1><p>${desc}</p><p><a href="${url}">Open on ColdStreak</a></p></body></html>`);
  });

  app.delete("/api/community-locations/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const loc = await storage.getUserLocationById(id);
    if (!loc) return res.status(404).json({ message: "Listing not found" });
    const caller = extractUser(req);
    const callerEmail = caller?.email?.toLowerCase().trim() ?? null;
    const admin = isCallerAdmin(caller);
    const isOwner = callerEmail && loc.contactEmail
      ? callerEmail === loc.contactEmail.toLowerCase().trim()
      : false;
    if (!admin && !isOwner) {
      // Fall back to email-body verification (for business owners who may not be registered)
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email required" });
      }
      if (!loc.contactEmail || loc.contactEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(403).json({ message: "Email does not match the contact email on this listing." });
      }
    }
    await storage.deleteUserLocation(id);
    res.json({ success: true });
  });

  // ── Support messages ────────────────────────────────────────────────────
  app.post("/api/support", async (req, res) => {
    const { category, message, deviceInfo, contactEmail } = req.body;
    if (!category || !message?.trim()) return res.status(400).json({ message: "Category and message are required" });
    const caller = extractUser(req);
    const email = contactEmail || caller?.email || null;
    const msg = await storage.createSupportMessage({
      userId: caller?.userId ?? null,
      username: caller?.username ?? null,
      email,
      category,
      message: message.trim(),
      deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
      status: "open",
    });
    sendSupportEmail({
      from: email ?? "anonymous",
      username: caller?.username ?? null,
      category,
      message: message.trim(),
      deviceInfo: deviceInfo ? JSON.stringify(deviceInfo, null, 2) : "N/A",
    }).catch(console.error);
    res.json({ success: true, id: msg.id });
  });

  app.get("/api/admin/support-messages", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const msgs = await storage.getSupportMessages();
    res.json(msgs);
  });

  app.patch("/api/admin/support-messages/:id/resolve", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    await storage.resolveSupportMessage(Number(req.params.id));
    res.json({ success: true });
  });

  // ── UGC Reports (Apple App Review Guideline 1.2) ────────────────────────
  app.post("/api/reports", async (req, res) => {
    try {
      const body = z.object({
        kind: z.enum(["location", "event"]),
        targetId: z.number().int().positive(),
        targetName: z.string().max(200).optional(),
        reason: z.string().min(3).max(2000),
      }).parse(req.body);
      const caller = extractUser(req);
      const row = await storage.createReport({
        kind: body.kind,
        targetId: body.targetId,
        targetName: body.targetName ?? null,
        reporterEmail: caller?.email ?? null,
        reporterUsername: caller?.username ?? null,
        reason: body.reason.trim(),
      });
      res.json({ success: true, id: row.id });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid request" });
      console.error("[reports] create failed:", err);
      res.status(500).json({ message: "Could not submit report" });
    }
  });

  app.get("/api/admin/reports", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const status = (req.query.status as string | undefined);
    const valid = status === "open" || status === "resolved" || status === "removed";
    const rows = await storage.getReports(valid ? (status as "open" | "resolved" | "removed") : undefined);
    res.json(rows);
  });

  app.patch("/api/admin/reports/:id", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { status } = z.object({ status: z.enum(["open", "resolved", "removed"]) }).parse(req.body);
      await storage.setReportStatus(id, status);
      res.json({ success: true });
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid status" });
      res.status(500).json({ message: "Could not update report" });
    }
  });

  app.post("/api/admin/support-messages/:id/reply", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const { replyText } = z.object({ replyText: z.string().min(1).max(4000) }).parse(req.body);
    const msg = await storage.getSupportMessageById(id);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (!msg.email) return res.status(400).json({ message: "No email address on this message — cannot send reply" });
    await sendAdminReplyEmail({
      to: msg.email,
      username: msg.username,
      originalCategory: msg.category,
      originalMessage: msg.message,
      replyText,
    });
    await storage.resolveSupportMessage(id);
    res.json({ success: true });
  });

  // ── Admin: manage pro users ─────────────────────────────────────────────
  app.get("/api/admin/pro-users", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const users = await storage.getAllProUsers();
    res.json(users);
  });

  app.get("/api/admin/free-users", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const users = await storage.getFreeUsers();
    res.json(users);
  });

  // Admin: server-side first-touch / activity ground truth
  // Reports unique devices that have actually hit our API, independent of GA.
  app.get("/api/admin/visits/stats", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const stats = await storage.getClientVisitStats();
    res.json(stats);
  });

  // Per-key (clientId or IP) rolling-window rate limiter for the share endpoint.
  // Keeps cardinality bounded by pruning idle keys aggressively.
  const SHARE_RATE_WINDOW_MS = 60_000;
  const SHARE_RATE_MAX = 20; // 20 share-events / minute / key
  const shareRateBuckets = new Map<string, number[]>();
  const shareRateLimited = (key: string): boolean => {
    const now = Date.now();
    const arr = shareRateBuckets.get(key) ?? [];
    const fresh = arr.filter((t) => now - t < SHARE_RATE_WINDOW_MS);
    if (fresh.length >= SHARE_RATE_MAX) {
      shareRateBuckets.set(key, fresh);
      return true;
    }
    fresh.push(now);
    shareRateBuckets.set(key, fresh);
    if (shareRateBuckets.size > 5000) {
      // prune ~half of stale entries when map gets big
      for (const [k, ts] of shareRateBuckets) {
        if (!ts.length || now - ts[ts.length - 1] > SHARE_RATE_WINDOW_MS) shareRateBuckets.delete(k);
      }
    }
    return false;
  };

  // Public-ish: log a share event. No auth required (anonymous shares count too),
  // but if Bearer is present we attach userId. Body must specify { kind, targetId?, channel? }.
  app.post("/api/share-events", async (req, res) => {
    try {
      const clientId = (req.headers["x-client-id"] as string | undefined) || undefined;
      const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "unknown";
      const rlKey = (clientId && clientId.length >= 8 ? `c:${clientId}` : `i:${ip}`);
      if (shareRateLimited(rlKey)) return res.status(429).json({ ok: false, message: "Too many share events" });
    } catch { /* never let rate-limit logic crash the endpoint */ }

    try {
      const parsed = z.object({
        kind: z.enum(["plunge", "profile", "badge_profile", "event"]),
        targetId: z.string().max(200).optional(),
        channel: z.enum(["native", "webshare", "clipboard", "file", "unknown"]).optional(),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const caller = extractUser(req);
      const clientId = (req.headers["x-client-id"] as string | undefined) || undefined;
      await storage.recordShareEvent({
        userId: caller?.userId ?? undefined,
        clientId: clientId && clientId.length >= 8 && clientId.length <= 128 ? clientId : undefined,
        kind: parsed.data.kind,
        targetId: parsed.data.targetId,
        channel: parsed.data.channel,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("[share-events] failed:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/admin/user-activity", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const report = await storage.getUserActivityReport();
    res.json(report);
  });

  app.get("/api/admin/visits/recent", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) ?? "100", 10) || 100));
    const visits = await storage.getRecentClientVisits(limit);
    res.json(visits);
  });

  // Admin: clear another user's avatar (set back to default trophy)
  // Accepts either a numeric user id or a username/displayName as :key
  app.post("/api/admin/users/:key/clear-avatar", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const key = req.params.key;
    if (!key) return res.status(400).json({ message: "User key required" });

    let profileKey: string | null = null;
    const asId = parseInt(key, 10);
    if (!isNaN(asId) && String(asId) === key) {
      const u = await storage.getUserById(asId);
      if (!u) return res.status(404).json({ message: "User not found" });
      profileKey = u.username || u.displayName || null;
    } else {
      profileKey = key;
    }
    if (!profileKey) return res.status(400).json({ message: "User has no username or display name" });

    await storage.updateBadgeProfileMeta(profileKey, { avatarUrl: null });
    console.log(`[admin] cleared avatar for "${profileKey}" (by ${caller?.email})`);
    res.json({ success: true, profileKey });
  });

  // Admin: disable / enable a user account
  app.patch("/api/admin/users/:id", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user id" });
    const { disabled } = req.body as { disabled?: boolean };
    if (typeof disabled !== "boolean") return res.status(400).json({ message: "disabled (boolean) required" });
    await storage.setUserDisabled(id, disabled);
    res.json({ success: true });
  });

  // Admin: delete a user account entirely
  app.delete("/api/admin/users/:id", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user id" });
    // Also remove any pro record so Stripe data stays in sync
    const target = await storage.getUserById(id);
    if (target) await storage.deleteProUser(target.email).catch(() => {});
    await storage.deleteUser(id);
    res.json({ success: true });
  });

  // Admin: update a user's display name / email
  app.put("/api/admin/users/:id", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user id" });
    const { displayName } = req.body as { displayName?: string };
    const updated = await storage.updateUserProfile(id, { displayName: displayName ?? undefined });
    res.json(updated);
  });

  // Admin: look up a customer by email — returns DB record + live Stripe subscription info
  app.get("/api/admin/lookup", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
      const email = (req.query.email as string | undefined)?.toLowerCase().trim();
      if (!email || !email.includes("@")) return res.status(400).json({ message: "Valid email required" });

      const dbRecord = await storage.getProUser(email);

      // Fetch all Stripe customers + subscriptions for this email
      const customers = await stripe.customers.list({ email, limit: 5 });
      const stripeData: any[] = [];
      for (const customer of customers.data) {
        const [activeSubs, trialingSubs, cancelledSubs] = await Promise.all([
          stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 5 }),
          stripe.subscriptions.list({ customer: customer.id, status: "trialing", limit: 5 }),
          stripe.subscriptions.list({ customer: customer.id, status: "canceled", limit: 3 }),
        ]);
        const allSubs = [...activeSubs.data, ...trialingSubs.data, ...cancelledSubs.data];
        for (const sub of allSubs) {
          const interval = sub.items?.data?.[0]?.plan?.interval;
          stripeData.push({
            subscriptionId: sub.id,
            status: sub.status,
            planType: interval === "month" ? "monthly" : "annual",
            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
            customerId: customer.id,
            customerEmail: customer.email,
          });
        }
      }

      res.json({ email, dbRecord: dbRecord ?? null, stripeSubscriptions: stripeData });
    } catch (err: any) {
      console.error("[admin] Lookup error:", err);
      res.status(500).json({ message: err?.message ?? "Lookup failed" });
    }
  });

  // Admin: verify by Stripe payment intent ID and grant Pro (lifetime)
  app.post("/api/admin/verify-payment", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
      const { paymentIntentId } = z.object({ paymentIntentId: z.string().startsWith("pi_") }).parse(req.body);

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["customer"] });
      if (pi.status !== "succeeded") {
        return res.status(402).json({ message: `Payment intent is ${pi.status} — not succeeded` });
      }

      // Try to get email: prefer customer email, fall back to receipt_email
      let email: string | null = null;
      if (pi.customer && typeof pi.customer === "object" && (pi.customer as Stripe.Customer).email) {
        email = (pi.customer as Stripe.Customer).email;
      } else if (pi.receipt_email) {
        email = pi.receipt_email;
      }
      if (!email) return res.status(400).json({ message: "No email found on payment intent or its customer" });

      const proUser = await storage.createProUser(email.toLowerCase(), paymentIntentId, { planType: "lifetime" });
      clearProStatusCache(email.toLowerCase());
      console.log(`[admin] Verified payment intent ${paymentIntentId} → granted lifetime pro to ${email}`);
      res.json({ email: proUser.email, isPro: true, planType: proUser.planType, foundingPlunger: proUser.foundingPlunger });
    } catch (err: any) {
      console.error("[admin] Verify payment intent error:", err);
      res.status(500).json({ message: err?.message ?? "Failed to verify payment intent" });
    }
  });

  // Admin: verify by Stripe subscription ID and grant Pro
  app.post("/api/admin/verify-subscription", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
      const { subscriptionId } = z.object({ subscriptionId: z.string().startsWith("sub_") }).parse(req.body);

      const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["customer"] });
      if (sub.status !== "active" && sub.status !== "trialing") {
        return res.status(402).json({ message: `Subscription is ${sub.status} — not active` });
      }
      const customer = sub.customer as Stripe.Customer;
      const email = customer.email;
      if (!email) return res.status(400).json({ message: "No email on Stripe customer" });

      const interval = sub.items?.data?.[0]?.plan?.interval;
      const planType = interval === "month" ? "monthly" : "annual";
      const expiresAt = new Date(sub.current_period_end * 1000);

      const proUser = await storage.createProUser(email.toLowerCase(), subscriptionId, {
        planType,
        stripeSubscriptionId: subscriptionId,
        expiresAt,
      });
      clearProStatusCache(email.toLowerCase());
      console.log(`[admin] Verified sub ${subscriptionId} → granted ${planType} pro to ${email}`);
      res.json({ email: proUser.email, isPro: true, planType: proUser.planType, foundingPlunger: proUser.foundingPlunger });
    } catch (err: any) {
      console.error("[admin] Verify subscription error:", err);
      res.status(500).json({ message: err?.message ?? "Failed to verify subscription" });
    }
  });

  // Admin: manually grant pro to any email (no Stripe required)
  app.post("/api/admin/pro-users", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
      const { email, planType } = z.object({
        email: z.string().email(),
        planType: z.enum(["monthly", "annual", "lifetime", "promo"]).default("monthly"),
      }).parse(req.body);
      // Match expiry to the plan: monthly = 30d, annual = 1y, promo = 30d, lifetime = none
      const DAY_MS = 24 * 60 * 60 * 1000;
      const expiryDays = planType === "monthly" ? 30
        : planType === "annual" ? 365
        : planType === "promo" ? 30
        : 0;
      const expiresAt = planType === "lifetime" ? undefined : new Date(Date.now() + expiryDays * DAY_MS);
      const proUser = await storage.createProUser(email.toLowerCase(), `admin-grant-${Date.now()}`, { planType, expiresAt });
      clearProStatusCache(email.toLowerCase());
      console.log(`[admin] Manually granted ${planType} pro to ${email} by ${caller?.email}`);
      res.json(proUser);
    } catch (err: any) {
      console.error("[admin] Grant pro error:", err);
      res.status(500).json({ message: err?.message ?? "Failed to grant pro" });
    }
  });

  app.patch("/api/admin/pro-users/:email", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const updated = await storage.setProUserActive(email, active);
    if (!updated) return res.status(404).json({ message: "User not found" });
    clearProStatusCache(email);
    res.json(updated);
  });

  app.delete("/api/admin/pro-users/:email", async (req, res) => {
    try {
      const caller = extractUser(req);
      console.log(`[admin] DELETE pro-user requested by: ${caller?.email ?? "unauthenticated"}`);
      if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
      const email = decodeURIComponent(req.params.email).toLowerCase();
      console.log(`[admin] Deleting pro-user: ${email}`);

      // Cancel any active Stripe subscriptions for this email so the pro-status
      // check can't find them and silently re-grant access after the DB record is gone.
      try {
        const customers = await stripe.customers.list({ email, limit: 5 });
        for (const customer of customers.data) {
          const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 5 });
          for (const sub of subs.data) {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[admin] Cancelled Stripe sub ${sub.id} for ${email}`);
          }
        }
      } catch (stripeErr) {
        console.error("[admin] Stripe cleanup error (continuing):", stripeErr);
      }

      const deleted = await storage.deleteProUser(email);
      clearProStatusCache(email);
      if (!deleted) {
        // Record may not have existed but Stripe was cleaned up — still a success
        console.log(`[admin] No DB record found for ${email} (Stripe still cleaned up)`);
      } else {
        console.log(`[admin] Deleted pro-user DB record: ${email}`);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[admin] Delete pro-user error:", err);
      res.status(500).json({ message: "Server error during delete" });
    }
  });

  // ── Admin: hide / unhide locations ─────────────────────────────────────
  app.patch("/api/admin/locations/:id/visibility", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) {
      return res.status(403).json({ message: "Admin only" });
    }
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const { hidden } = z.object({ hidden: z.boolean() }).parse(req.body);
    const updated = await storage.setLocationHidden(id, hidden);
    if (!updated) return res.status(404).json({ message: "Location not found" });
    res.json(updated);
  });

  // ── Admin events ────────────────────────────────────────────────────────
  app.get("/api/admin/events", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const events = await storage.getEvents();
    const withCounts = await Promise.all(events.map(async (e) => ({
      ...e,
      participantCount: await storage.getEventParticipantCount(e.id),
    })));
    res.json(withCounts);
  });

  app.delete("/api/admin/events/:id", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const evt = await storage.getEventById(id);
    if (!evt) return res.status(404).json({ message: "Event not found" });
    await storage.deleteEvent(id);
    res.json({ ok: true });
  });

  // ── Stripe ─────────────────────────────────────────────────────────────

  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { successUrl, cancelUrl, plan, email } = z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
        plan: z.enum(["lifetime", "annual", "monthly"]).default("lifetime"),
        email: z.string().email().optional(),
      }).parse(req.body);

      // Guard: if upgrading to lifetime and email provided, check Stripe for an
      // existing paid session to prevent double-charging on retry attempts
      if (plan === "lifetime" && email) {
        try {
          const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 5 });
          for (const customer of customers.data) {
            const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 10 });
            for (const s of sessions.data) {
              if (s.payment_status === "paid" && s.mode === "payment") {
                const proUser = await storage.createProUser(email.toLowerCase(), s.id, { planType: "lifetime" });
                return res.json({ activated: true, email: proUser.email, planType: proUser.planType, foundingPlunger: proUser.foundingPlunger, message: "Lifetime access activated! If Pro features aren't showing, use Restore Purchase." });
              }
            }
          }
        } catch (guardErr) {
          console.error("Duplicate charge guard failed:", guardErr);
        }
      }

      const isSubscription = plan === "annual" || plan === "monthly";
      const subscriptionPriceId = plan === "monthly" ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
      let lifetimePriceId = PRICE_ID;
      if (!isSubscription) {
        const count = await storage.getProUserCount();
        const fpRemaining = Math.max(0, 1000 - count);
        const phase = getLifetimePhase(fpRemaining);
        lifetimePriceId = LIFETIME_PRICE_IDS[phase];
      }
      // Bust the customer ID cache so the first pro-status check after returning from
      // Stripe always re-fetches. Without this, a stale empty-array cache would prevent
      // the subscription from being detected for up to 10 minutes.
      if (email) clearProStatusCache(email.toLowerCase());

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: isSubscription ? subscriptionPriceId : lifetimePriceId, quantity: 1 }],
        mode: isSubscription ? "subscription" : "payment",
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        // Pass email so Stripe reuses the same customer record instead of creating duplicates
        ...(email ? { customer_email: email } : {}),
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("Stripe checkout error:", err?.message ?? err);
      res.status(500).json({
        message: "Failed to create checkout session",
        detail: TEST_MODE ? (err?.message ?? String(err)) : undefined,
      });
    }
  });

  app.get("/api/stripe/verify", async (req, res) => {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ message: "Missing session_id" });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["subscription"],
      });
      if (session.payment_status !== "paid") {
        return res.status(402).json({ message: "Payment not completed" });
      }
      const email = session.customer_details?.email;
      if (!email) {
        return res.status(400).json({ message: "No email on session" });
      }

      const isSubscription = session.mode === "subscription";
      let subscriptionId: string | undefined;
      let expiresAt: Date | undefined;
      let planType = "lifetime";

      if (isSubscription && session.subscription) {
        const sub = session.subscription as Stripe.Subscription;
        subscriptionId = sub.id;
        expiresAt = new Date(sub.current_period_end * 1000);
        const interval = sub.items?.data?.[0]?.plan?.interval;
        planType = interval === "month" ? "monthly" : "annual";
      }

      // If this is a lifetime purchase, cancel any active monthly/annual subscriptions
      // so the customer isn't double-charged going forward.
      if (!isSubscription && session.customer) {
        try {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          const activeSubs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 5 });
          for (const sub of activeSubs.data) {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[stripe] Cancelled subscription ${sub.id} for ${email} after lifetime upgrade`);
          }
        } catch (subErr) {
          console.error("Failed to cancel subscriptions after lifetime upgrade:", subErr);
        }
      }

      const proUser = await storage.createProUser(email, session_id, {
        planType,
        stripeSubscriptionId: subscriptionId,
        expiresAt,
      });
      clearProStatusCache(email);
      res.json({ email: proUser.email, isPro: true, foundingPlunger: proUser.foundingPlunger, planType: proUser.planType });
    } catch (err) {
      console.error("Stripe verify error:", err);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });

  // Business listing checkout
  // Web-side Stripe tier table — must mirror VERIFIED_BUSINESS_TIERS in
  // client/src/lib/iap.ts so prices stay in sync between iOS IAP and web Stripe.
  // 10+ locations is enterprise / Contact Sales only — not sold via self-serve.
  const STRIPE_BUSINESS_TIERS: Record<number, { unitAmount: number; capacity: number; description: string }> = {
    1:  { unitAmount: 2999,  capacity: 1,  description: "1 location" },
    3:  { unitAmount: 7999,  capacity: 3,  description: "Up to 3 locations" },
    10: { unitAmount: 12999, capacity: 10, description: "Up to 10 locations" },
  };

  app.post("/api/stripe/business-checkout", async (req, res) => {
    try {
      const { successUrl, cancelUrl, locationId, email, tier } = z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
        locationId: z.number().int().positive(),
        email: z.string().email(),
        tier: z.union([z.literal(1), z.literal(3), z.literal(10)]).default(1),
      }).parse(req.body);

      const tierConfig = STRIPE_BUSINESS_TIERS[tier];
      if (!tierConfig) return res.status(400).json({ message: "Invalid tier" });

      // Verify the requester owns this listing by matching their contact email
      const loc = await storage.getUserLocationById(locationId);
      if (!loc) return res.status(404).json({ message: "Listing not found" });
      if (!loc.contactEmail || loc.contactEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(403).json({ message: "Email does not match the contact email on this listing. Only the business owner can verify." });
      }

      // 30-day free trial is offered ONLY on the entry tier (1 location).
      // Multi-location tiers (3 / 10) bill immediately — no trial.
      const hasTrial = tier === 1;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `ColdStreak Verified Business Listing — ${tierConfig.description}`,
              description: `✓ Verified badge on ColdStreak community boards — covers ${tierConfig.description.toLowerCase()}${hasTrial ? " (first month free)" : ""}`,
            },
            unit_amount: tierConfig.unitAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        mode: "subscription",
        ...(hasTrial ? { subscription_data: { trial_period_days: 30 } } : {}),
        metadata: { type: "business_listing", locationId: locationId.toString(), tier: String(tier), tierCapacity: String(tierConfig.capacity) },
        success_url: `${successUrl}?business_session_id={CHECKOUT_SESSION_ID}&business_location_id=${locationId}`,
        cancel_url: cancelUrl,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe business checkout error:", err);
      res.status(500).json({ message: "Failed to create business checkout session" });
    }
  });

  // Business listing verify
  app.get("/api/stripe/business-verify", async (req, res) => {
    const { session_id, location_id } = req.query;
    if (!session_id || typeof session_id !== "string" || !location_id) {
      return res.status(400).json({ message: "Missing params" });
    }
    const locationId = parseInt(location_id as string);
    if (isNaN(locationId)) return res.status(400).json({ message: "Invalid location_id" });

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return res.status(402).json({ message: "Payment not completed" });
      }
      const email = session.customer_details?.email;
      if (!email) return res.status(400).json({ message: "No email on session" });

      const sub = session.subscription as Stripe.Subscription | null;
      const subscriptionId = sub?.id;
      const expiresAt = sub ? new Date(sub.current_period_end * 1000) : undefined;

      await storage.createBusinessListing({ locationId, email, stripeSessionId: session_id, stripeSubscriptionId: subscriptionId, expiresAt });
      await storage.markLocationBusinessVerified(locationId, true);

      res.json({ verified: true, locationId });
    } catch (err) {
      console.error("Stripe business verify error:", err);
      res.status(500).json({ message: "Failed to verify business session" });
    }
  });

  // Stripe webhook — handles subscription lifecycle
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      const webhookSecret = TEST_MODE
        ? process.env.STRIPE_TEST_WEBHOOK_SECRET!
        : process.env.STRIPE_WEBHOOK_SECRET!;
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
    } catch (err) {
      return res.status(400).json({ message: "Webhook signature invalid" });
    }

    // Initial purchase — grant Pro as soon as checkout completes (server-to-server, no redirect needed)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      if (email && session.payment_status === "paid") {
        try {
          const isSubscription = session.mode === "subscription";
          let subscriptionId: string | undefined;
          let expiresAt: Date | undefined;
          let planType = "lifetime";
          if (isSubscription && session.subscription) {
            const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
            subscriptionId = subId;
            const sub = await stripe.subscriptions.retrieve(subId);
            expiresAt = new Date(sub.current_period_end * 1000);
            const interval = sub.items?.data?.[0]?.plan?.interval;
            planType = interval === "month" ? "monthly" : "annual";
          }
          const sessionId = session.id;
          await storage.createProUser(email.toLowerCase(), sessionId, { planType, stripeSubscriptionId: subscriptionId, expiresAt });
          clearProStatusCache(email.toLowerCase());
          console.log(`[webhook] checkout.session.completed → granted ${planType} pro to ${email}`);
          // On lifetime payment, cancel any lingering monthly/annual subscriptions
          if (planType === "lifetime" && session.customer) {
            const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
            try {
              const activeSubs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 10 });
              for (const sub of activeSubs.data) {
                await stripe.subscriptions.cancel(sub.id);
                console.log(`[webhook] Cancelled sub ${sub.id} for ${email} after lifetime grant`);
              }
            } catch (cancelErr) {
              console.error("[webhook] Failed to cancel subscriptions after lifetime grant:", cancelErr);
            }
          }
        } catch (err) {
          console.error("[webhook] Failed to grant pro from checkout.session.completed:", err);
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId && invoice.lines?.data[0]?.period?.end) {
        const expiresAt = new Date(invoice.lines.data[0].period.end * 1000);
        // Try both Pro and Business listing — only the matching one will have a record
        await Promise.allSettled([
          storage.updateProUserSubscription(subscriptionId, expiresAt),
          storage.updateBusinessListingSubscription(subscriptionId, expiresAt),
        ]);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await Promise.allSettled([
        storage.deactivateProUserBySubscriptionId(sub.id),
        storage.deactivateBusinessListingBySubscriptionId(sub.id),
      ]);
    }

    res.json({ received: true });
  });

  // ── Stripe Customer Portal (manage/cancel subscription) ─────────────────
  app.post("/api/stripe/portal", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!caller) return res.status(401).json({ message: "Not logged in" });

      const user = await storage.getProUser(caller.email);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const { returnUrl } = z.object({ returnUrl: z.string().url() }).parse(req.body);
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Portal error:", err);
      res.status(500).json({ message: "Could not open subscription portal" });
    }
  });

  app.get("/api/pro-status/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const noCache = req.query.noCache === "1";
    const user = await storage.getProUser(email);
    const isExpired = user?.expiresAt ? new Date(user.expiresAt) < new Date() : false;
    const isActiveNonLifetime = user && user.active && !isExpired && user.planType !== "lifetime";

    // If already lifetime in DB, return immediately — lifetime never expires, no Stripe check needed
    if (user && user.planType === "lifetime" && user.active) {
      const result = { email: user.email, isPro: true, foundingPlunger: user.foundingPlunger, planType: "lifetime" };
      setProStatusCache(email, result);
      return res.json(result);
    }

    // Admin-granted or promo Pro: no Stripe subscription to verify against, so trust
    // the DB record. These rows are created by /api/admin/pro-users (session prefix
    // "admin-grant-") or by promo redemption and never have a stripeSubscriptionId.
    // Without this branch they would fall through to the Stripe-subscription check,
    // find nothing, and be silently deactivated below.
    if (user && user.active && !isExpired && !user.stripeSubscriptionId) {
      const result = { email: user.email, isPro: true, foundingPlunger: user.foundingPlunger, planType: user.planType };
      setProStatusCache(email, result);
      return res.json(result);
    }

    // Resolve Stripe customer IDs — cached to avoid the slow customers.list() on every call
    let customerIds = getCachedCustomerIds(email);
    if (!customerIds) {
      try {
        const customers = await stripe.customers.list({ email, limit: 10 });
        customerIds = customers.data.map((c) => c.id);
        setCachedCustomerIds(email, customerIds);
      } catch (err) {
        console.error("Stripe customer lookup failed:", err);
        customerIds = [];
      }
    }

    // ALWAYS check Stripe for one-time lifetime payments (never cached — detects upgrades immediately)
    for (const customerId of customerIds) {
      try {
        const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 10 });
        for (const session of sessions.data) {
          if (session.payment_status === "paid" && session.mode === "payment") {
            // Respect manual deactivation: if the DB record exists and is inactive,
            // skip ALL paid sessions so testing resets work even when there are
            // multiple paid test sessions in Stripe for the same account.
            if (user && !user.active) continue;
            const proUser = await storage.createProUser(email, session.id, { planType: "lifetime" });
            const result = { email: proUser.email, isPro: true, foundingPlunger: proUser.foundingPlunger, planType: proUser.planType };
            clearProStatusCache(email); // clear sub cache so next load reflects lifetime from DB
            // Cancel any lingering monthly/annual subscriptions so the user isn't double-charged
            try {
              const activeSubs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 5 });
              for (const sub of activeSubs.data) {
                await stripe.subscriptions.cancel(sub.id);
                console.log(`[stripe] Cancelled subscription ${sub.id} for ${email} after lifetime detected`);
              }
            } catch (cancelErr) {
              console.error("Failed to cancel subscriptions after lifetime auto-detect:", cancelErr);
            }
            return res.json(result);
          }
        }
      } catch (err) {
        console.error("Stripe session check failed:", err);
      }
    }

    // If the account was manually deactivated (e.g. for testing), skip ALL Stripe
    // subscription checks — not just the one-time sessions above.  This prevents
    // any active test subscription from silently re-granting pro access.
    if (user && !user.active) {
      return res.json({ email, isPro: false, foundingPlunger: false });
    }

    // Always verify subscription status with Stripe (cached for 5 min to keep it fast).
    // This ensures cancellations are detected on the next page load without requiring sign-out.
    // Skip cache when ?noCache=1 (used by restore-purchase flow).
    if (!noCache) {
      const cached = getProStatusCache(email);
      if (cached) return res.json(cached);
    }

    let foundActiveSub = false;
    for (const customerId of customerIds) {
      try {
        // Accept both active and trialing subscriptions (trialing = paid setup, trial not yet expired)
        const [activeSubs, trialingSubs] = await Promise.all([
          stripe.subscriptions.list({ customer: customerId, status: "active", limit: 3 }),
          stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 3 }),
        ]);
        const sub = activeSubs.data[0] ?? trialingSubs.data[0];
        if (sub) {
          // Secondary lifetime guard: if the DB already has lifetime, a monthly sub must not overwrite it.
          // (The application-level createProUser guard handles this too, but skip the call entirely for clarity.)
          if (user && user.planType === "lifetime" && user.active) {
            const result = { email: user.email, isPro: true, foundingPlunger: user.foundingPlunger, planType: "lifetime" };
            setProStatusCache(email, result);
            return res.json(result);
          }
          const interval = sub.items?.data?.[0]?.plan?.interval;
          const planType = interval === "month" ? "monthly" : "annual";
          const expiresAt = new Date(sub.current_period_end * 1000);
          const proUser = await storage.createProUser(email, sub.id, { planType, stripeSubscriptionId: sub.id, expiresAt });
          const result = { email: proUser.email, isPro: true, foundingPlunger: proUser.foundingPlunger, planType: proUser.planType };
          setCachedSubscription(email, result);
          foundActiveSub = true;
          return res.json(result);
        }
      } catch (err) {
        console.error("Stripe subscription check failed:", err);
        // On Stripe error, fall back to DB value so a temporary outage doesn't yank access
        if (isActiveNonLifetime) {
          const result = { email: user!.email, isPro: true, foundingPlunger: user!.foundingPlunger, planType: user!.planType };
          return res.json(result);
        }
      }
    }

    // No active subscription found in Stripe — if DB still shows active, deactivate it.
    // Restrict to rows that actually have a Stripe subscription ID so we never tear
    // down admin-granted or promo-redeemed Pro accounts (which have no stripeSubscriptionId
    // and are handled above).
    if (!foundActiveSub && isActiveNonLifetime && user?.stripeSubscriptionId) {
      await storage.setProUserActive(email, false);
    }

    res.json({ email, isPro: false, foundingPlunger: false });
  });

  // ───────────────────────────────────────────────────────────────────────
  // RevenueCat (iOS in-app purchases)
  // ───────────────────────────────────────────────────────────────────────
  // Must match the entitlement identifiers configured in the RevenueCat dashboard.
  const PRO_ENTITLEMENT = "pro";
  const VERIFIED_BUSINESS_ENTITLEMENT = "verified_business";

  // Map an Apple/RevenueCat product identifier (or RC entitlement period) to
  // our internal planType so the rest of the app can stay agnostic.
  function planFromProductId(productId: string | null | undefined, periodType?: string | null): "monthly" | "annual" | "lifetime" {
    const pid = (productId ?? "").toLowerCase();
    if (pid.includes("lifetime") || periodType === "LIFETIME") return "lifetime";
    if (pid.includes("annual") || pid.includes("yearly")) return "annual";
    return "monthly";
  }

  // Verified Business Listing tiers — must match client/src/lib/iap.ts.
  // Each productId is its own auto-renewing subscription on Apple because IAP
  // does not support quantity on subscriptions.
  const VERIFIED_BUSINESS_TIER_BY_PRODUCT: Record<string, number> = {
    "coldstreak_verified_business_1": 1,
    "coldstreak_verified_business_3": 3,
    "coldstreak_verified_business_10": 10,
  };
  function tierCapacityFromProductId(productId: string | null | undefined): number | null {
    if (!productId) return null;
    const direct = VERIFIED_BUSINESS_TIER_BY_PRODUCT[productId.toLowerCase()];
    if (direct) return direct;
    const m = productId.toLowerCase().match(/business[_-](\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n === 1 || n === 3 || n === 10) return n;
    }
    return null;
  }

  // Client-initiated sync. Authenticated. Client tells us "I just bought
  // something on iOS" but we DO NOT trust the client's claim of which plan
  // or whether the entitlement is active — we ask RevenueCat directly via
  // their REST API. This makes the endpoint safe even though the webhook
  // is the long-term source of truth.
  async function fetchRCSubscriberEntitlement(appUserId: string): Promise<
    | { isPro: false }
    | { isPro: true; productIdentifier: string | null; expiresAt: Date | null; periodType: string | null }
  > {
    const apiKey = process.env.REVENUECAT_REST_API_KEY;
    if (!apiKey) {
      throw new Error("REVENUECAT_REST_API_KEY not configured on server");
    }
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Platform": "ios",
      },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`RevenueCat ${r.status}: ${text.slice(0, 200)}`);
    }
    const data: any = await r.json();
    const ent = data?.subscriber?.entitlements?.[PRO_ENTITLEMENT] ?? null;
    if (!ent) return { isPro: false };
    const expiresAt = ent.expires_date ? new Date(ent.expires_date) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) return { isPro: false };
    return {
      isPro: true,
      productIdentifier: ent.product_identifier ?? null,
      expiresAt,
      periodType: ent.period_type ?? null,
    };
  }

  // Verify a Verified Business Listing IAP purchase by asking RevenueCat
  // directly. Mirrors fetchRCSubscriberEntitlement but for the verified
  // business entitlement.
  async function fetchRCVerifiedBusinessEntitlement(appUserId: string): Promise<
    | { active: false }
    | { active: true; productIdentifier: string | null; expiresAt: Date | null; periodType: string | null; tierCapacity: number | null }
  > {
    const apiKey = process.env.REVENUECAT_REST_API_KEY;
    if (!apiKey) throw new Error("REVENUECAT_REST_API_KEY not configured on server");
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "X-Platform": "ios" },
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`RevenueCat ${r.status}: ${text.slice(0, 200)}`);
    }
    const data: any = await r.json();
    const ent = data?.subscriber?.entitlements?.[VERIFIED_BUSINESS_ENTITLEMENT] ?? null;
    if (!ent) return { active: false };
    const expiresAt = ent.expires_date ? new Date(ent.expires_date) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) return { active: false };
    return {
      active: true,
      productIdentifier: ent.product_identifier ?? null,
      expiresAt,
      periodType: ent.period_type ?? null,
      tierCapacity: tierCapacityFromProductId(ent.product_identifier ?? null),
    };
  }

  app.post("/api/revenuecat/sync", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!caller?.email) return res.status(401).json({ ok: false, error: "Sign in required" });

      const body = z.object({
        email: z.string().email(),
        // Client may send appUserId for logging/debugging only — server
        // ALWAYS uses the authenticated caller's email as the RC subscriber
        // id, otherwise an attacker could pass another user's app_user_id
        // and inherit their entitlement.
        appUserId: z.string().optional().nullable(),
      }).parse(req.body);

      const email = body.email.toLowerCase();
      if (email !== caller.email.toLowerCase()) {
        return res.status(403).json({ ok: false, error: "Email mismatch" });
      }

      // Trust ONLY the verified caller email — never the client-supplied
      // appUserId. Our IAP wrapper always logs in to RC with the caller's
      // email, so this is the only safe identifier.
      const appUserId = email;

      const verified = await fetchRCSubscriberEntitlement(appUserId);

      if (!verified.isPro) {
        const existing = await storage.getProUser(email);
        if (existing && existing.active && existing.stripeSessionId.startsWith("iap-")) {
          await storage.setProUserActive(email, false);
        }
        clearProStatusCache(email);
        return res.json({ ok: true, isPro: false });
      }

      const planType = planFromProductId(verified.productIdentifier, verified.periodType);
      const sessionId = `iap-${verified.productIdentifier ?? "unknown"}-${appUserId}`;
      const proUser = await storage.createProUser(email, sessionId, {
        planType,
        expiresAt: planType === "lifetime" ? undefined : (verified.expiresAt ?? undefined),
      });
      clearProStatusCache(email);
      console.log(`[revenuecat] Verified+synced ${planType} for ${email} (product=${verified.productIdentifier})`);
      res.json({
        ok: true,
        isPro: true,
        email: proUser.email,
        planType: proUser.planType,
        foundingPlunger: proUser.foundingPlunger,
      });
    } catch (err: any) {
      console.error("[revenuecat] sync failed:", err);
      res.status(500).json({ ok: false, error: err?.message ?? "Sync failed" });
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Verified Business Listing — iOS IAP path
  // ───────────────────────────────────────────────────────────────────────
  // Bind a community location to the caller's verified_business IAP sub.
  // Server verifies the IAP entitlement against RevenueCat, enforces the
  // tier capacity, then writes a businessListings row with source="iap".
  app.post("/api/iap/verify-business", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!caller?.email) return res.status(401).json({ ok: false, error: "Sign in required" });

      const body = z.object({
        locationId: z.number().int().positive(),
        email: z.string().email(),
        // Accepted for logging only — server always derives appUserId from
        // the authenticated caller. See note on /api/revenuecat/sync.
        appUserId: z.string().optional().nullable(),
      }).parse(req.body);

      const email = body.email.toLowerCase().trim();
      if (email !== caller.email.toLowerCase()) {
        return res.status(403).json({ ok: false, error: "Email mismatch" });
      }

      // Caller must own the listing's contact email
      const loc = await storage.getUserLocationById(body.locationId);
      if (!loc) return res.status(404).json({ ok: false, error: "Listing not found" });
      if (!loc.contactEmail || loc.contactEmail.toLowerCase().trim() !== email) {
        return res.status(403).json({ ok: false, error: "Email does not match the contact email on this listing." });
      }

      // Verify the IAP entitlement against RevenueCat using ONLY the
      // authenticated caller's email as the subscriber id — ignore any
      // client-supplied appUserId to prevent entitlement spoofing.
      const appUserId = email;
      const ent = await fetchRCVerifiedBusinessEntitlement(appUserId);
      if (!ent.active) {
        return res.status(402).json({ ok: false, error: "No active Verified Business subscription found." });
      }
      if (!ent.tierCapacity) {
        return res.status(400).json({ ok: false, error: "Unrecognized verified-business product. Contact support." });
      }

      // Atomic capacity-checked bind — upserts the sub row, takes a row
      // lock on it, counts active iap listings, then inserts. Concurrent
      // requests for the same email cannot exceed the tier cap.
      const result = await storage.bindIapBusinessListing({
        email,
        locationId: body.locationId,
        appUserId,
        productId: ent.productIdentifier ?? "",
        tierCapacity: ent.tierCapacity,
        expiresAt: ent.expiresAt,
      });

      if (!result.ok) {
        return res.status(409).json({
          ok: false,
          error: `Your tier covers ${result.capacity} location${result.capacity === 1 ? "" : "s"}. Upgrade your subscription or remove an existing verified listing first.`,
          used: result.used,
          capacity: result.capacity,
        });
      }

      res.json({
        ok: true,
        verified: true,
        locationId: body.locationId,
        tierCapacity: result.capacity,
        used: result.used,
      });
    } catch (err: any) {
      console.error("[iap] verify-business failed:", err);
      res.status(500).json({ ok: false, error: err?.message ?? "Verification failed" });
    }
  });

  // Read-only — returns the caller's current Verified Business sub state
  // and how many of their tier slots are in use. Used by the iOS UI to
  // decide whether to show "Subscribe" vs "Add another location".
  app.get("/api/iap/verified-business-status", async (req, res) => {
    try {
      const caller = extractUser(req);
      if (!caller?.email) return res.status(401).json({ ok: false, error: "Sign in required" });
      const email = caller.email.toLowerCase();

      // Source of truth = RevenueCat. Re-verify on every status read so
      // delayed/missed webhooks, expirations, and tier downgrades cannot
      // leave a cancelled or over-provisioned subscription in a state
      // that grants more capacity than the user is paying for.
      const ent = await fetchRCVerifiedBusinessEntitlement(email);

      // Reconcile atomically — handles missing-local-row, expired ent,
      // and tier-downgrade trim in a single transaction with row lock.
      const reconciled = await storage.reconcileVerifiedBusinessFromRC({
        email,
        rcActive: ent.active,
        productId: ent.active ? (ent.productIdentifier ?? null) : null,
        tierCapacity: ent.active ? (ent.tierCapacity ?? null) : null,
        expiresAt: ent.active ? (ent.expiresAt ?? null) : null,
        appUserId: email,
      });

      res.json({
        ok: true,
        active: reconciled.active,
        productId: ent.active ? (ent.productIdentifier ?? null) : null,
        tierCapacity: reconciled.tierCapacity,
        used: reconciled.used,
        expiresAt: ent.active ? (ent.expiresAt ?? null) : null,
      });
    } catch (err: any) {
      console.error("[iap] verified-business-status failed:", err);
      res.status(500).json({ ok: false, error: err?.message ?? "Status check failed" });
    }
  });

  // Server-of-record: RevenueCat sends events here for INITIAL_PURCHASE,
  // RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, etc. Configure the
  // webhook URL in the RevenueCat dashboard and set REVENUECAT_WEBHOOK_AUTH
  // to the bearer token RC sends in the Authorization header.
  app.post("/api/revenuecat/webhook", async (req, res) => {
    try {
      const expectedAuth = process.env.REVENUECAT_WEBHOOK_AUTH;
      if (!expectedAuth) {
        // Fail closed — without a configured shared secret this endpoint
        // could be used to flip arbitrary accounts to Pro.
        console.error("[revenuecat] webhook rejected — REVENUECAT_WEBHOOK_AUTH not set");
        return res.status(503).json({ ok: false, error: "webhook not configured" });
      }
      const provided = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const a = Buffer.from(provided);
      const b = Buffer.from(expectedAuth);
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!ok) {
        console.warn("[revenuecat] webhook rejected — bad auth header");
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }

      const event = req.body?.event ?? req.body;
      if (!event || typeof event !== "object") {
        return res.status(400).json({ ok: false, error: "missing event" });
      }

      const type: string = event.type ?? "UNKNOWN";
      const productId: string | null = event.product_id ?? null;
      const periodType: string | null = event.period_type ?? null;
      const expirationMs: number | null = event.expiration_at_ms ?? null;
      // RC sends user identifiers in `app_user_id` / `original_app_user_id` /
      // `aliases`. Our appUserId IS the email, so prefer that.
      const aliases: string[] = Array.isArray(event.aliases) ? event.aliases : [];
      const candidates = [event.app_user_id, event.original_app_user_id, ...aliases]
        .filter((s): s is string => typeof s === "string");
      const email = candidates
        .map((s) => s.toLowerCase().trim())
        .find((s) => s.includes("@"));

      if (!email) {
        console.warn(`[revenuecat] webhook ${type} ignored — no email-shaped app_user_id (got ${JSON.stringify(candidates)})`);
        // Return 200 so RC doesn't retry forever for a non-email user identifier.
        return res.json({ ok: true, ignored: true });
      }

      const planType = planFromProductId(productId, periodType);
      const expiresAt = expirationMs ? new Date(expirationMs) : undefined;
      const sessionId = `iap-${productId ?? "unknown"}-${event.app_user_id ?? email}`;

      // Dispatch by entitlement_ids — same event type can affect either
      // the "pro" entitlement (Pro upgrade) or the "verified_business"
      // entitlement (Verified Business Listing). RC always includes the
      // affected entitlements in `entitlement_ids` (and legacy single
      // `entitlement_id`).
      const entitlementIds: string[] = Array.isArray(event.entitlement_ids)
        ? event.entitlement_ids
        : (typeof event.entitlement_id === "string" ? [event.entitlement_id] : []);
      // If RC didn't send entitlement_ids (older payloads), fall back to
      // inferring from the product id so we never silently miss an event.
      const inferredVerifiedBusiness = tierCapacityFromProductId(productId) !== null;
      const affectsPro = entitlementIds.includes(PRO_ENTITLEMENT) || (entitlementIds.length === 0 && !inferredVerifiedBusiness);
      const affectsVerifiedBusiness = entitlementIds.includes(VERIFIED_BUSINESS_ENTITLEMENT) || (entitlementIds.length === 0 && inferredVerifiedBusiness);

      const isActivation =
        type === "INITIAL_PURCHASE" ||
        type === "RENEWAL" ||
        type === "PRODUCT_CHANGE" ||
        type === "UNCANCELLATION" ||
        type === "TRANSFER" ||
        type === "NON_RENEWING_PURCHASE" ||
        type === "TEMPORARY_ENTITLEMENT_GRANT";
      const isDeactivation =
        type === "CANCELLATION" ||
        type === "EXPIRATION" ||
        type === "SUBSCRIPTION_PAUSED" ||
        type === "REFUND";

      if (affectsPro && isActivation) {
        await storage.createProUser(email, sessionId, {
          planType,
          expiresAt: planType === "lifetime" ? undefined : expiresAt,
        });
        clearProStatusCache(email);
        console.log(`[revenuecat] ${type} → activated Pro (${planType}) for ${email}`);
      }
      if (affectsPro && isDeactivation) {
        const existing = await storage.getProUser(email);
        if (existing && existing.active && existing.stripeSessionId.startsWith("iap-")) {
          await storage.setProUserActive(email, false);
          console.log(`[revenuecat] ${type} → deactivated Pro for ${email}`);
        }
        clearProStatusCache(email);
      }

      if (affectsVerifiedBusiness && isActivation) {
        // Use the same atomic reconcile path as the status endpoint so
        // tier changes (e.g. PRODUCT_CHANGE downgrading 25→1) trim
        // excess listings immediately even if the user never opens
        // the status screen, and so an unrecognized product fails
        // closed (deactivates listings) instead of granting access.
        const tierCapacity = tierCapacityFromProductId(productId);
        const reconciled = await storage.reconcileVerifiedBusinessFromRC({
          email,
          rcActive: true,
          productId: productId ?? null,
          tierCapacity,
          expiresAt: expiresAt ?? null,
          appUserId: event.app_user_id ?? email,
        });
        console.log(`[revenuecat] ${type} → verified_business reconciled tier=${reconciled.tierCapacity} used=${reconciled.used} for ${email}`);
      }
      if (affectsVerifiedBusiness && isDeactivation) {
        await storage.reconcileVerifiedBusinessFromRC({
          email,
          rcActive: false,
          productId: productId ?? null,
          tierCapacity: null,
          expiresAt: null,
          appUserId: event.app_user_id ?? email,
        });
        console.log(`[revenuecat] ${type} → deactivated verified_business for ${email}`);
      }

      if (!affectsPro && !affectsVerifiedBusiness) {
        console.log(`[revenuecat] event ${type} for ${email} — entitlements ${JSON.stringify(entitlementIds)}, no DB change`);
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[revenuecat] webhook handler failed:", err);
      res.status(500).json({ ok: false, error: err?.message ?? "webhook failed" });
    }
  });

  app.post("/api/promo/redeem", async (req, res) => {
    const { code, email } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code required" });
    }
    const promo = await storage.redeemPromoCode(code);
    if (!promo) {
      return res.status(404).json({ error: "Invalid or expired code" });
    }
    const expiresAt = new Date(Date.now() + promo.durationDays * 24 * 60 * 60 * 1000);
    // If a logged-in email is provided, persist the promo grant server-side
    // so Pro can be restored on any device after login
    if (email && typeof email === "string" && email.includes("@")) {
      await storage.createProUser(email.toLowerCase().trim(), `promo-${code}`, {
        planType: "promo",
        expiresAt,
      });
    }
    res.json({ success: true, durationDays: promo.durationDays, expiresAt: expiresAt.toISOString() });
  });

  app.post("/api/badge-profile", async (req, res) => {
    const { username, featuredBadges, plungeCount, uniqueDays, coldestTemp, foundingPlunger } = req.body;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username required" });
    }
    await storage.upsertBadgeProfile({
      username,
      featuredBadges: JSON.stringify(Array.isArray(featuredBadges) ? featuredBadges : []),
      plungeCount: typeof plungeCount === "number" ? plungeCount : 0,
      uniqueDays: typeof uniqueDays === "number" ? uniqueDays : 0,
      coldestTemp: typeof coldestTemp === "number" ? coldestTemp : null,
      foundingPlunger: foundingPlunger === true,
    });
    res.json({ ok: true });
  });

  app.get("/api/badge-profiles/batch", async (req, res) => {
    const raw = req.query.usernames;
    if (!raw || typeof raw !== "string") return res.json([]);
    const usernames = raw.split(",").map((u) => u.trim()).filter(Boolean).slice(0, 60);

    const profileResults = await Promise.all(usernames.map((u) => storage.getBadgeProfile(u)));
    // Map: requestedUsername → profile (keyed by the username as requested, not stored username)
    const found: { username: string; profile: Awaited<ReturnType<typeof storage.getBadgeProfile>> }[] = [];
    const missingUsernames: string[] = [];
    profileResults.forEach((p, i) => {
      if (p) { found.push({ username: usernames[i], profile: p }); }
      else { missingUsernames.push(usernames[i]); }
    });

    // For missed usernames, try email-prefix fallback (e.g. "kurlus23" → kurlus23@gmail.com → "Kurlus" profile)
    const emailFallbackResults = await Promise.all(
      missingUsernames.map(async (u) => {
        const user = await storage.getUserByEmailPrefix(u);
        if (!user) return null;
        const profile = user.displayName ? await storage.getBadgeProfile(user.displayName) : null;
        return { requestedUsername: u, profile };
      })
    );
    const stillMissing: string[] = [];
    emailFallbackResults.forEach((r, i) => {
      if (r?.profile) {
        // Return the profile but keyed by the requested username so the frontend map lookup works
        found.push({ username: missingUsernames[i], profile: { ...r.profile, username: missingUsernames[i] } });
      } else {
        stillMissing.push(missingUsernames[i]);
      }
    });

    // Get live foundingPlunger truth from pro_users for ALL usernames (found + missing).
    // This corrects stale badge_profiles rows where the field was written before admin granted
    // founding plunger status.
    const allQueryUsernames = usernames;
    const fpMap = allQueryUsernames.length > 0 ? await storage.getFoundingPlungerBatch(allQueryUsernames) : {};

    // Merge live foundingPlunger into already-found profiles
    const mergedFound = found.map((f) => {
      const liveIsFP = fpMap[f.username.toLowerCase()] === true || fpMap[f.profile!.username.toLowerCase()] === true;
      return { ...f.profile!, foundingPlunger: liveIsFP || f.profile!.foundingPlunger };
    });

    // Synthesise minimal profiles for users still missing a badge profile but who are founding plungers
    const computed = stillMissing
      .filter((u) => fpMap[u.toLowerCase()])
      .map((u) => ({
        username: u,
        featuredBadges: "[]",
        plungeCount: 0,
        uniqueDays: 0,
        coldestTemp: null,
        foundingPlunger: true,
        updatedAt: new Date().toISOString(),
      }));

    res.json([...mergedFound, ...computed]);
  });

  app.get("/api/badge-profile/:username", async (req, res) => {
    const requestedUsername = req.params.username;

    // Look up stored profile and user account in parallel
    let [storedProfile, user] = await Promise.all([
      storage.getBadgeProfile(requestedUsername),
      storage.getUserByDisplayName(requestedUsername),
    ]);

    // Fallback: find user by email prefix (e.g. "kurlus23" matches "kurlus23@gmail.com")
    // Runs whenever user lookup by display name failed — even if storedProfile exists —
    // so live plunge stats are always fetched for users without a display name set.
    if (!user) {
      const userByEmail = await storage.getUserByEmailPrefix(requestedUsername);
      if (userByEmail) {
        user = userByEmail;
        // If they have a profile under their display name, prefer that stored profile
        if (userByEmail.displayName && !storedProfile) {
          const profileByDisplayName = await storage.getBadgeProfile(userByEmail.displayName);
          if (profileByDisplayName) storedProfile = profileByDisplayName;
        }
      }
    }

    // If nothing found at all, 404
    if (!storedProfile && !user) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Freshen plunge stats from live data if we can find the user account
    let plungeCount = storedProfile?.plungeCount ?? 0;
    let uniqueDays = storedProfile?.uniqueDays ?? 0;
    let coldestTemp = storedProfile?.coldestTemp ?? null;

    if (user) {
      const userPlunges = await storage.getPlunges(undefined, user.id);
      plungeCount = userPlunges.length;
      uniqueDays = new Set(userPlunges.map((p) => new Date(p.createdAt).toLocaleDateString())).size;
      coldestTemp = userPlunges.length > 0 ? Math.min(...userPlunges.map((p) => p.temperature)) : null;
    }

    // Always get live foundingPlunger from pro_users — badge_profiles may be stale
    // (e.g. admin grants founding status after the user last synced their profile)
    const liveFpEmail = user?.email;
    const liveFpDisplayName = user?.displayName || requestedUsername;
    let liveFoundingPlunger = storedProfile?.foundingPlunger ?? false;
    if (liveFpEmail) {
      const proUser = await storage.getProUser(liveFpEmail.toLowerCase());
      if (proUser?.foundingPlunger) liveFoundingPlunger = true;
    } else {
      const fpMap = await storage.getFoundingPlungerBatch([liveFpDisplayName]);
      if (fpMap[liveFpDisplayName.toLowerCase()]) liveFoundingPlunger = true;
    }

    if (storedProfile) {
      return res.json({ ...storedProfile, plungeCount, uniqueDays, coldestTemp, foundingPlunger: liveFoundingPlunger });
    }

    // Auto-compute when no published profile exists yet (but user account found)
    // Prefer the user's display name if different from the URL param (e.g. email-prefix fallback)
    const resolvedUsername = user?.displayName || requestedUsername;
    return res.json({
      username: resolvedUsername,
      featuredBadges: "[]",
      plungeCount,
      uniqueDays,
      coldestTemp,
      updatedAt: new Date().toISOString(),
      foundingPlunger: liveFoundingPlunger,
      avatarUrl: null,
      bio: null,
      socialLinks: "{}",
      computed: true,
    });
  });

  // Update avatar, bio, and social links (profile owner only)
  app.patch("/api/badge-profile", async (req, res) => {
    const caller = extractUser(req);
    if (!caller) return res.status(401).json({ error: "Not authenticated" });
    const { avatarUrl, bio, socialLinks } = req.body;
    const callerUser = await storage.getUserById(caller.userId);
    if (!callerUser?.displayName) return res.status(400).json({ error: "No display name set" });
    const displayName = callerUser.displayName;

    // Validate avatarUrl is a URL, an object-storage path (/objects/...), or null
    let normalizedAvatarUrl: string | null | undefined = avatarUrl;
    if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== "") {
      const isObjectPath = typeof avatarUrl === "string" && avatarUrl.startsWith("/objects/");
      if (isObjectPath) {
        try {
          const { ObjectStorageService } = await import("./replit_integrations/object_storage");
          const svc = new ObjectStorageService();
          normalizedAvatarUrl = await svc.trySetObjectEntityAclPolicy(avatarUrl, {
            owner: String(caller.userId),
            visibility: "public",
          });
        } catch (err) {
          console.error("[badge-profile] Failed to set avatar ACL:", err);
          return res.status(400).json({ error: "Invalid uploaded image" });
        }
      } else {
        try { new URL(avatarUrl); } catch { return res.status(400).json({ error: "Invalid avatar URL" }); }
      }
    } else if (avatarUrl === "") {
      normalizedAvatarUrl = null;
    }

    // Validate socialLinks keys
    const allowedKeys = ["instagram", "snapchat", "facebook", "tiktok", "twitter", "youtube"];
    let parsedLinks: Record<string, string> = {};
    if (socialLinks) {
      try {
        parsedLinks = JSON.parse(socialLinks);
        for (const k of Object.keys(parsedLinks)) {
          if (!allowedKeys.includes(k)) delete parsedLinks[k];
        }
      } catch { return res.status(400).json({ error: "Invalid social links" }); }
    }

    await storage.updateBadgeProfileMeta(displayName, {
      avatarUrl: normalizedAvatarUrl ?? undefined,
      bio: typeof bio === "string" ? bio.slice(0, 200) : undefined,
      socialLinks: socialLinks !== undefined ? JSON.stringify(parsedLinks) : undefined,
    });
    res.json({ ok: true });
  });

  app.get("/api/founding-plunger-count", async (_req, res) => {
    const count = await storage.getProUserCount();
    const remaining = Math.max(0, 1000 - count);
    res.json({ count, remaining, limit: 1000 });
  });

  app.get("/api/lifetime-price", async (_req, res) => {
    const count = await storage.getProUserCount();
    const fpRemaining = Math.max(0, 1000 - count);
    const phase = getLifetimePhase(fpRemaining);
    res.json({
      phase,
      price: LIFETIME_PRICES[phase],
      priceId: LIFETIME_PRICE_IDS[phase],
      label: LIFETIME_LABELS[phase],
      fpRemaining,
      nextPrice: phase < 3 ? LIFETIME_PRICES[(phase + 1) as 2 | 3] : null,
    });
  });

  // ── Push Notifications ──────────────────────────────────────────
  app.post("/api/notifications/subscribe", async (req, res) => {
    const { endpoint, p256dh, auth, clientId } = req.body;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Missing subscription fields" });
    }
    const user = extractUser(req);
    await storage.upsertPushSubscription({
      userId: user?.userId,
      clientId: clientId ?? undefined,
      endpoint,
      p256dh,
      auth,
    });
    res.json({ ok: true });
  });

  app.delete("/api/notifications/unsubscribe", async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    await storage.deletePushSubscription(endpoint);
    res.json({ ok: true });
  });

  app.post("/api/notifications/streak-reminder", async (req, res) => {
    const { endpoint, streak } = req.body;
    if (!endpoint || typeof streak !== "number") {
      return res.status(400).json({ error: "Missing endpoint or streak" });
    }
    const sub = await storage.getPushSubscription(endpoint);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    // Rate-limit: only send once per ~20 hours per subscription
    if (sub.lastSentAt) {
      const hoursSinceLast = (Date.now() - new Date(sub.lastSentAt).getTime()) / 3600000;
      if (hoursSinceLast < 20) {
        return res.json({ ok: true, skipped: true });
      }
    }

    const streakText = streak === 1 ? "1-day streak" : `${streak}-day streak`;
    const payload = JSON.stringify({
      title: "Don't let your streak expire! 🧊",
      body: `Your ${streakText} is at risk — time to take the plunge!`,
      url: "/",
    });

    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      await storage.updatePushSubscriptionSentAt(endpoint);
      res.json({ ok: true });
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await storage.deletePushSubscription(endpoint);
      }
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // ── Events ──────────────────────────────────────────────────────────────────

  function genShareCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ── Helper: is user a coordinator (creator or co-coordinator) ─────────────────
  async function isEventManagerUser(evt: { createdBy: number | null }, userId: number, eventId: number): Promise<boolean> {
    if (evt.createdBy === userId) return true;
    return storage.isEventCoordinator(eventId, userId);
  }

  app.get("/api/events", async (_req, res) => {
    const evts = (await storage.getEvents()).filter((e) => !e.isPrivate);
    const withDetails = await Promise.all(evts.map(async (e) => ({
      ...e,
      participantCount: await storage.getEventParticipantCount(e.id),
      coordinators: await storage.getEventCoordinators(e.id),
    })));
    res.json(withDetails);
  });

  app.get("/api/events/joined", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.json([]);
    const ids = await storage.getJoinedEventIds(payload.userId);
    res.json(ids);
  });

  app.get("/api/events/:code", async (req, res) => {
    const evt = await storage.getEventByCode(req.params.code.toUpperCase());
    if (!evt) return res.status(404).json({ error: "Event not found" });
    const [participants, count, coordinators, bans] = await Promise.all([
      storage.getEventParticipants(evt.id),
      storage.getEventParticipantCount(evt.id),
      storage.getEventCoordinators(evt.id),
      storage.getEventBans(evt.id),
    ]);
    res.json({ ...evt, participants, participantCount: count, coordinators, bans });
  });

  app.post("/api/events", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required to create an event" });
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const { name, description, eventDate, endDate, locationName, locationId, plungeLat, plungeLng, accessLat, accessLng, contactName, contactPhone, contactEmail, maxAttendees, waiverUrl, paymentUrl, isPrivate, status, organizerNote } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Event name is required" });
    if (!eventDate) return res.status(400).json({ error: "Event date is required" });

    const startDate = new Date(eventDate);
    let parsedEndDate: Date | undefined;
    if (endDate) {
      parsedEndDate = new Date(endDate);
      const maxEnd = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (parsedEndDate > maxEnd) parsedEndDate = maxEnd;
      if (parsedEndDate < startDate) parsedEndDate = startDate;
    }

    const code = genShareCode();
    const evt = await storage.createEvent({
      name: name.trim(),
      description: description?.trim() || undefined,
      eventDate: startDate,
      endDate: parsedEndDate,
      locationName: locationName?.trim() || undefined,
      locationId: locationId?.trim() || undefined,
      plungeLat: plungeLat != null ? Number(plungeLat) : undefined,
      plungeLng: plungeLng != null ? Number(plungeLng) : undefined,
      accessLat: accessLat != null ? Number(accessLat) : undefined,
      accessLng: accessLng != null ? Number(accessLng) : undefined,
      contactName: contactName?.trim() || undefined,
      contactPhone: contactPhone?.trim() || undefined,
      contactEmail: contactEmail?.trim() || undefined,
      createdBy: user.id,
      createdByUsername: user.displayName || user.email.split("@")[0],
      shareCode: code,
      maxAttendees: maxAttendees != null && Number(maxAttendees) > 0 ? Number(maxAttendees) : null,
      waiverUrl: waiverUrl?.trim() || undefined,
      paymentUrl: paymentUrl?.trim() || undefined,
      isPrivate: isPrivate === true,
      status: ["active", "postponed", "cancelled"].includes(status) ? status : "active",
      organizerNote: organizerNote?.trim() || undefined,
    });
    res.json({ ...evt, participantCount: 0, participants: [], coordinators: [], bans: [] });
  });

  app.post("/api/events/:id/join", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required to join events" });
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });

    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isBanned = await storage.isEventBanned(eventId, user.id);
    if (isBanned) return res.status(403).json({ error: "You have been removed from this event by the organizer." });

    // Enforce attendee cap (organizer always allowed)
    if (evt.maxAttendees != null && evt.createdBy !== user.id) {
      const currentCount = await storage.getEventParticipantCount(eventId);
      if (currentCount >= evt.maxAttendees) {
        return res.status(409).json({ error: `This event is full (${evt.maxAttendees} attendee limit reached).` });
      }
    }

    const username = req.body.username || user.displayName || user.email.split("@")[0];
    const participant = await storage.joinEvent(eventId, user.id, username);
    res.json(participant);
  });

  app.delete("/api/events/:id/join", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    await storage.leaveEvent(eventId, payload.userId);
    res.json({ ok: true });
  });

  app.get("/api/events/:id/leaderboard", async (req, res) => {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    const entries = await storage.getEventLeaderboard(eventId);
    res.json(entries);
  });

  // ── Edit event ─────────────────────────────────────────────────────────────
  app.patch("/api/events/:id", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can edit this event" });

    const { name, description, eventDate, endDate, locationName, plungeLat, plungeLng, accessLat, accessLng, contactName, contactPhone, contactEmail, maxAttendees, waiverUrl, paymentUrl, isPrivate, status, organizerNote } = req.body;
    if (name !== undefined && !name?.trim()) return res.status(400).json({ error: "Event name cannot be empty" });

    let parsedEventDate: Date | undefined;
    let parsedEndDate: Date | null | undefined;

    if (eventDate) {
      parsedEventDate = new Date(eventDate);
    }
    if ("endDate" in req.body) {
      if (endDate) {
        parsedEndDate = new Date(endDate);
        const base = parsedEventDate ?? new Date(evt.eventDate);
        const maxEnd = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (parsedEndDate > maxEnd) parsedEndDate = maxEnd;
        if (parsedEndDate < base) parsedEndDate = base;
      } else {
        parsedEndDate = null;
      }
    }

    const updated = await storage.updateEvent(eventId, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(parsedEventDate ? { eventDate: parsedEventDate } : {}),
      ...("endDate" in req.body ? { endDate: parsedEndDate } : {}),
      ...(locationName !== undefined ? { locationName } : {}),
      ...("plungeLat" in req.body ? { plungeLat: plungeLat != null ? Number(plungeLat) : null } : {}),
      ...("plungeLng" in req.body ? { plungeLng: plungeLng != null ? Number(plungeLng) : null } : {}),
      ...("accessLat" in req.body ? { accessLat: accessLat != null ? Number(accessLat) : null } : {}),
      ...("accessLng" in req.body ? { accessLng: accessLng != null ? Number(accessLng) : null } : {}),
      ...("contactName" in req.body ? { contactName: contactName?.trim() || null } : {}),
      ...("contactPhone" in req.body ? { contactPhone: contactPhone?.trim() || null } : {}),
      ...("contactEmail" in req.body ? { contactEmail: contactEmail?.trim() || null } : {}),
      ...("maxAttendees" in req.body ? { maxAttendees: maxAttendees != null && Number(maxAttendees) > 0 ? Number(maxAttendees) : null } : {}),
      ...("waiverUrl" in req.body ? { waiverUrl: waiverUrl?.trim() || null } : {}),
      ...("paymentUrl" in req.body ? { paymentUrl: paymentUrl?.trim() || null } : {}),
      ...("isPrivate" in req.body ? { isPrivate: isPrivate === true } : {}),
      ...("status" in req.body ? { status: ["active", "postponed", "cancelled"].includes(status) ? status : "active" } : {}),
      ...("organizerNote" in req.body ? { organizerNote: organizerNote?.trim() || null } : {}),
    });
    res.json(updated);
  });

  // ── Delete event ───────────────────────────────────────────────────────────
  app.delete("/api/events/:id", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can delete this event" });
    await storage.deleteEvent(eventId);
    res.json({ ok: true });
  });

  // ── Remove participant (manager only) ──────────────────────────────────────
  app.delete("/api/events/:id/participants/:userId", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(eventId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can remove participants" });
    await storage.removeEventParticipant(eventId, targetUserId);
    res.json({ ok: true });
  });

  // ── Ban participant (manager only) ─────────────────────────────────────────
  app.post("/api/events/:id/bans/:userId", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(eventId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can ban participants" });
    if (targetUserId === evt.createdBy) return res.status(400).json({ error: "Cannot ban the event creator" });
    const targetUser = await storage.getUserById(targetUserId);
    const username = req.body.username || targetUser?.displayName || `User ${targetUserId}`;
    const ban = await storage.banEventParticipant(eventId, targetUserId, username);
    res.json(ban);
  });

  // ── Unban participant (manager only) ───────────────────────────────────────
  app.delete("/api/events/:id/bans/:userId", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(eventId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can unban participants" });
    await storage.unbanEventParticipant(eventId, targetUserId);
    res.json({ ok: true });
  });

  // ── Event coordinators ─────────────────────────────────────────────────────
  app.post("/api/events/:id/coordinators", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can add coordinators" });

    const { displayName } = req.body;
    if (!displayName?.trim()) return res.status(400).json({ error: "Display name is required" });

    const targetUser = await storage.getUserByDisplayName(displayName.trim());
    if (!targetUser) return res.status(404).json({ error: `No user found with display name "${displayName.trim()}"` });
    if (targetUser.id === evt.createdBy) return res.status(400).json({ error: "That user is already the event creator" });

    const username = targetUser.displayName || targetUser.email.split("@")[0];
    const coord = await storage.addEventCoordinator(eventId, targetUser.id, username);
    res.json(coord);
  });

  app.delete("/api/events/:id/coordinators/:userId", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const eventId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    if (isNaN(eventId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid id" });
    const evt = await storage.getEventById(eventId);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    if (!(await isEventManagerUser(evt, payload.userId, eventId)))
      return res.status(403).json({ error: "Only event coordinators can remove coordinators" });

    await storage.removeEventCoordinator(eventId, targetUserId);
    res.json({ ok: true });
  });

  // ── User lookup (for adding coordinators) ─────────────────────────────────
  app.get("/api/users/lookup", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ error: "Login required" });
    const name = req.query.name as string;
    if (!name?.trim()) return res.status(400).json({ error: "name query param required" });
    const user = await storage.getUserByDisplayName(name.trim());
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, displayName: user.displayName, email: user.email.split("@")[0] + "@…" });
  });

  // Daily streak-at-risk push notifications — server-side scheduler
  let lastDailyReminderDate = "";

  async function sendDailyStreakReminders() {
    try {
      const allSubs = await storage.getAllPushSubscriptions();
      const todayStr = new Date().toLocaleDateString("en-US");
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toLocaleDateString("en-US");

      for (const sub of allSubs) {
        try {
          // Rate-limit: skip if already notified in last 20 hours
          if (sub.lastSentAt) {
            const hoursSince = (Date.now() - new Date(sub.lastSentAt).getTime()) / 3600000;
            if (hoursSince < 20) continue;
          }

          const userPlunges = await storage.getPlunges(sub.clientId ?? undefined, sub.userId ?? undefined);
          if (userPlunges.length === 0) continue;

          const plungedToday = userPlunges.some(
            (p) => new Date(p.createdAt).toLocaleDateString("en-US") === todayStr
          );
          if (plungedToday) continue;

          // Must have plunged yesterday for streak to be at risk
          const plungedYesterday = userPlunges.some(
            (p) => new Date(p.createdAt).toLocaleDateString("en-US") === yesterdayStr
          );
          if (!plungedYesterday) continue;

          // Count consecutive streak days going back from yesterday
          const dateSet = new Set(userPlunges.map((p) => new Date(p.createdAt).toLocaleDateString("en-US")));
          let streak = 0;
          const checkDate = new Date();
          checkDate.setDate(checkDate.getDate() - 1);
          while (dateSet.has(checkDate.toLocaleDateString("en-US"))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
          if (streak === 0) continue;

          const streakText = streak === 1 ? "1-day streak" : `${streak}-day streak`;
          const payload = JSON.stringify({
            title: "Don't let your streak expire! 🧊",
            body: `Your ${streakText} is at risk — time to take the plunge!`,
            url: "/",
          });

          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          await storage.updatePushSubscriptionSentAt(sub.endpoint);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await storage.deletePushSubscription(sub.endpoint);
          }
        }
      }
    } catch (err) {
      console.error("Daily streak reminder error:", err);
    }
  }

  // Check every minute — fire at 18:00 UTC once per day
  setInterval(() => {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    if (now.getUTCHours() === 18 && now.getUTCMinutes() === 0 && dateStr !== lastDailyReminderDate) {
      lastDailyReminderDate = dateStr;
      sendDailyStreakReminders();
    }
  }, 60 * 1000);

  // Hourly cleanup — delete events whose end window has passed
  setInterval(async () => {
    try {
      const n = await storage.deleteExpiredEvents();
      if (n > 0) console.log(`[events] Deleted ${n} expired event(s)`);
    } catch (err) {
      console.error("[events] Error during expiry cleanup:", err);
    }
  }, 60 * 60 * 1000);
  // Run once at startup too
  storage.deleteExpiredEvents().catch(() => {});

  // ── Churn-survey routes ─────────────────────────────────────────────────
  // Public token-auth endpoints (no JWT — token IS the auth):
  app.get("/api/churn-survey/:token", async (req, res) => {
    const { getSurveyByToken } = await import("./churn-survey");
    const data = await getSurveyByToken(req.params.token);
    if (!data) return res.status(404).json({ message: "Survey not found" });
    res.json(data);
  });

  app.post("/api/churn-survey/:token", async (req, res) => {
    const { recordSurveyResponse } = await import("./churn-survey");
    const parsed = z.object({
      reason: z.string().min(1).max(40),
      comment: z.string().max(2000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const r = await recordSurveyResponse(req.params.token, parsed.data.reason, parsed.data.comment ?? null);
    if (!r.ok) return res.status(400).json({ message: r.reason });
    res.json({ ok: true });
  });

  // Admin-only endpoints:
  app.get("/api/admin/churn-surveys", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const { listChurnSurveys } = await import("./churn-survey");
    res.json(await listChurnSurveys());
  });

  app.post("/api/admin/churn-surveys/run", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const { runChurnSurveyScan, reconcileCameBack } = await import("./churn-survey");
    await reconcileCameBack();
    const result = await runChurnSurveyScan();
    res.json(result);
  });

  return httpServer;
}
