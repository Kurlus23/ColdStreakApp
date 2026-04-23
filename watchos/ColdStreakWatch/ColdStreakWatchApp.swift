import SwiftUI

@main
struct ColdStreakWatchApp: App {
    @State private var session = PlungeSession()

    init() {
        PhoneSyncService.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}

struct RootView: View {
    @Environment(PlungeSession.self) private var session

    var body: some View {
        switch session.phase {
        case .ready:
            ReadyView()
        case .plunging:
            PlungeView()
        case .recovery:
            RecoveryView()
        case .summary:
            SummaryView()
        }
    }
}
