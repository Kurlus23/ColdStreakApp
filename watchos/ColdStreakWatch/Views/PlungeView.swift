import SwiftUI

struct PlungeView: View {
    @Environment(PlungeSession.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @State private var elapsedTick: TimeInterval = 0
    @State private var timer: Timer?
    @State private var isStopping = false

    var body: some View {
        VStack(spacing: 6) {
            // BIG timer
            Text(formatted(elapsed: elapsedTick))
                .font(.system(size: 48, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            HStack(spacing: 12) {
                Label {
                    Text(session.currentHR > 0 ? "\(session.currentHR)" : "—")
                        .monospacedDigit()
                } icon: {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(.red)
                }
                .font(.title3.weight(.semibold))

                Text("\(Int(session.waterTempF))°F")
                    .font(.callout)
                    .foregroundStyle(.cyan)
            }

            Spacer(minLength: 4)

            Button(role: .destructive, action: stop) {
                Text(isStopping ? "Stopping…" : "Stop")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .disabled(isStopping)
        }
        .padding(.horizontal, 4)
        .containerBackground(.black.gradient, for: .window)
        .onAppear { startTicking() }
        .onDisappear { timer?.invalidate(); timer = nil }
        .onChange(of: scenePhase) { _, phase in
            // Always-on display: while inactive, dim non-essentials but keep timer.
            // (HKWorkoutSession keeps the screen on automatically; we just react to dim state.)
            _ = phase
        }
    }

    private func startTicking() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            Task { @MainActor in
                guard let start = session.startedAt else { return }
                let now = Date().timeIntervalSince(start)
                elapsedTick = now
                session.elapsed = now
            }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    private func stop() {
        isStopping = true
        Task {
            HapticService.shared.stop()
            HapticService.shared.finished()
            await PlungeWorkoutManager.shared.stop()
            timer?.invalidate(); timer = nil
            isStopping = false
        }
    }

    private func formatted(elapsed: TimeInterval) -> String {
        let total = Int(elapsed)
        let m = total / 60
        let s = total % 60
        return String(format: "%d:%02d", m, s)
    }
}
