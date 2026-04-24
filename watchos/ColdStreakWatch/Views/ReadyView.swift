import SwiftUI

struct ReadyView: View {
    @Environment(PlungeSession.self) private var session
    @State private var isStarting = false
    @State private var crownTemp: Double = 38.0
    @State private var permissionRequested = false
    @State private var errorMessage: String?
    @FocusState private var tempFocused: Bool

    var body: some View {
        VStack(spacing: 8) {
            Text("ColdStreak")
                .font(.headline)
                .foregroundStyle(.cyan)

            Text("\(Int(crownTemp))°F")
                .font(.system(size: 44, weight: .heavy, design: .rounded))
                .foregroundStyle(tempFocused ? .cyan : .white)
                .focusable()
                .focused($tempFocused)
                .digitalCrownRotation(
                    $crownTemp,
                    from: 28, through: 70, by: 1,
                    sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true
                )

            HStack(spacing: 4) {
                Button("−") { crownTemp = max(28, crownTemp - 1) }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                Text("Water temp")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button("+") { crownTemp = min(70, crownTemp + 1) }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
            }

            Spacer(minLength: 4)

            Button(action: start) {
                Text(isStarting ? "Starting…" : "Start Plunge")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .tint(.cyan)
            .disabled(isStarting)

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption2)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 4)
        .task {
            guard !permissionRequested else { return }
            permissionRequested = true
            do {
                try await PlungeWorkoutManager.shared.requestAuthorization()
            } catch {
                errorMessage = "Health permission needed"
            }
        }
        .onChange(of: crownTemp) { _, newValue in
            session.waterTempF = newValue
        }
        .onAppear {
            crownTemp = session.waterTempF
            // Give the temp display crown focus on appear
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                tempFocused = true
            }
        }
    }

    private func start() {
        isStarting = true
        errorMessage = nil
        Task {
            // Pull baseline HRV + resting HR passively (no UI wait)
            async let hrv = HRVService.shared.recentAverageHRV(lookbackMinutes: 5)
            async let resting = HRVService.shared.mostRecentRestingHR()
            session.hrvBaseline = await hrv
            session.restingHRBaseline = await resting

            // Try to start a real HKWorkoutSession.
            // On the simulator HKWorkoutSession often can't actually begin —
            // in that case we fall back to a UI-only timer so testing still works.
            do {
                try await PlungeWorkoutManager.shared.start(for: session)
            } catch {
                print("[ColdStreakWatch] Workout session start failed (likely simulator): \(error)")
                session.startedAt = Date()
                session.phase = .plunging
            }

            HapticService.shared.ready()
            if let started = session.startedAt {
                HapticService.shared.startMilestones(from: started)
            }
            isStarting = false
        }
    }
}
