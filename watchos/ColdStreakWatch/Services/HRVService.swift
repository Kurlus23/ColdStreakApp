import Foundation
import HealthKit

/// Pulls passive HRV (SDNN) and resting HR samples from HealthKit.
/// Used both before the plunge (baseline) and ~2 min after recovery starts (post).
@MainActor
final class HRVService {
    static let shared = HRVService()
    private let healthStore = HKHealthStore()

    /// Returns the average HRV (SDNN, in milliseconds) from samples in the last `lookbackMinutes`.
    /// Returns nil if no samples were found.
    func recentAverageHRV(lookbackMinutes: Int = 5) async -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) else { return nil }
        let end = Date()
        let start = end.addingTimeInterval(-Double(lookbackMinutes) * 60)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let unit = HKUnit.secondUnit(with: .milli)

        return await withCheckedContinuation { (continuation: CheckedContinuation<Double?, Never>) in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, stats, _ in
                let value = stats?.averageQuantity()?.doubleValue(for: unit)
                continuation.resume(returning: value)
            }
            healthStore.execute(query)
        }
    }

    /// Most recent resting heart rate (single sample) from HealthKit, in BPM. Nil if not available.
    func mostRecentRestingHR() async -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: .restingHeartRate) else { return nil }
        let unit = HKUnit.count().unitDivided(by: .minute())
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        return await withCheckedContinuation { (continuation: CheckedContinuation<Double?, Never>) in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, _ in
                let bpm = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                continuation.resume(returning: bpm)
            }
            healthStore.execute(query)
        }
    }
}
