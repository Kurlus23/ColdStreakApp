import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Droplets, Power, Radio, Thermometer, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";

const FLOW_CONTROLLER_SERVICE = "8d6f0001-7f1a-4c9b-9a12-1f35c5d40001";
const FLOW_DEVICE_ID_CHARACTERISTIC = "8d6f0002-7f1a-4c9b-9a12-1f35c5d40001";
const FLOW_PAIRING_KEY_CHARACTERISTIC = "8d6f0003-7f1a-4c9b-9a12-1f35c5d40001";
const FLOW_WIFI_SSID_CHARACTERISTIC = "8d6f0004-7f1a-4c9b-9a12-1f35c5d40001";
const FLOW_WIFI_PASSWORD_CHARACTERISTIC = "8d6f0005-7f1a-4c9b-9a12-1f35c5d40001";
const FLOW_PROVISION_CHARACTERISTIC = "8d6f0006-7f1a-4c9b-9a12-1f35c5d40001";

export interface FlowDeviceStatus {
  id: number;
  deviceId: string;
  name: string;
  firmwareVersion: string | null;
  normalFlowLpm: number | null;
  warningThresholdPct: number;
  flowLpm: number | null;
  waterTempC: number | null;
  relayState: "off" | "on" | "tripped";
  safetyState: string;
  latestFault: string | null;
  lastSeenAt: string | null;
  isStale: boolean;
}

function safetyLabel(device: FlowDeviceStatus) {
  if (device.isStale) return "Controller offline";
  const labels: Record<string, string> = {
    boot_safe: "Boot-safe — outputs off",
    normal: "Flow normal",
    warning: "Low-flow warning",
    low_flow_trip: "Low-flow shutdown",
    sensor_fault: "Sensor fault — outputs off",
    watchdog_trip: "Watchdog shutdown",
    manual_off: "Outputs manually off",
  };
  return labels[device.safetyState] || device.safetyState.replaceAll("_", " ");
}

function faultLabel(code: string | null) {
  if (!code) return null;
  const labels: Record<string, string> = {
    low_flow: "Flow remained below 70% of normal",
    sensor_stale: "The controller stopped receiving sensor readings",
    sensor_invalid: "The flow sensor returned an invalid reading",
    watchdog_reset: "The controller watchdog reset the system",
    boot_safe: "The controller restarted with outputs safely off",
  };
  return labels[code] || code.replaceAll("_", " ");
}

