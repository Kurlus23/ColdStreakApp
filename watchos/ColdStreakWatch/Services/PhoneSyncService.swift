import Foundation
import WatchConnectivity

/// Sends completed plunge payloads from the watch back to the iOS app.
/// Uses `transferUserInfo` so the message is queued and delivered reliably even when the
/// iOS app is closed — the system wakes it in the background to receive.
final class PhoneSyncService: NSObject, WCSessionDelegate {
    static let shared = PhoneSyncService()

    private override init() { super.init() }

    func activate() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    func sendPlunge(_ payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else {
            // Session not yet ready — store locally and try again on activation.
            queueOffline(payload)
            return
        }
        s.transferUserInfo(payload)
    }

    // MARK: - Offline queue

    private let offlineKey = "coldstreak.pending_plunges"

    private func queueOffline(_ payload: [String: Any]) {
        var queue = UserDefaults.standard.array(forKey: offlineKey) as? [[String: Any]] ?? []
        queue.append(payload)
        UserDefaults.standard.set(queue, forKey: offlineKey)
    }

    private func flushOffline() {
        let queue = UserDefaults.standard.array(forKey: offlineKey) as? [[String: Any]] ?? []
        guard !queue.isEmpty, WCSession.default.activationState == .activated else { return }
        for payload in queue {
            WCSession.default.transferUserInfo(payload)
        }
        UserDefaults.standard.removeObject(forKey: offlineKey)
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        if activationState == .activated {
            flushOffline()
        }
    }
}
