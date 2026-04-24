import SwiftUI

struct RecoveryView: View {
    @Environment(PlungeSession.self) private var session
    @State private var recoveryElapsed: TimeInterval = 0
    @State private var timer: Timer?
    @State private var hrvPostFetched = false

    private let recoveryWindowSec: TimeInterval = 180   // 3 min then auto-advance to summary

    var body: some View {
        VStack(spacing: 6) {
            Text("Recovery")
                .font(.headline)
                .foregroundStyle(.cyan)

            Text(formatted(elapsed: recoveryElapsed))
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)

            HStack(spacing: 12) {
                Label {
                    Text(session.currentHR > 0 ? "\(session.currentHR)" : "—")
                        .monospacedDigit()
                } icon: {
                    Image(systemName: "heart.fill").foregroundStyle(.red)
                }
                .font(.title3)

                if let baseline = session.restingHRBaseline {
                    Text("→ \(Int(baseline))")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            Text(returnedHint)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Spacer(minLength: 4)

            Button("Done") { advanceToSummary() }
                .tint(.cyan)
                .font(.headline)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 4)
        .containerBackground(.black.gradient, for: .tabView)
        .onAppear { startTicking() }
        .onDisappear { timer?.invalidate(); timer = nil }
    }

    private var returnedHint: String {
        if let returned = session.recoveryReturnedAt, let started = session.recoveryStartedAt {
            let s = Int(returned.timeIntervalSince(started))
            return "HR returned in \(s)s"
        }
        return "Tracking heart-rate recovery…"
    }

    private func startTicking() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            Task { @MainActor in tick() }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    private func tick() {
        guard let start = session.recoveryStartedAt else { return }
        recoveryElapsed = Date().timeIntervalSince(start)

        // Detect "returned to baseline" — within 10% of resting HR
        if session.recoveryReturnedAt == nil,
           let baseline = session.restingHRBaseline,
           session.currentHR > 0,
           Double(session.currentHR) <= baseline * 1.10 {
            session.recoveryReturnedAt = Date()
        }

        // Auto-advance to summary after the recovery window
        if recoveryElapsed >= recoveryWindowSec {
            advanceToSummary()
        }
    }

    private func advanceToSummary() {
        guard !hrvPostFetched else { return }
        hrvPostFetched = true
        timer?.invalidate(); timer = nil

        Task {
            session.hrvPost = await HRVService.shared.recentAverageHRV(lookbackMinutes: 5)
            session.phase = .summary
        }
    }

    private func formatted(elapsed: TimeInterval) -> String {
        let total = Int(elapsed)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
