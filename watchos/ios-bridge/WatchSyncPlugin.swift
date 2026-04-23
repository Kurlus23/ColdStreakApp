import Foundation
import Capacitor
import WatchConnectivity

/// Capacitor plugin that:
/// 1) Receives plunge payloads from the watch via WatchConnectivity
/// 2) Persists them to UserDefaults (so nothing is lost if the JS app isn't open)
/// 3) Notifies JS listeners ("watchPlungeReceived") when the app is foregrounded
/// 4) Exposes `getPendingPlunges()` and `clearPendingPlunges()` for JS to drain the queue
///
/// JS USAGE (in client/src):
///   import { registerPlugin } from '@capacitor/core';
///   const WatchSync = registerPlugin<{
///     getPendingPlunges: () => Promise<{ plunges: any[] }>;
///     clearPendingPlunges: (opts: { ids: string[] }) => Promise<void>;
///     addListener: (event: 'watchPlungeReceived', cb: (p: any) => void) => any;
///   }>('WatchSync');
///
///   // On app start, drain pending and POST each to /api/plunges:
///   const { plunges } = await WatchSync.getPendingPlunges();
///   for (const p of plunges) { await apiRequest('POST', '/api/plunges', mapWatchPayload(p)); }
///   await WatchSync.clearPendingPlunges({ ids: plunges.map(p => p._id) });
///
///   WatchSync.addListener('watchPlungeReceived', async (p) => { /* same drain logic */ });
@objc(WatchSyncPlugin)
public class WatchSyncPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchSyncPlugin"
    public let jsName = "WatchSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPendingPlunges", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingPlunges", returnType: CAPPluginReturnPromise),
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
}
