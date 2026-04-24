import SwiftUI

struct SummaryView: View {
    @Environment(PlungeSession.self) private var session
    @State private var saved = false

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
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Plunge Summary")
                    .font(.headline)
                    .foregroundStyle(.cyan)

                row("Duration", value: durationStr)
                row("Water", value: "\(Int(session.waterTempF))°F")
                row("Max HR", value: session.maxHR > 0 ? "\(session.maxHR) bpm" : "—")
                row("Min HR", value: session.minHR > 0 ? "\(session.minHR) bpm" : "—")
                if let recovery = recoveryStr {
                    row("HR recovered in", value: recovery)
                }
                if let pre = session.hrvBaseline {
                    row("HRV before", value: String(format: "%.0f ms", pre))
                }
                if let post = session.hrvPost {
                    row("HRV after", value: String(format: "%.0f ms", post))
                }
                if let delta = session.hrvDelta {
                    let sign = delta >= 0 ? "+" : ""
                    row("HRV change", value: "\(sign)\(String(format: "%.0f", delta)) ms",
                        accent: delta >= 0 ? .green : .orange)
                }

                Spacer(minLength: 8)

                Button(action: save) {
                    Text(saved ? "Saved ✓" : "Save & Sync")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .tint(saved ? .green : .cyan)
                .disabled(saved)

                Button("Discard", role: .destructive) {
                    session.reset()
                }
                .font(.subheadline)
            }
            .padding(.horizontal, 4)
        }
    }

    private var durationStr: String {
        let m = session.durationSec / 60
        let s = session.durationSec % 60
        return "\(m)m \(s)s"
    }

    private var recoveryStr: String? {
        guard let returned = session.recoveryReturnedAt,
              let started = session.recoveryStartedAt else { return nil }
        return "\(Int(returned.timeIntervalSince(started)))s"
    }

    private func row(_ label: String, value: String, accent: Color = .white) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.callout.weight(.semibold))
                .foregroundStyle(accent)
                .monospacedDigit()
        }
    }

    private func save() {
        let payload: [String: Any] = [
            "source": "watch",
            "startedAt": (session.startedAt ?? Date()).timeIntervalSince1970,
            "endedAt": (session.endedAt ?? Date()).timeIntervalSince1970,
            "durationSec": session.durationSec,
            "waterTempF": session.waterTempF,
            "maxHR": session.maxHR,
            "minHR": session.minHR,
            "hrvBaselineMs": session.hrvBaseline as Any,
            "hrvPostMs": session.hrvPost as Any,
            "restingHRBaseline": session.restingHRBaseline as Any,
            "recoverySec": session.recoveryReturnedAt.flatMap { r in
                session.recoveryStartedAt.map { Int(r.timeIntervalSince($0)) }
            } as Any
        ]
        PhoneSyncService.shared.sendPlunge(payload)
        saved = true

        // Auto-reset after 2 seconds so the watch returns to Ready for the next plunge
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            session.reset()
        }
    }
}
