import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-02-24.acacia" });
const PRICE_ID = process.env.STRIPE_PRICE_ID!;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.plunges.list.path, async (req, res) => {
    const allPlunges = await storage.getPlunges();
    res.json(allPlunges);
  });

  app.post(api.plunges.create.path, async (req, res) => {
    try {
      const input = api.plunges.create.input.parse(req.body);
      const plungeData = { ...input, score: String(input.score) };
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

  // Leaderboard
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

  // Community locations
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

  // Stripe — create checkout session
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

  // Stripe — verify completed session and store pro status
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
      res.json({ email: proUser.email, isPro: true });
    } catch (err) {
      console.error("Stripe verify error:", err);
      res.status(500).json({ message: "Failed to verify session" });
    }
  });

  // Pro status — check by email (for restore purchase)
  app.get("/api/pro-status/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const user = await storage.getProUser(email);
    if (user && user.active) {
      res.json({ email: user.email, isPro: true });
    } else {
      res.json({ email, isPro: false });
    }
  });

  return httpServer;
}
