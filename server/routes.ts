import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail, sendMilestoneEmail, sendAdminSecurityAlert } from "./email";
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
const ANNUAL_PRICE_ID = TEST_MODE
  ? process.env.STRIPE_TEST_ANNUAL_PRICE_ID!
  : process.env.STRIPE_ANNUAL_PRICE_ID!;
const MONTHLY_PRICE_ID = TEST_MODE
  ? process.env.STRIPE_TEST_MONTHLY_PRICE_ID!
  : (process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_ANNUAL_PRICE_ID!);
const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";
const ADMIN_EMAILS = new Set(["kurlus23@gmail.com", "coldstreakapp17@gmail.com"]);
// Usernames whose login/reset events trigger a security alert to kurlus23@gmail.com
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

async function seedTestVerifiedBusiness() {
  try {
    const { db } = await import("./db");
    const { userLocations } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [existing] = await db.select().from(userLocations).where(eq(userLocations.name, "Arctic Recovery Studio"));
    if (!existing) {
      await db.insert(userLocations).values({
        name: "Arctic Recovery Studio",
        country: "USA",
        state: "Virginia",
        city: "Fredericksburg",
        fullAddress: "2265 Princess Anne St, Fredericksburg, VA 22401",
        description: "Premium cold plunge facility offering private and group sessions. Featuring Morozko Forge tubs at 34–38°F, infrared sauna, and guided breathwork coaching. Walk-ins welcome.",
        isBusiness: true,
        businessVerified: true,
        phone: "(540) 555-0182",
        websiteUrl: "https://arcticrecoverystudio.com",
        yelpUrl: "https://yelp.com",
        bookingUrl: "https://arcticrecoverystudio.com/book",
        modalities: ["Cold Plunge", "Infrared Sauna", "Breathwork", "Recovery Therapy"],
        latitude: "38.3005",
        longitude: "-77.4605",
        submittedBy: "Demo",
        contactEmail: "demo@arcticrecoverystudio.com",
        nominationCount: 0,
      });
      console.log("[seed] Created test verified business: Arctic Recovery Studio");
    }
  } catch (err) {
    console.error("[seed] Failed to seed test verified business:", err);
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
  await seedTestVerifiedBusiness();
  await seedAdminAccount();
  // TEMP: backfill contactEmail on Kurlus's community locations that predate auto-injection
  try {
    const { db } = await import("./db");
    const { userLocations } = await import("@shared/schema");
    const { and, eq, isNull, inArray } = await import("drizzle-orm");
    await db.update(userLocations)
      .set({ contactEmail: "kurlus23@gmail.com" })
      .where(and(inArray(userLocations.id, [7, 8]), isNull(userLocations.contactEmail)));
  } catch (_) {}


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
    res.json({ id: user.id, email: user.email, emailVerified: user.emailVerified });
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

  // ── Admin: manage pro users ─────────────────────────────────────────────
  app.get("/api/admin/pro-users", async (req, res) => {
    const caller = extractUser(req);
    if (!isCallerAdmin(caller)) return res.status(403).json({ message: "Admin only" });
    const users = await storage.getAllProUsers();
    res.json(users);
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

      res.json({ url: session.url });
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
  app.post("/api/stripe/business-checkout", async (req, res) => {
    try {
      const { successUrl, cancelUrl, locationId, email } = z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
        locationId: z.number().int().positive(),
        email: z.string().email(),
      }).parse(req.body);

      // Verify the requester owns this listing by matching their contact email
      const loc = await storage.getUserLocationById(locationId);
      if (!loc) return res.status(404).json({ message: "Listing not found" });
      if (!loc.contactEmail || loc.contactEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(403).json({ message: "Email does not match the contact email on this listing. Only the business owner can verify." });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "ColdStreak Verified Business Listing",
              description: "✓ Verified badge on ColdStreak community boards — $29.99/month (first month free)",
            },
            unit_amount: 2999,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        mode: "subscription",
        subscription_data: { trial_period_days: 30 },
        metadata: { type: "business_listing", locationId: locationId.toString() },
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
      event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      return res.status(400).json({ message: "Webhook signature invalid" });
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

    // If already lifetime in DB, return immediately (no Stripe needed)
    if (user && user.active && !isExpired && user.planType === "lifetime") {
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
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 3 });
        if (subs.data.length > 0) {
          const sub = subs.data[0];
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

    // No active subscription found in Stripe — if DB still shows active, deactivate it
    if (!foundActiveSub && isActiveNonLifetime) {
      await storage.setProUserActive(email, false);
    }

    res.json({ email, isPro: false, foundingPlunger: false });
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

    // For users still without a badge profile, surface founding plunger status
    const fpMap = stillMissing.length > 0 ? await storage.getFoundingPlungerBatch(stillMissing) : {};
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

    res.json([...found.map((f) => f.profile!), ...computed]);
  });

  app.get("/api/badge-profile/:username", async (req, res) => {
    const requestedUsername = req.params.username;

    // Look up stored profile and user account in parallel
    let [storedProfile, user] = await Promise.all([
      storage.getBadgeProfile(requestedUsername),
      storage.getUserByDisplayName(requestedUsername),
    ]);

    // Fallback: find user by email prefix (e.g. "kurlus23" matches "kurlus23@gmail.com")
    // This covers events created before the user set a display name
    if (!storedProfile && !user) {
      const userByEmail = await storage.getUserByEmailPrefix(requestedUsername);
      if (userByEmail) {
        user = userByEmail;
        // If they have a profile under their display name, use that
        if (userByEmail.displayName) {
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

    if (storedProfile) {
      return res.json({ ...storedProfile, plungeCount, uniqueDays, coldestTemp });
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
      foundingPlunger: false,
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

    // Validate avatarUrl is a URL or null
    if (avatarUrl !== undefined && avatarUrl !== null) {
      try { new URL(avatarUrl); } catch { return res.status(400).json({ error: "Invalid avatar URL" }); }
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
      avatarUrl: avatarUrl ?? undefined,
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
    const evts = await storage.getEvents();
    const withDetails = await Promise.all(evts.map(async (e) => ({
      ...e,
      participantCount: await storage.getEventParticipantCount(e.id),
      coordinators: await storage.getEventCoordinators(e.id),
    })));
    res.json(withDetails);
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

    const { name, description, eventDate, endDate, locationName, locationId, plungeLat, plungeLng, accessLat, accessLng, contactName, contactPhone, contactEmail, maxAttendees } = req.body;
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

  app.get("/api/events/joined", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.json([]);
    const ids = await storage.getJoinedEventIds(payload.userId);
    res.json(ids);
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

    const { name, description, eventDate, endDate, locationName, plungeLat, plungeLng, accessLat, accessLng, contactName, contactPhone, contactEmail, maxAttendees } = req.body;
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

  return httpServer;
}
