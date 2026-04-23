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
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]
        try await healthStore.requestAuthorization(toShare: toShare, read: toRead)
    }

    // MARK: - Lifecycle

    func start(for plungeSession: PlungeSession) async throws {
        self.plungeSession = plungeSession

        let config = HKWorkoutConfiguration()
        config.activityType = .other      // closest match for cold plunge
        config.locationType = .outdoor

        let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
        let builder = session.associatedWorkoutBuilder()
        builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

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
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) { }
}
