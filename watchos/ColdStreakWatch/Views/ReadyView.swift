import SwiftUI

struct ReadyView: View {
    @Environment(PlungeSession.self) private var session
    @State private var isStarting = false
    @State private var crownTemp: Double = 38.0
    @State private var permissionRequested = false
    @State private var errorMessage: String?
    @State private var permissionsMissing = false
    @State private var permissionFixRequested = false
    @FocusState private var tempFocused: Bool

    var body: some View {
        content
            .containerBackground(.black.gradient, for: .tabView)
    }

    private var content: some View {
        VStack(spacing: 8) {
            Text("ColdStreak")
                .font(.headline)
                .foregroundStyle(.cyan)

            // One-time permission warning. Shown when at least one of our
            // SHARE-side HK permissions is .sharingDenied (the only signal
            // Apple gives us; READ status is hidden). Tapping it sends a
            // message to the iPhone to open the Health Settings page.
            if permissionsMissing {
                Button(action: requestPermissionFix) {
                    VStack(spacing: 2) {
                        Text(permissionFixRequested ? "Opening on your iPhone…" : "Heart rate may not record")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.orange)
                        Text("Please ensure Heart Rate, HRV, and Active Energy are enabled. Tap to verify permissions.")
                            .font(.system(size: 9))
                            .foregroundStyle(.orange.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineLimit(3)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                    .padding(.horizontal, 6)
                    .background(.orange.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }

            Text("\(Int(crownTemp))°F")
                .font(.system(size: 44, weight: .heavy, design: .rounded))
                .foregroundStyle(tempFocused ? .cyan : .white)
                .focusable(true)
                .focused($tempFocused)
                .digitalCrownRotation(
                    $crownTemp,
                    from: 28, through: 70, by: 1,
                    sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true
                )
                .digitalCrownAccessory(.visible)
                .onTapGesture { tempFocused = true }

            Text(tempFocused ? "Spin crown to adjust" : "Tap to adjust")
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
            // After the dialog resolves, check whether anything was denied.
            // Do this in a quick polling loop because Apple's authorization
            // status doesn't change synchronously after the user taps.
            for _ in 0..<5 {
                try? await Task.sleep(nanoseconds: 400_000_000)
                if PlungeWorkoutManager.shared.permissionsLikelyMissing {
                    permissionsMissing = true
                    break
                }
            }
        }
        .onChange(of: crownTemp) { _, newValue in
            session.waterTempF = newValue
        }
        .onAppear {
            crownTemp = session.waterTempF
            // Re-check permissions on every appearance. If the user fixed
            // them in iPhone Settings and came back, the banner clears.
            permissionsMissing = PlungeWorkoutManager.shared.permissionsLikelyMissing
            // Give the temp display crown focus on appear
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                tempFocused = true
            }
        }
    }

    /// Tap handler for the permission warning banner. Asks the iPhone to
    /// open Settings → Health → ColdStreak (the path users actually need to
    /// reach). watchOS apps cannot open the iPhone's Settings directly, so
    /// we send a WatchConnectivity message and the iPhone-side plugin
    /// handles the URL launch.
    private func requestPermissionFix() {
        permissionFixRequested = true
        PhoneSyncService.shared.requestOpenHealthSettings()
        // Reset the label after a few seconds so the user can tap again
        // if the iPhone wasn't reachable.
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            permissionFixRequested = false
            // Re-check too — they might have already toggled it on
            permissionsMissing = PlungeWorkoutManager.shared.permissionsLikelyMissing
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
            // 1) Wait for HealthKit authorization to RESOLVE (not just be requested).
            //    On first launch the system dialog might still be on screen here —
            //    we need to wait for the user to tap before starting the workout
            //    session, otherwise the workout-start race can lose HR streaming.
            do {
                try await PlungeWorkoutManager.shared.requestAuthorization()
            } catch {
                errorMessage = "Heart rate permission error: \(error.localizedDescription)"
            }

            // 2) Best-effort baselines (HRV, resting HR) — fine if these fail.
            async let hrv = HRVService.shared.recentAverageHRV(lookbackMinutes: 5)
            async let resting = HRVService.shared.mostRecentRestingHR()
            session.hrvBaseline = await hrv
            session.restingHRBaseline = await resting

            // 3) Start the real workout session. If this throws, surface the
            //    actual error so we know HR won't track — but still let her log
            //    the plunge in HR-less mode rather than getting stuck.
            do {
                try await PlungeWorkoutManager.shared.start(for: session)
            } catch {
                errorMessage = "Couldn't start heart rate tracking: \(error.localizedDescription)"
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
