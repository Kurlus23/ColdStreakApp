import Foundation
import Observation

enum PlungePhase {
    case ready
    case plunging
    case recovery
    case summary
}

@Observable
final class PlungeSession {
    // Lifecycle
    var phase: PlungePhase = .ready

    // Pre-plunge config
    var waterTempF: Double = 38.0

    // Live data
    var startedAt: Date?
    var endedAt: Date?
    var elapsed: TimeInterval = 0
    var currentHR: Int = 0
    var maxHR: Int = 0
    var minHR: Int = 0
    var hrSamples: [Int] = []

    // Recovery
    var recoveryStartedAt: Date?
    var recoveryHR: Int = 0
    var recoveryReturnedAt: Date?       // when HR drops to within 10% of pre-plunge resting

    // HRV
    var hrvBaseline: Double?            // ms, pulled before start
    var hrvPost: Double?                // ms, pulled after recovery
    var restingHRBaseline: Double?      // bpm, pulled before start

    // Computed
    var durationSec: Int { Int(elapsed.rounded()) }

    var hrvDelta: Double? {
        guard let pre = hrvBaseline, let post = hrvPost else { return nil }
        return post - pre
    }

    func reset() {
        phase = .ready
        startedAt = nil
        endedAt = nil
        elapsed = 0
        currentHR = 0
        maxHR = 0
        minHR = 0
        hrSamples = []
        recoveryStartedAt = nil
        recoveryHR = 0
        recoveryReturnedAt = nil
        hrvBaseline = nil
        hrvPost = nil
        restingHRBaseline = nil
    }

    func recordHR(_ bpm: Int) {
        currentHR = bpm
        if bpm > 0 {
            hrSamples.append(bpm)
            maxHR = max(maxHR, bpm)
            minHR = (minHR == 0) ? bpm : min(minHR, bpm)
        }
    }
}
