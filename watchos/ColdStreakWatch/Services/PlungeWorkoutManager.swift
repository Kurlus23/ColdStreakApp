import Foundation
import HealthKit
import Observation

/// Wraps HKWorkoutSession + HKLiveWorkoutBuilder to:
/// - Register the plunge as a real Apple Watch workout (counts toward rings)
/// - Stream live heart-rate samples into the PlungeSession
/// - Enable Always-On display automatically (a property of active workout sessions)
///
/// `diagnostic` is observable so PlungeView can render the live state and
/// surface "why HR isn't streaming" in plain English. This is the only way
/// to debug HR issues remotely — Apple deliberately hides whether READ
/// permission was granted, so we infer it from "did any sample arrive in N
/// seconds of an active workout".
@MainActor
@Observable
final class PlungeWorkoutManager: NSObject {
    static let shared = PlungeWorkoutManager()

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private weak var plungeSession: PlungeSession?

    // Diagnostics — written from the manager, read by PlungeView.
    var hkAvailable: Bool = HKHealthStore.isHealthDataAvailable()
    var authRequested: Bool = false
    var authError: String?
    var workoutState: String = "not started"
    var collectionCallbackCount: Int = 0
    var hrSampleCount: Int = 0
    var lastBPM: Int = 0
    var lastError: String?

    var diagnosticSummary: String {
        var parts: [String] = []
        if !hkAvailable { parts.append("HealthKit unavailable on this watch") }
        if !authRequested { parts.append("auth not requested") }
        if let e = authError { parts.append("auth err: \(e)") }
        parts.append("session: \(workoutState)")
        parts.append("cb: \(collectionCallbackCount)")
        parts.append("hr: \(hrSampleCount)")
        if let e = lastError { parts.append("err: \(e)") }
        return parts.joined(separator: " · ")
    }

    /// Did the workout session ever reach the .running state during this plunge?
    /// Tracked separately from `workoutState` because state changes to "ended"
    /// when the plunge stops, but we still need to remember whether HK actually
    /// got the workout going so SummaryView can give the right diagnosis.
    var didReachRunning: Bool = false

    /// Plain-English explanation surfaced when no HR has arrived.
    /// Used both during the plunge (PlungeView) and after (SummaryView).
    var likelyCause: String {
        if !hkAvailable {
            return "HealthKit isn't available on this watch."
        }
        if let e = authError {
            return "HealthKit authorization failed: \(e)"
        }
        if !didReachRunning {
            let detail = lastError.map { " (\($0))" } ?? ""
            return "Workout session never started\(detail). Try restarting the watch app."
        }
        if collectionCallbackCount == 0 {
            // Workout ran but no HK callbacks at all → almost certainly READ-permission denied.
            // Apple deliberately hides whether READ was granted, so this is our only signal.
            return "Heart Rate read access is OFF. On iPhone: Settings → Health → Data Access & Devices → ColdStreak → turn ON Heart Rate. Then restart the watch app."
        }
        // Callbacks firing but no HR specifically — wrist contact issue.
        return "Workout ran but the watch never got a heart rate reading. Tighten the band so the back of the watch sits flat against your skin."
    }

    // MARK: - Authorization

