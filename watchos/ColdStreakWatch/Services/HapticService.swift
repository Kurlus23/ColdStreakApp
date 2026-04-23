import WatchKit
import Foundation

/// Schedules milestone haptics during a plunge so the user doesn't have to look at the watch.
/// Buzzes at 30s, 1m, 2m, 3m, 4m, 5m, then every minute afterwards.
@MainActor
final class HapticService {
    static let shared = HapticService()

    private var timer: Timer?
    private var startDate: Date?
    private var firedMilestones: Set<Int> = []

    private let milestonesSec: [Int] = [30, 60, 120, 180, 240, 300]

    func startMilestones(from start: Date) {
        stop()
        self.startDate = start
        self.firedMilestones = []

        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        startDate = nil
        firedMilestones = []
    }

    /// Light "milestone hit" haptic.
    func milestone() {
        WKInterfaceDevice.current().play(.notification)
    }

    /// Final celebratory haptic when stopping.
    func finished() {
        WKInterfaceDevice.current().play(.success)
    }

    /// Soft pre-plunge ready cue.
    func ready() {
        WKInterfaceDevice.current().play(.start)
    }

    private func tick() {
        guard let startDate else { return }
        let elapsed = Int(Date().timeIntervalSince(startDate))

        // Fixed list first
        for m in milestonesSec where elapsed >= m && !firedMilestones.contains(m) {
            firedMilestones.insert(m)
            milestone()
        }
        // Then every additional minute past the last fixed milestone
        if elapsed > 300, elapsed % 60 == 0, !firedMilestones.contains(elapsed) {
            firedMilestones.insert(elapsed)
            milestone()
        }
    }
}
