import Foundation
import WatchConnectivity

/// Sends completed plunge payloads from the watch back to the iOS app.
/// Uses `transferUserInfo` so the message is queued and delivered reliably even when the
/// iOS app is closed — the system wakes it in the background to receive.
///
/// Also pushes LIVE heart-rate samples to the iPhone during a plunge via
/// `sendMessage` (best-effort, fire-and-forget). The iPhone-side
/// `WatchSyncPlugin` listens for `kind: "liveHR"` messages and emits a
/// `watchLiveHR` event to the JS layer for live BPM display.
final class PhoneSyncService: NSObject, WCSessionDelegate {
    static let shared = PhoneSyncService()

    private override init() { super.init() }

    // Throttle live HR sends: HKLiveWorkoutBuilder fires several times per
    // second when HR is changing — the iPhone only needs ~1 Hz.
    private var lastLiveHRSentAt: Date = .distantPast

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

    /// Asks the iPhone app to open Settings → Health → Data Access &
    /// Devices → ColdStreak. The watch can't open the iPhone's Settings
    /// directly, so we send a WatchConnectivity message and the iPhone-side
    /// `WatchSyncPlugin` handles the URL launch. Best-effort: if the
    /// iPhone app isn't running, the message will be delivered next time it
    /// opens (via applicationContext fallback).
    func requestOpenHealthSettings() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { return }

        let payload: [String: Any] = [
            "kind": "openHealthSettings",
            "ts": Date().timeIntervalSince1970,
        ]

        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                try? s.updateApplicationContext(payload)
            })
        } else {
            try? s.updateApplicationContext(payload)
        }
    }

    /// Live HR push to the iPhone during a plunge. Best-effort:
    /// - sendMessage for instant delivery while iPhone is reachable
    /// - falls back to updateApplicationContext if not reachable so the
    ///   iPhone gets the latest value next time it opens
    /// Throttled to ~1 Hz to keep the radio cool and avoid spamming JS.
    func sendLiveHR(_ bpm: Int) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { return }

        let now = Date()
        if now.timeIntervalSince(lastLiveHRSentAt) < 1.0 { return }
        lastLiveHRSentAt = now

        let payload: [String: Any] = [
            "kind": "liveHR",
            "bpm": bpm,
            "ts": now.timeIntervalSince1970,
        ]

        if s.isReachable {
            s.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                // sendMessage failed — fall back to context so the iPhone
                // gets the latest value when it next syncs.
                try? s.updateApplicationContext(payload)
            })
        } else {
            try? s.updateApplicationContext(payload)
        }
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