    func requestAuthorization() async throws {
        authRequested = true
        authError = nil
        guard hkAvailable else {
            authError = "HealthKit unavailable"
            throw NSError(domain: "PlungeWorkout", code: 1, userInfo: [NSLocalizedDescriptionKey: "HealthKit unavailable"])
        }
        let toRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.workoutType()
        ]
        let toShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]
        do {
            try await healthStore.requestAuthorization(toShare: toShare, read: toRead)
        } catch {
            authError = error.localizedDescription
            throw error
        }
    }

    // MARK: - Lifecycle

    func start(for plungeSession: PlungeSession) async throws {
        self.plungeSession = plungeSession
        // Reset per-plunge counters so PlungeView shows fresh numbers.
        collectionCallbackCount = 0
        hrSampleCount = 0
        lastBPM = 0
        lastError = nil
        didReachRunning = false
        workoutState = "starting"

        guard hkAvailable else {
            workoutState = "hk-unavailable"
            lastError = "HealthKit unavailable"
            throw NSError(domain: "PlungeWorkout", code: 1, userInfo: [NSLocalizedDescriptionKey: "HealthKit unavailable"])
        }

        let config = HKWorkoutConfiguration()
        config.activityType = .other      // closest match for cold plunge
        config.locationType = .outdoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            let dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

            // EXPLICITLY enable heart rate collection — don't rely on the activity-type
            // defaults, which can omit HR for `.other` workouts. We also enable active
            // energy so the workout still contributes to Move ring.
            if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) {
                dataSource.enableCollection(for: hrType, predicate: nil)
            }
            if let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
                dataSource.enableCollection(for: energyType, predicate: nil)
            }
            builder.dataSource = dataSource

            session.delegate = self
            builder.delegate = self

            self.session = session
            self.builder = builder

            let startDate = Date()
            session.startActivity(with: startDate)
            try await builder.beginCollection(at: startDate)

            plungeSession.startedAt = startDate
            plungeSession.phase = .plunging
            // Note: actual ".running" state is set by the workoutSession delegate
            // when HK confirms the session is live. Until then we mark "started".
            if workoutState == "starting" { workoutState = "started" }
        } catch {
            workoutState = "failed"
            lastError = error.localizedDescription
            throw error
        }
    }

    func stop() async {
        guard let session, let builder else { return }
        let endDate = Date()
        session.end()
        try? await builder.endCollection(at: endDate)
        try? await builder.finishWorkout()

        plungeSession?.endedAt = endDate
        plungeSession?.phase = .recovery
        plungeSession?.recoveryStartedAt = endDate

        self.session = nil
        self.builder = nil
        workoutState = "ended"
    }
}

// MARK: - HKWorkoutSessionDelegate

extension PlungeWorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {
        let label: String
        switch toState {
        case .notStarted: label = "not started"
        case .prepared:   label = "prepared"
        case .running:    label = "running"
        case .paused:     label = "paused"
        case .stopped:    label = "stopped"
        case .ended:      label = "ended"
        @unknown default: label = "unknown(\(toState.rawValue))"
        }
        Task { @MainActor in
            PlungeWorkoutManager.shared.workoutState = label
            if toState == .running {
                PlungeWorkoutManager.shared.didReachRunning = true
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didFailWithError error: Error) {
        print("[PlungeWorkout] Session failed: \(error)")
        Task { @MainActor in
            PlungeWorkoutManager.shared.lastError = error.localizedDescription
            PlungeWorkoutManager.shared.workoutState = "failed"
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension PlungeWorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        Task { @MainActor in
            PlungeWorkoutManager.shared.collectionCallbackCount += 1
        }
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate),
              collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let mostRecent = stats.mostRecentQuantity() else { return }

        let unit = HKUnit.count().unitDivided(by: .minute())
        let bpm = Int(mostRecent.doubleValue(for: unit).rounded())

        Task { @MainActor in
            PlungeWorkoutManager.shared.hrSampleCount += 1
            PlungeWorkoutManager.shared.lastBPM = bpm
            self.plungeSession?.recordHR(bpm)
            // While in recovery, also keep the recoveryHR live
            if self.plungeSession?.phase == .recovery {
                self.plungeSession?.recoveryHR = bpm
            }
        }
        // Push live BPM to the iPhone (best-effort, throttled to ~1 Hz inside).
        // This is what makes the iPhone's "Heart Rate Monitor" panel show
        // a live number during a plunge — without it, the iPhone only sees
        // HR after the plunge ends.
        PhoneSyncService.shared.sendLiveHR(bpm)
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) { }
}
