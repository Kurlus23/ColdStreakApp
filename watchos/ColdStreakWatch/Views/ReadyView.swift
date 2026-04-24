import SwiftUI

struct ReadyView: View {
    @Environment(PlungeSession.self) private var session
    @State private var isStarting = false
    @State private var crownTemp: Double = 38.0
    @State private var permissionRequested = false
    @State private var errorMessage: String?
    @FocusState private var tempFocused: Bool

    var body: some View {
        ZStack {
            Image("ColdStreakIcon")
                .resizable()
                .scaledToFit()
                .opacity(0.08)
                .allowsHitTesting(false)
            content
        }
        .containerBackground(.black.gradient, for: .tabView)
    }

    private var content: some View {
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

            Text("Water temp")
                .font(.caption2)
                .foregroundStyle(.secondary)

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
            // HealthKit permission is best-effort. If denied or unavailable
            // (e.g. simulator), the app still works — HR just won't display.
            try? await PlungeWorkoutManager.shared.requestAuthorization()
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
            #if targetEnvironment(simulator)
            // Simulator: HKWorkoutSession hangs / can't actually run.
            // Skip it entirely so the UI flow is testable.
            session.startedAt = Date()
            session.phase = .plunging
            #else
            // Real hardware: try the real workout session, but never block forever.
            // If anything throws or stalls, fall back to UI-only mode.
            async let hrv = HRVService.shared.recentAverageHRV(lookbackMinutes: 5)
            async let resting = HRVService.shared.mostRecentRestingHR()
            session.hrvBaseline = await hrv
            session.restingHRBaseline = await resting

            let started = await withTimeout(seconds: 4) {
                try? await PlungeWorkoutManager.shared.start(for: session)
                return true
            }
            if started != true || session.startedAt == nil {
                session.startedAt = Date()
                session.phase = .plunging
            }
            #endif

            HapticService.shared.ready()
            if let s = session.startedAt {
                HapticService.shared.startMilestones(from: s)
            }
            isStarting = false
        }
    }
}

/// Returns the operation's result, or nil if `seconds` elapse first.
private func withTimeout<T: Sendable>(seconds: Double, _ op: @escaping @Sendable () async -> T) async -> T? {
    await withTaskGroup(of: T?.self) { group in
        group.addTask { await op() }
        group.addTask {
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            return nil
        }
        let first = await group.next() ?? nil
        group.cancelAll()
        return first
    }
}
