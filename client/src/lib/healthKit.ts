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
  getBodyMass: () => Promise<{ lbs: number | null; recordedAt: number | null }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

const AUTH_REQUESTED_KEY = "coldstreak-healthkit-asked";

export function isHealthKitPossible(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

/**
 * True only if the native HealthKitPlugin is actually compiled into THIS build.
 * Older TestFlight builds (or builds where the plugin .swift wasn't added to the
 * iOS App target in Xcode) will return false here — which is the usual reason
 * "Apple Health won't connect": the bridge simply isn't present to talk to.
 */
export function isHealthKitPluginAvailable(): boolean {
  if (!isHealthKitPossible()) return false;
  try {
    return Capacitor.isPluginAvailable("HealthKit");
  } catch {
    return false;
  }
}

export type HealthKitConnectResult =
  | "connected"    // auth dialog completed (read access can't be confirmed by Apple)
  | "unavailable"  // device has no Health data (e.g. iPad)
  | "no-plugin"    // this build doesn't include the native HealthKit plugin
  | "not-ios"      // not running inside the native iOS app
  | "error";       // plugin present but the call failed unexpectedly

/**
 * Connect flow for the "Connect Apple Health" button. Unlike ensureHealthKitAuth
 * (silent best-effort), this returns a precise reason so the UI can tell the user
 * what's actually wrong instead of always blaming permissions.
 */
export async function connectHealthKit(): Promise<HealthKitConnectResult> {
  if (!isHealthKitPossible()) return "not-ios";
  if (!isHealthKitPluginAvailable()) return "no-plugin";
  try {
    const { available } = await HealthKit.isAvailable();
    if (!available) return "unavailable";
    await HealthKit.requestAuth();
    // Apple intentionally never reveals whether READ access was granted, so a
    // completed dialog is the best signal we get. Real verification happens when
    // a query later returns data.
    localStorage.setItem(AUTH_REQUESTED_KEY, "1");
    return "connected";
  } catch (err) {
    // Plugin IS present (checked above) but the call threw — capability/Info.plist
    // misconfig or a transient bridge error, NOT a missing-plugin build issue.
    console.warn("[healthKit] connect failed:", err);
    return "error";
  }
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

export async function fetchLatestBodyWeightLbs(): Promise<{ lbs: number; recordedAt: number } | null> {
  if (!isHealthKitPossible()) return null;
  try {
    const { lbs, recordedAt } = await HealthKit.getBodyMass();
    if (lbs == null || recordedAt == null) return null;
    return { lbs, recordedAt };
  } catch (err) {
    console.warn("[healthKit] getBodyMass failed:", err);
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
