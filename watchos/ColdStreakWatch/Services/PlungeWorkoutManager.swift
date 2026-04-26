import Foundation
import HealthKit

/// Wraps HKWorkoutSession + HKLiveWorkoutBuilder to:
/// - Register the plunge as a real Apple Watch workout (counts toward rings)
/// - Stream live heart-rate samples into the PlungeSession
/// - Enable Always-On display automatically (a property of active workout sessions)
@MainActor
final class PlungeWorkoutManager: NSObject {
    static let shared = PlungeWorkoutManager()

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private weak var plungeSession: PlungeSession?

    // MARK: - Authorization

    /// Requests every HealthKit type the watch app needs in a single dialog.
    /// IMPORTANT: ALL of these need to be present in the same call. If any
    /// type is missing from the initial request, watchOS won't show it in
    /// the permission dialog and the user has to manually enable it later in
    /// iPhone Settings → Health → ColdStreak. Real-world finding (Apr 2026):
    /// Active Energy being denied prevented Heart Rate from streaming during
    /// `.other` workouts even though HR was granted — both READ and SHARE
    /// for activeEnergyBurned must be granted for HR collection to fire.
    func requestAuthorization() async throws {
        let toRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.workoutType()
        ]
        let toShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .heartRate)!
        ]
        try await healthStore.requestAuthorization(toShare: toShare, read: toRead)
    }

    /// Indirect signal that the user denied (or never granted) the HealthKit
    /// permission dialog. Apple deliberately hides READ-permission status to
    /// prevent fingerprinting, but SHARE/write status IS visible. If the user
    /// denied any of our SHARE types in the dialog, they almost certainly
    /// denied the READ ones too — this is the only signal we have to detect
    /// the "Active Energy off → no HR" failure mode.
    ///
    /// Returns `true` when at least one of our SHARE-side permissions is
    /// known to be denied. Returns `false` if all are granted OR if we can't
    /// tell yet (e.g. dialog never shown).
    var permissionsLikelyMissing: Bool {
        guard hkAvailable else { return false } // simulator etc — don't nag
        let typesToCheck: [HKSampleType] = [
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.workoutType()
        ]
        return typesToCheck.contains { healthStore.authorizationStatus(for: $0) == .sharingDenied }
    }

    private var hkAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    // MARK: - Lifecycle

    func start(for plungeSession: PlungeSession) async throws {
        self.plungeSession = plungeSession

        let config = HKWorkoutConfiguration()
        config.activityType = .other      // closest match for cold plunge
        config.locationType = .outdoor

        let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
        let builder = session.associatedWorkoutBuilder()
        let dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

        // EXPLICITLY enable heart rate collection — don't rely on the activity-type
        // defaults, which can omit HR for `.other` workouts. We also enable active
        // energy so the workout still contributes to Move ring (and, empirically,
        // so HR collection fires reliably for `.other` workouts).
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
    }
}

// MARK: - HKWorkoutSessionDelegate

extension PlungeWorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) { }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didFailWithError error: Error) {
        print("[PlungeWorkout] Session failed: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension PlungeWorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate),
              collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let mostRecent = stats.mostRecentQuantity() else { return }

        let unit = HKUnit.count().unitDivided(by: .minute())
        let bpm = Int(mostRecent.doubleValue(for: unit).rounded())

        Task { @MainActor in
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
