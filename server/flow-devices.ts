import type { Express, Request } from "express";
import crypto from "crypto";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { flowDevices, flowTelemetry, plunges } from "@shared/schema";

type AppUser = { userId: number; email: string } | null;
type ExtractUser = (req: Request) => AppUser;

const claimSchema = z.object({
  deviceId: z.string().trim().min(4).max(80).regex(/^[A-Za-z0-9_-]+$/),
  pairingKey: z.string().trim().min(20).max(200),
  name: z.string().trim().min(1).max(50).optional(),
});

const telemetrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  flowLpm: z.number().finite().min(0).max(2000),
  waterTempC: z.number().finite().min(-5).max(80),
  normalFlowLpm: z.number().finite().positive().max(2000).nullable().optional(),
  relayState: z.enum(["off", "on", "tripped"]),
  safetyState: z.enum(["boot_safe", "normal", "warning", "low_flow_trip", "sensor_fault", "watchdog_trip", "manual_off"]),
  faultCode: z.enum(["low_flow", "sensor_stale", "sensor_invalid", "watchdog_reset", "boot_safe"]).nullable().optional(),
  firmwareVersion: z.string().max(40).optional(),
  controllerUptimeMs: z.number().int().nonnegative().max(2_147_483_647).optional(),
});

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqualHex(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function deviceCredentials(req: Request) {
  const deviceId = String(req.header("x-device-id") || "").trim();
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Device ") ? auth.slice(7).trim() : "";
  return { deviceId, token };
}

async function authenticateDevice(req: Request) {
  const { deviceId, token } = deviceCredentials(req);
  if (!deviceId || !token) return null;
  const [device] = await db.select().from(flowDevices).where(eq(flowDevices.deviceId, deviceId));
  if (!device || !safeEqualHex(device.authTokenHash, tokenHash(token))) return null;
  return device;
}

function publicDevice(device: typeof flowDevices.$inferSelect) {
  const lastSeenMs = device.lastSeenAt?.getTime() ?? 0;
  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.name,
    firmwareVersion: device.firmwareVersion,
    normalFlowLpm: device.normalFlowLpm == null ? null : Number(device.normalFlowLpm),
    warningThresholdPct: device.warningThresholdPct,
    flowLpm: device.flowLpm == null ? null : Number(device.flowLpm),
    waterTempC: device.waterTempC == null ? null : Number(device.waterTempC),
    relayState: device.relayState,
    safetyState: device.safetyState,
    latestFault: device.latestFault,
    lastSeenAt: device.lastSeenAt,
    isStale: !lastSeenMs || Date.now() - lastSeenMs > 15_000,
  };
}

export function registerFlowDeviceRoutes(app: Express, extractUser: ExtractUser) {
  app.post("/api/flow-devices/claim", async (req, res) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ message: "Sign in to pair a controller" });
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { deviceId, pairingKey, name } = parsed.data;
    const [existing] = await db.select().from(flowDevices).where(eq(flowDevices.deviceId, deviceId));
    if (existing && existing.userId !== user.userId) {
      return res.status(409).json({ message: "This controller is already paired to another account" });
    }
    if (existing) {
      if (!safeEqualHex(existing.authTokenHash, tokenHash(pairingKey))) {
        return res.status(403).json({ message: "Pairing key is incorrect" });
      }
      const [updated] = await db.update(flowDevices)
        .set({ name: name || existing.name, updatedAt: new Date() })
        .where(eq(flowDevices.id, existing.id))
        .returning();
      return res.json(publicDevice(updated));
    }
    const [created] = await db.insert(flowDevices).values({
      deviceId,
      userId: user.userId,
      name: name || "Cold Plunge Controller",
      authTokenHash: tokenHash(pairingKey),
    }).returning();
    res.status(201).json(publicDevice(created));
  });

  app.get("/api/flow-devices/me", async (req, res) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const rows = await db.select().from(flowDevices)
      .where(eq(flowDevices.userId, user.userId))
      .orderBy(desc(flowDevices.updatedAt));
    res.json(rows.map(publicDevice));
  });

  // Polled by an ESP32 after local Bluetooth setup. A controller is not
  // authorized merely because it has Wi-Fi or knows a URL; the signed-in app
  // must first claim it over the local pairing flow.
  app.get("/api/flow-devices/authorization", async (req, res) => {
    const device = await authenticateDevice(req);
    if (!device) return res.status(401).json({ authorized: false });
    res.json({
      authorized: true,
      deviceId: device.deviceId,
      warningThresholdPct: device.warningThresholdPct,
      normalFlowLpm: device.normalFlowLpm == null ? null : Number(device.normalFlowLpm),
    });
  });

  app.delete("/api/flow-devices/:id", async (req, res) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid device" });
    const deleted = await db.delete(flowDevices)
      .where(and(eq(flowDevices.id, id), eq(flowDevices.userId, user.userId)))
      .returning({ id: flowDevices.id });
    if (!deleted.length) return res.status(404).json({ message: "Device not found" });
    res.json({ ok: true });
  });

  app.patch("/api/flow-devices/:id/session", async (req, res) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const id = Number(req.params.id);
    const parsed = z.object({ plungeId: z.number().int().positive().nullable() }).safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return res.status(400).json({ message: "Invalid session" });
    if (parsed.data.plungeId != null) {
      const [plunge] = await db.select({ id: plunges.id }).from(plunges)
        .where(and(eq(plunges.id, parsed.data.plungeId), eq(plunges.userId, user.userId)));
      if (!plunge) return res.status(404).json({ message: "Plunge not found" });
    }
    const [updated] = await db.update(flowDevices)
      .set({ activePlungeId: parsed.data.plungeId, updatedAt: new Date() })
      .where(and(eq(flowDevices.id, id), eq(flowDevices.userId, user.userId)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Device not found" });
    res.json(publicDevice(updated));
  });

  app.post("/api/flow-devices/telemetry", async (req, res) => {
    const device = await authenticateDevice(req);
    if (!device) return res.status(401).json({ message: "Invalid device credentials" });
    const parsed = telemetrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const sample = parsed.data;
    if (sample.sequence <= device.lastSequence) {
      return res.status(409).json({ message: "Telemetry sequence must increase", acceptedSequence: device.lastSequence });
    }
    await db.transaction(async (tx) => {
      await tx.insert(flowTelemetry).values({
        deviceId: device.id,
        userId: device.userId,
        plungeId: device.activePlungeId,
        sequence: sample.sequence,
        flowLpm: String(sample.flowLpm),
        waterTempC: String(sample.waterTempC),
        normalFlowLpm: sample.normalFlowLpm == null ? null : String(sample.normalFlowLpm),
        relayState: sample.relayState,
        safetyState: sample.safetyState,
        faultCode: sample.faultCode || null,
        controllerUptimeMs: sample.controllerUptimeMs,
      });
      await tx.update(flowDevices).set({
        flowLpm: String(sample.flowLpm),
        waterTempC: String(sample.waterTempC),
        normalFlowLpm: sample.normalFlowLpm == null ? device.normalFlowLpm : String(sample.normalFlowLpm),
        relayState: sample.relayState,
        safetyState: sample.safetyState,
        latestFault: sample.faultCode || (sample.safetyState === "normal" ? null : device.latestFault),
        firmwareVersion: sample.firmwareVersion || device.firmwareVersion,
        lastSequence: sample.sequence,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(flowDevices.id, device.id), sql`${flowDevices.lastSequence} < ${sample.sequence}`));
    });
    res.status(202).json({ ok: true, acceptedSequence: sample.sequence });
  });
}