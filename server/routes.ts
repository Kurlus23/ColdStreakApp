import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail, sendMilestoneEmail } from "./email";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:ColdStreakApp17@gmail.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });
const PRICE_ID = process.env.STRIPE_PRICE_ID!;
const JWT_SECRET = process.env.SESSION_SECRET || "coldstreak-dev-secret";

interface JwtPayload { userId: number; email: string; }

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "90d" });
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
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
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }).parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });

      const token = signToken({ userId: user.id, email: user.email });
      res.json({ token, user: { id: user.id, email: user.email, emailVerified: user.emailVerified } });
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
    const user = await storage.verifyEmailToken(token);
    if (!user) return res.status(400).json({ message: "Invalid or already used verification link" });
    res.json({ ok: true, emailVerified: true });
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    const payload = extractUser(req);
    if (!payload) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(payload.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.emailVerified) return res.json({ ok: true, already: true });
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await storage.setVerifyToken(user.id, verifyToken);
    const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
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
        const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
        const resetUrl = `${origin}/reset-password?token=${token}`;
        await sendPasswordResetEmail(email, resetUrl);
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
    const locations = await storage.getUserLocations(country);
    res.json(locations);
  });

  app.post("/api/community-locations", async (req, res) => {
    try {
      const input = z.object({
        name: z.string().min(2).max(100),
        country: z.string().min(2).max(60),
        state: z.string().max(60).optional(),
        city: z.string().max(60).optional(),
        description: z.string().max(300).optional(),
        submittedBy: z.string().max(50).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }).parse(req.body);
      const loc = await storage.createUserLocation(input);
      res.status(201).json(loc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post("/api/community-locations/:id/nominate", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const updated = await storage.nominateUserLocation(id);
    if (!updated) return res.status(404).json({ message: "Location not found" });
    res.json(updated);
  });

  // ── Stripe ─────────────────────────────────────────────────────────────

  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { successUrl, cancelUrl } = z.object({
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }).parse(req.body);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        mode: "payment",
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        customer_email: undefined,
        allow_promotion_codes: true,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.get("/api/stripe/verify", async (req, res) => {
    const { session_id } = req.query;
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ message: "Missing session_id" });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(402).json({ message: "Payment not completed" });
      }
      const email = session.customer_details?.email;
      if (!email) {
        return res.status(400).json({ message: "No email on session" });
      }
      const proUser = await storage.createProUser(email, session_id);
      res.json({ email: proUser.email, isPro: true, foundingPlunger: proUser.foundingPlunger });
    } catch (err) {
      console.error("Stripe verify error:", err);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });

  app.get("/api/pro-status/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const user = await storage.getProUser(email);
    if (user && user.active) {
      res.json({ email: user.email, isPro: true, foundingPlunger: user.foundingPlunger });
    } else {
      res.json({ email, isPro: false, foundingPlunger: false });
    }
  });

  app.post("/api/promo/redeem", async (req, res) => {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code required" });
    }
    const promo = await storage.redeemPromoCode(code);
    if (!promo) {
      return res.status(404).json({ error: "Invalid or expired code" });
    }
    const expiresAt = new Date(Date.now() + promo.durationDays * 24 * 60 * 60 * 1000).toISOString();
    res.json({ success: true, durationDays: promo.durationDays, expiresAt });
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

  app.get("/api/badge-profile/:username", async (req, res) => {
    const profile = await storage.getBadgeProfile(req.params.username);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  });

  app.get("/api/founding-plunger-count", async (_req, res) => {
    const count = await storage.getProUserCount();
    const remaining = Math.max(0, 1000 - count);
    res.json({ count, remaining, limit: 1000 });
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

  return httpServer;
}
