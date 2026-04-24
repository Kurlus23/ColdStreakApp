import { registerPlugin, Capacitor } from "@capacitor/core";
import { apiRequest, queryClient } from "@/lib/queryClient";

/**
 * Receives plunge payloads from the Apple Watch via the WatchSync native plugin
 * (see watchos/ios-bridge/WatchSyncPlugin.swift), then maps them to our /api/plunges
 * schema and POSTs them.
 *
 * The native side queues incoming plunges in UserDefaults so nothing is lost when
 * the iOS app isn't open. We drain that queue on app start and also listen live for
 * new arrivals.
 */

interface WatchPlungePayload {
  _id: string;
  _receivedAt?: number;
  source?: string;
  startedAt?: number;       // unix seconds
  endedAt?: number;         // unix seconds
  durationSec?: number;
  waterTempF?: number;
  avgHR?: number;
  maxHR?: number;
  minHR?: number;
  hrvBaselineMs?: number | null;
  hrvPostMs?: number | null;
  restingHRBaseline?: number | null;
  recoverySec?: number | null;
}

interface WatchSyncPlugin {
  getPendingPlunges: () => Promise<{ plunges: WatchPlungePayload[] }>;
  clearPendingPlunges: (opts: { ids: string[] }) => Promise<void>;
  addListener: (
    event: "watchPlungeReceived",
    cb: (p: WatchPlungePayload) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

const WatchSync = registerPlugin<WatchSyncPlugin>("WatchSync");

function plungeScore(durationSeconds: number, tempF: number): number {
  // Mirrors client/src/pages/Home.tsx plungeScore — kept in sync to avoid
  // round-trips while we map the watch payload.
  if (durationSeconds <= 0) return 0;
  const tempFactor = Math.max(1, 90 - tempF);
  return Math.round(durationSeconds * tempFactor * 0.1);
}

function estimateCalories(durationSec: number, tempF: number, weightLbs: number): number {
  // Same model as Home.tsx — see notes there. Conservative shivering-thermogenesis estimate.
  const weightKg = weightLbs * 0.4536;
  const tempC = (tempF - 32) * (5 / 9);
  const intensity = Math.max(0.5, Math.min(2.0, (15 - tempC) / 10));
  const minutes = durationSec / 60;
  return Math.max(0, Math.round(weightKg * intensity * minutes * 0.05));
}

function toApiPayload(p: WatchPlungePayload): {
  duration: number;
  temperature: number;
  score: string;
  hrAvg: number | null;
  spo2Avg: number | null;
  timerUsed: boolean;
  calories: number;
  createdAt?: string;
  locationId?: string;
  locationName?: string;
} {
  const durationSec = Math.max(1, Math.round(p.durationSec ?? 0));
  const tempF = Math.round(p.waterTempF ?? 50);
  const weightLbs = Number(localStorage.getItem("coldstreak-body-weight") || 150);

  // Prefer explicit avgHR; fall back to mid-point of max/min if needed.
  let hrAvg: number | null = null;
  if (p.avgHR && p.avgHR > 0) hrAvg = Math.round(p.avgHR);
  else if (p.maxHR && p.minHR && p.maxHR > 0 && p.minHR > 0) {
    hrAvg = Math.round((p.maxHR + p.minHR) / 2);
  }

  const createdAt = p.endedAt
    ? new Date(p.endedAt * 1000).toISOString()
    : undefined;

  return {
    duration: durationSec,
    temperature: tempF,
    score: String(plungeScore(durationSec, tempF)),
    hrAvg,
    spo2Avg: null,
    timerUsed: true,
    calories: estimateCalories(durationSec, tempF, weightLbs),
    createdAt,
    locationId: "home",
    locationName: "",
  };
}

async function sendOne(p: WatchPlungePayload): Promise<boolean> {
  try {
    const body = toApiPayload(p);
    await apiRequest("POST", "/api/plunges", body);
    return true;
  } catch (err) {
    console.warn("[watchSync] Failed to POST watch plunge:", err);
    return false;
  }
}

export async function drainWatchQueue(opts?: { onSynced?: (count: number) => void }): Promise<number> {
  if (Capacitor.getPlatform() !== "ios") return 0;
  try {
    const { plunges } = await WatchSync.getPendingPlunges();
    if (!plunges?.length) return 0;

    const drainedIds: string[] = [];
    for (const p of plunges) {
      const ok = await sendOne(p);
      if (ok) drainedIds.push(p._id);
    }

    if (drainedIds.length) {
      await WatchSync.clearPendingPlunges({ ids: drainedIds });
      queryClient.invalidateQueries({ queryKey: ["/api/plunges"] });
      opts?.onSynced?.(drainedIds.length);
    }
    return drainedIds.length;
  } catch (err) {
    console.warn("[watchSync] drainWatchQueue failed:", err);
    return 0;
  }
}

let listenerHandle: { remove: () => Promise<void> } | null = null;

export async function startWatchListener(opts?: { onSynced?: (count: number) => void }): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;
  if (listenerHandle) return;
  try {
    listenerHandle = await WatchSync.addListener("watchPlungeReceived", async () => {
      // Re-drain the queue (the native side already enqueued the new arrival).
      await drainWatchQueue(opts);
    });
  } catch (err) {
    console.warn("[watchSync] startWatchListener failed:", err);
  }
}

export async function stopWatchListener(): Promise<void> {
  try {
    await listenerHandle?.remove();
  } catch { /* noop */ }
  listenerHandle = null;
}
