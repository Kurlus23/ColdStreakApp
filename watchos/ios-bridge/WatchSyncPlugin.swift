import Foundation
import Capacitor
import UIKit
import WatchConnectivity

/// Capacitor plugin that:
/// 1) Receives plunge payloads from the watch via WatchConnectivity
/// 2) Persists them to UserDefaults (so nothing is lost if the JS app isn't open)
/// 3) Notifies JS listeners ("watchPlungeReceived") when the app is foregrounded
/// 4) Exposes `getPendingPlunges()` and `clearPendingPlunges()` for JS to drain the queue
/// 5) Receives LIVE heart-rate samples from the watch during a plunge via
///    `sendMessage` and emits `watchLiveHR` to JS so the iPhone UI can show
///    real-time BPM (Apple Watch refuses to expose HR over BLE; this is the
///    supported path).
///
/// JS USAGE (in client/src):
///   import { registerPlugin } from '@capacitor/core';
///   const WatchSync = registerPlugin<{
///     getPendingPlunges: () => Promise<{ plunges: any[] }>;
///     clearPendingPlunges: (opts: { ids: string[] }) => Promise<void>;
///     addListener: (event: 'watchPlungeReceived', cb: (p: any) => void) => any;
///     addListener: (event: 'watchLiveHR', cb: (p: { bpm: number; ts: number }) => void) => any;
///   }>('WatchSync');
///
///   // On app start, drain pending and POST each to /api/plunges:
///   const { plunges } = await WatchSync.getPendingPlunges();
///   for (const p of plunges) { await apiRequest('POST', '/api/plunges', mapWatchPayload(p)); }
///   await WatchSync.clearPendingPlunges({ ids: plunges.map(p => p._id) });
///
///   WatchSync.addListener('watchPlungeReceived', async (p) => { /* same drain logic */ });
///   WatchSync.addListener('watchLiveHR', ({ bpm }) => setCurrentHR(bpm));
@objc(WatchSyncPlugin)
public class WatchSyncPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchSyncPlugin"
    public let jsName = "WatchSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPendingPlunges", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingPlunges", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openHealthSettings", returnType: CAPPluginReturnPromise),
    ]

    private let storeKey = "coldstreak.watch.received_plunges"

    public override func load() {
        if WCSession.isSupported() {
            let s = WCSession.default
            s.delegate = self
            s.activate()
        }
    }

    @objc func getPendingPlunges(_ call: CAPPluginCall) {
        let queue = UserDefaults.standard.array(forKey: storeKey) as? [[String: Any]] ?? []
        call.resolve(["plunges": queue])
    }

    @objc func clearPendingPlunges(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        var queue = UserDefaults.standard.array(forKey: storeKey) as? [[String: Any]] ?? []
        queue.removeAll { entry in
            guard let id = entry["_id"] as? String else { return false }
            return ids.contains(id)
        }
        UserDefaults.standard.set(queue, forKey: storeKey)
        call.resolve()
    }

    /// Opens the iPhone's per-app Settings page so the user can drill into
    /// Health → Data Access & Devices → ColdStreak to fix permissions.
    /// (iOS doesn't expose a deeper deep-link than the per-app settings root.)
    @objc func openHealthSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString),
                  UIApplication.shared.canOpenURL(url) else {
                call.reject("Cannot open Settings URL")
                return
            }
            UIApplication.shared.open(url, options: [:]) { ok in
                call.resolve(["opened": ok])
            }
        }
    }

    // MARK: - WCSessionDelegate

    public func session(_ session: WCSession,
                        activationDidCompleteWith activationState: WCSessionActivationState,
                        error: Error?) { }

    public func sessionDidBecomeInactive(_ session: WCSession) { }

    public func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        var enriched = userInfo
        enriched["_id"] = UUID().uuidString
        enriched["_receivedAt"] = Date().timeIntervalSince1970

        var queue = UserDefaults.standard.array(forKey: storeKey) as? [[String: Any]] ?? []
        queue.append(enriched)
        UserDefaults.standard.set(queue, forKey: storeKey)

        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("watchPlungeReceived", data: enriched)
        }
    }

    /// Live HR (and any other realtime payloads) from the watch.
    /// The watch sends `{ kind: "liveHR", bpm: Int, ts: TimeInterval }`.
    public func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        handleLivePayload(message)
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        handleLivePayload(message)
        replyHandler(["ok": true])
    }

    /// Application context fallback (used when sendMessage isn't deliverable —
    /// e.g. iPhone screen off or app not foregrounded).
    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        handleLivePayload(applicationContext)
    }

    private func handleLivePayload(_ payload: [String: Any]) {
        guard let kind = payload["kind"] as? String else { return }
        switch kind {
        case "liveHR":
            let bpm = (payload["bpm"] as? Int) ?? Int((payload["bpm"] as? Double) ?? 0)
            let ts = (payload["ts"] as? TimeInterval) ?? Date().timeIntervalSince1970
            guard bpm > 0 else { return }
            DispatchQueue.main.async { [weak self] in
                self?.notifyListeners("watchLiveHR", data: ["bpm": bpm, "ts": ts])
            }
        case "openHealthSettings":
            // Watch tapped "fix permissions". Open the iPhone's per-app
            // settings page where Health permissions live. From there the
            // user taps "Health" to reach the Heart Rate / HRV / Active
            // Energy toggles. (iOS doesn't expose a direct deep-link to
            // Health → Data Access → ColdStreak, so this is the closest
            // we can land.)
            DispatchQueue.main.async {
                guard let url = URL(string: UIApplication.openSettingsURLString),
                      UIApplication.shared.canOpenURL(url) else { return }
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        default:
            break
        }
    }
}