export function FlowDeviceCard({ compact = false, useCelsius = false }: { compact?: boolean; useCelsius?: boolean }) {
  const [devices, setDevices] = useState<FlowDeviceStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [pairingKey, setPairingKey] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [pairing, setPairing] = useState(false);
  const [bluetoothPairing, setBluetoothPairing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/flow-devices/me");
      setDevices(await response.json());
      setError("");
    } catch (err) {
      if (!compact) setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Could not load controller");
    } finally {
      setLoaded(true);
    }
  }, [compact]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const device = devices[0];
  if (compact && (!loaded || !device)) return null;

  const pair = async () => {
    setPairing(true);
    setError("");
    try {
      await apiRequest("POST", "/api/flow-devices/claim", { deviceId: deviceId.trim(), pairingKey: pairingKey.trim() });
      setDeviceId("");
      setPairingKey("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Pairing failed");
    } finally {
      setPairing(false);
    }
  };

  const pairOverBluetooth = async () => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("BluetoothLe")) {
      setError("Bluetooth pairing is available in the ColdStreak mobile app. You can also enter the serial-console values below.");
      return;
    }
    setBluetoothPairing(true);
    setError("");
    if (!wifiSsid.trim() || wifiPassword.length < 8) {
      setError("Enter the Wi-Fi name and password this controller should use.");
      setBluetoothPairing(false);
      return;
    }
    let foundDeviceId = "";
    try {
      await BleClient.initialize();
      await BleClient.requestLEScan({ services: [FLOW_CONTROLLER_SERVICE], allowDuplicates: false }, async (result) => {
        if (foundDeviceId || !result.device.name?.toLowerCase().includes("coldstreak")) return;
        foundDeviceId = result.device.deviceId;
        await BleClient.stopLEScan().catch(() => {});
        try {
          await BleClient.connect(foundDeviceId);
          const idBytes = await BleClient.read(foundDeviceId, FLOW_CONTROLLER_SERVICE, FLOW_DEVICE_ID_CHARACTERISTIC);
          const keyBytes = await BleClient.read(foundDeviceId, FLOW_CONTROLLER_SERVICE, FLOW_PAIRING_KEY_CHARACTERISTIC);
          const discoveredId = new TextDecoder().decode(idBytes.buffer).replace(/\0/g, "").trim();
          const discoveredKey = new TextDecoder().decode(keyBytes.buffer).replace(/\0/g, "").trim();
          const asDataView = (value: string) => {
            const bytes = new TextEncoder().encode(value);
            return new DataView(bytes.buffer);
          };
          // Credentials travel only over the local BLE connection to the ESP32.
          await BleClient.write(foundDeviceId, FLOW_CONTROLLER_SERVICE, FLOW_WIFI_SSID_CHARACTERISTIC, asDataView(wifiSsid.trim()));
          await BleClient.write(foundDeviceId, FLOW_CONTROLLER_SERVICE, FLOW_WIFI_PASSWORD_CHARACTERISTIC, asDataView(wifiPassword));
          await apiRequest("POST", "/api/flow-devices/claim", { deviceId: discoveredId, pairingKey: discoveredKey });
          await BleClient.write(foundDeviceId, FLOW_CONTROLLER_SERVICE, FLOW_PROVISION_CHARACTERISTIC, asDataView("connect"));
          await BleClient.disconnect(foundDeviceId).catch(() => {});
          setWifiPassword("");
          setError("");
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Bluetooth pairing failed");
        } finally {
          setBluetoothPairing(false);
        }
      });
      window.setTimeout(async () => {
        await BleClient.stopLEScan().catch(() => {});
        if (!foundDeviceId) {
          setError("No ColdStreak controller found. Keep it powered nearby, then try again.");
          setBluetoothPairing(false);
        }
      }, 15_000);
    } catch (err) {
      await BleClient.stopLEScan().catch(() => {});
      setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Bluetooth scan failed");
      setBluetoothPairing(false);
    }
  };

  const remove = async () => {
    if (!device || !window.confirm("Remove this controller from your account? Its local safety shutdown will continue to work.")) return;
    try {
      await apiRequest("DELETE", `/api/flow-devices/${device.id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "Could not remove controller");
    }
  };

  if (!device) {
    return compact ? null : (
      <section className="rounded-2xl border border-cyan-700/40 bg-cyan-950/20 p-4" data-testid="flow-device-pairing">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-cyan-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Flow & temperature controller</h3>
            <p className="text-[11px] text-blue-400">Pair your ESP32 prototype using the ID and key shown in its serial console.</p>
          </div>
        </div>
        <div className="space-y-2">
          <input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="Wi-Fi network name"
            autoComplete="off"
            className="w-full rounded-xl border border-blue-700/50 bg-blue-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-600 focus:border-cyan-500"
            data-testid="input-flow-wifi-ssid" />
          <input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="Wi-Fi password" type="password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-blue-700/50 bg-blue-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-600 focus:border-cyan-500"
            data-testid="input-flow-wifi-password" />
          <p className="text-[10px] text-blue-500">Sent directly to the nearby controller over Bluetooth—not stored by ColdStreak.</p>
          <button onClick={pairOverBluetooth} disabled={bluetoothPairing || pairing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/20 py-2.5 text-xs font-bold text-cyan-200 disabled:opacity-40"
            data-testid="button-pair-flow-bluetooth">
            <Radio className="h-3.5 w-3.5" /> {bluetoothPairing ? "Looking for controller…" : "Find nearby controller over Bluetooth"}
          </button>
          <div className="flex items-center gap-2 py-1 text-[10px] uppercase tracking-wider text-blue-600"><span className="h-px flex-1 bg-blue-800/50" /> or use serial console <span className="h-px flex-1 bg-blue-800/50" /></div>
          <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Device ID"
            className="w-full rounded-xl border border-blue-700/50 bg-blue-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-600 focus:border-cyan-500"
            data-testid="input-flow-device-id" />
          <input value={pairingKey} onChange={(e) => setPairingKey(e.target.value)} placeholder="Pairing key" type="password"
            className="w-full rounded-xl border border-blue-700/50 bg-blue-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-blue-600 focus:border-cyan-500"
            data-testid="input-flow-pairing-key" />
          <button onClick={pair} disabled={pairing || deviceId.trim().length < 4 || pairingKey.trim().length < 20}
            className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/20 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40"
            data-testid="button-pair-flow-device">
            {pairing ? "Pairing…" : "Pair controller"}
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
        <p className="mt-3 rounded-xl border border-blue-700/30 bg-blue-950/50 p-2 text-[10px] leading-relaxed text-blue-300">
          Install recommendation: clean the strainer and replace or verify filters before teaching the controller your normal flow. A dirty restriction can make the learned baseline unsafe.
        </p>
        <p className="mt-3 text-[10px] leading-relaxed text-blue-500">The ESP32—not the app or cloud—must shut down the pump and chiller when flow is unsafe.</p>
      </section>
    );
  }

  const warning = device.isStale || ["warning", "low_flow_trip", "sensor_fault", "watchdog_trip"].includes(device.safetyState);
  const temp = device.waterTempC == null ? "—" : useCelsius
    ? `${device.waterTempC.toFixed(1)}°C`
    : `${(device.waterTempC * 9 / 5 + 32).toFixed(1)}°F`;
  const flowGpm = device.flowLpm == null ? null : device.flowLpm * 0.264172;

  return (
    <section className={`rounded-2xl border ${warning ? "border-amber-400/50 bg-amber-950/25" : "border-cyan-700/40 bg-cyan-950/20"} ${compact ? "mb-3 p-3" : "p-4"}`} data-testid="flow-device-status">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {warning ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{device.name}</p>
            <p className={`text-[10px] font-semibold ${warning ? "text-amber-300" : "text-emerald-300"}`}>{safetyLabel(device)}</p>
          </div>
        </div>
        {!compact && <button onClick={remove} aria-label="Remove controller" className="p-1 text-blue-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
      <div className={`mt-3 grid grid-cols-3 gap-2 ${compact ? "text-center" : ""}`}>
        <div className="rounded-xl bg-blue-950/60 p-2">
          <Droplets className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-400" />
          <p className="text-center text-sm font-bold text-white">{flowGpm == null ? "—" : flowGpm.toFixed(2)}</p>
          <p className="text-center text-[9px] text-blue-500">GPM</p>
        </div>
        <div className="rounded-xl bg-blue-950/60 p-2">
          <Thermometer className="mx-auto mb-1 h-3.5 w-3.5 text-cyan-400" />
          <p className="text-center text-sm font-bold text-white">{temp}</p>
          <p className="text-center text-[9px] text-blue-500">WATER</p>
        </div>
        <div className="rounded-xl bg-blue-950/60 p-2">
          <Power className={`mx-auto mb-1 h-3.5 w-3.5 ${device.relayState === "on" ? "text-emerald-300" : "text-red-300"}`} />
          <p className="text-center text-sm font-bold uppercase text-white">{device.relayState}</p>
          <p className="text-center text-[9px] text-blue-500">PUMP + CHILLER</p>
        </div>
      </div>
      {!compact && device.normalFlowLpm != null && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400">
          <Activity className="h-3 w-3" /> Normal {device.normalFlowLpm.toFixed(1)} L/min · warning below {(device.normalFlowLpm * 0.7).toFixed(1)} L/min
        </div>
      )}
      {(device.latestFault || device.isStale) && (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-200">
          {device.isStale ? "Telemetry is stale. Local protection continues without Wi-Fi or the app." : faultLabel(device.latestFault)}
        </p>
      )}
      {!compact && error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </section>
  );
}