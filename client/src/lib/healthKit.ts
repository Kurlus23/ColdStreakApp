import { registerPlugin, Capacitor } from "@capacitor/core";

/**
 * Reads heart rate / HRV data from Apple Health on iPhone via the native
 * HealthKitPlugin (see watchos/ios-bridge/HealthKitPlugin.swift).
 *
 * This is how ColdStreak picks up HR/HRV from devices that aren't Apple Watch
 * but DO sync to Apple Health (Garmin, Whoop, Oura, Fitbit, T-Rex 2 via 3rd-party
 * sync apps, etc.) — fills in `hrAvg` for plunges logged directly on the iPhone
 * when no live BLE heart-rate monitor was connected.
 */

interface HealthKitPlugin {
  isAvailable: () => Promise<{ available: boolean }>;
  requestAuth: () => Promise<{ granted: boolean }>;
  getHrAvg: (opts: { startMs: number; endMs: number }) => Promise<{ avg: number | null; samples: number }>;
  getRecentHrv: (opts: { lookbackMinutes: number }) => Promise<{ avgMs: number | null; samples: number }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

const AUTH_REQUESTED_KEY = "coldstreak-healthkit-asked";

export function isHealthKitPossible(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

export async function ensureHealthKitAuth(): Promise<boolean> {
  if (!isHealthKitPossible()) return false;
  try {
    const { available } = await HealthKit.isAvailable();
    if (!available) return false;
    const { granted } = await HealthKit.requestAuth();
    if (granted) localStorage.setItem(AUTH_REQUESTED_KEY, "1");
    return granted;
  } catch (err) {
    console.warn("[healthKit] auth failed:", err);
    return false;
  }
}

export async function fetchHrAvgForWindow(startedAt: Date, endedAt: Date): Promise<number | null> {
  if (!isHealthKitPossible()) return null;
  try {
    const { avg } = await HealthKit.getHrAvg({
      startMs: startedAt.getTime(),
      endMs: endedAt.getTime(),
    });
    return avg ?? null;
  } catch (err) {
    console.warn("[healthKit] getHrAvg failed:", err);
    return null;
  }
}

export async function fetchRecentHrvMs(lookbackMinutes = 60): Promise<number | null> {
  if (!isHealthKitPossible()) return null;
  try {
    const { avgMs } = await HealthKit.getRecentHrv({ lookbackMinutes });
    return avgMs ?? null;
  } catch (err) {
    console.warn("[healthKit] getRecentHrv failed:", err);
    return null;
  }
}
