import Foundation
import Capacitor
import StoreKit
import MusicKit

/// Native iOS MusicKit bridge.
///
/// MusicKit JS is unreliable inside WKWebView (Capacitor) because Apple's auth
/// popup loses its `window.opener` reference and the auth token never makes it
/// back to JS. We replace it with the iOS-native StoreKit + MusicKit APIs.
///
/// Methods exposed to JS:
///   - requestAuthorization() -> { status, authorized }
///   - getUserToken({ developerToken }) -> { userToken }
///   - playPlaylist({ url }) -> { played }
///
/// Requires the "MusicKit" capability on the App ID and an
/// `NSAppleMusicUsageDescription` entry in Info.plist.
@objc(ColdstreakMusickitPlugin)
public class ColdstreakMusickitPlugin: CAPPlugin {

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        SKCloudServiceController.requestAuthorization { status in
            let statusString: String
            switch status {
            case .authorized:    statusString = "authorized"
            case .denied:        statusString = "denied"
            case .restricted:    statusString = "restricted"
            case .notDetermined: statusString = "notDetermined"
            @unknown default:    statusString = "unknown"
            }
            call.resolve([
                "status": statusString,
                "authorized": status == .authorized
            ])
        }
    }

    @objc func getUserToken(_ call: CAPPluginCall) {
        guard let devToken = call.getString("developerToken"), !devToken.isEmpty else {
            call.reject("developerToken is required")
            return
        }

        let authStatus = SKCloudServiceController.authorizationStatus()
        guard authStatus == .authorized else {
            call.reject("Apple Music access not authorized (status: \(authStatus.rawValue))")
            return
        }

        let controller = SKCloudServiceController()
        controller.requestUserToken(forDeveloperToken: devToken) { token, error in
            if let error = error {
                call.reject("Apple user-token request failed: \(error.localizedDescription)", nil, error)
                return
            }
            guard let token = token, !token.isEmpty else {
                call.reject("Apple returned an empty music-user-token")
                return
            }
            call.resolve(["userToken": token])
        }
    }

    /// Resolves an Apple Music URL to a playlist and starts playback via the
    /// system `ApplicationMusicPlayer` (which surfaces in Control Center and
    /// keeps playing when the app backgrounds).
    ///
    /// Accepted URL shapes:
    ///   • Catalog:  https://music.apple.com/<country>/playlist/<name>/<id>
    ///                where <id> starts with "pl."
    ///   • Library:  https://music.apple.com/library/playlist/<id>
    ///                where <id> starts with "p." (requires user auth + iOS 16+)
    @objc func playPlaylist(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString) else {
            call.reject("url is required")
            return
        }

        let path = url.path
        let segments = path.split(separator: "/").map(String.init)
        guard let rawId = segments.last, !rawId.isEmpty else {
            call.reject("Could not extract playlist ID from URL")
            return
        }
        let isLibrary = path.contains("/library/playlist/") || rawId.hasPrefix("p.")

        // Authorization is required for both catalog playback (subscription
        // verification) and library playback. Request it here if missing so
        // a manually-pasted URL still works without going through Connect.
        let proceed = { [weak self] in
            guard let _ = self else { return }
            if #available(iOS 15.0, *) {
                if isLibrary {
                    if #available(iOS 16.0, *) {
                        Self.playLibraryPlaylist(id: rawId, call: call)
                    } else {
                        call.reject("Library playlists require iOS 16 or later. Open the playlist in Apple Music to play it.")
                    }
                } else {
                    Self.playCatalogPlaylist(id: rawId, call: call)
                }
            } else {
                call.reject("Apple Music playback requires iOS 15 or later")
            }
        }

        let status = SKCloudServiceController.authorizationStatus()
        if status == .authorized {
            proceed()
        } else if status == .notDetermined {
            SKCloudServiceController.requestAuthorization { newStatus in
                if newStatus == .authorized {
                    proceed()
                } else {
                    call.reject("Apple Music permission was not granted")
                }
            }
        } else {
            call.reject("Apple Music access denied — enable it in iOS Settings")
        }
    }

    @available(iOS 15.0, *)
    private static func playCatalogPlaylist(id: String, call: CAPPluginCall) {
        Task {
            do {
                let request = MusicCatalogResourceRequest<MusicKit.Playlist>(
                    matching: \.id,
                    equalTo: MusicItemID(id)
                )
                let response = try await request.response()
                guard let playlist = response.items.first else {
                    call.reject("Catalog playlist not found")
                    return
                }
                let player = ApplicationMusicPlayer.shared
                player.queue = [playlist]
                try await player.play()
                call.resolve(["played": true])
            } catch {
                call.reject("Catalog playlist play failed: \(error.localizedDescription)", nil, error)
            }
        }
    }

    /// Pauses `ApplicationMusicPlayer`. No-op (resolves ok:false) if nothing
    /// is playing. Safe to call on any iOS 15+ device.
    @objc func pause(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            ApplicationMusicPlayer.shared.pause()
            call.resolve(["ok": true])
        } else {
            call.reject("Requires iOS 15 or later")
        }
    }

    /// Resumes playback. If the queue is empty this is a no-op from iOS's
    /// perspective; we still resolve ok:true to keep the JS surface simple.
    @objc func resume(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            Task {
                do {
                    try await ApplicationMusicPlayer.shared.play()
                    call.resolve(["ok": true])
                } catch {
                    call.reject("Resume failed: \(error.localizedDescription)", nil, error)
                }
            }
        } else {
            call.reject("Requires iOS 15 or later")
        }
    }

    @objc func skipNext(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            Task {
                do {
                    try await ApplicationMusicPlayer.shared.skipToNextEntry()
                    call.resolve(["ok": true])
                } catch {
                    call.reject("Skip-next failed: \(error.localizedDescription)", nil, error)
                }
            }
        } else {
            call.reject("Requires iOS 15 or later")
        }
    }

    @objc func skipPrevious(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            Task {
                do {
                    try await ApplicationMusicPlayer.shared.skipToPreviousEntry()
                    call.resolve(["ok": true])
                } catch {
                    call.reject("Skip-previous failed: \(error.localizedDescription)", nil, error)
                }
            }
        } else {
            call.reject("Requires iOS 15 or later")
        }
    }

    /// Stops playback and clears the queue so the lock-screen "now playing"
    /// UI goes away. Use this when the user wants to fully end playback
    /// (vs. pause, which leaves the queue in place).
    @objc func stop(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            let player = ApplicationMusicPlayer.shared
            player.pause()
            player.queue = ApplicationMusicPlayer.Queue()
            call.resolve(["ok": true])
        } else {
            call.reject("Requires iOS 15 or later")
        }
    }

    @available(iOS 16.0, *)
    private static func playLibraryPlaylist(id: String, call: CAPPluginCall) {
        Task {
            do {
                var request = MusicLibraryRequest<MusicKit.Playlist>()
                request.filter(matching: \.id, equalTo: MusicItemID(id))
                let response = try await request.response()
                guard let playlist = response.items.first else {
                    call.reject("Library playlist not found")
                    return
                }
                let player = ApplicationMusicPlayer.shared
                player.queue = [playlist]
                try await player.play()
                call.resolve(["played": true])
            } catch {
                call.reject("Library playlist play failed: \(error.localizedDescription)", nil, error)
            }
        }
    }
}
