import Foundation
import Capacitor
import StoreKit

/// Native iOS MusicKit bridge.
///
/// MusicKit JS is unreliable inside WKWebView (Capacitor) because Apple's auth
/// popup loses its `window.opener` reference and the auth token never makes it
/// back to JS. We replace it with the iOS-native StoreKit + MusicKit APIs
/// which return the music-user-token directly.
///
/// Two methods exposed to JS:
///   - requestAuthorization() -> { status, authorized }
///   - getUserToken({ developerToken }) -> { userToken }
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

        // Surface a clear error if the user hasn't granted permission yet,
        // instead of letting Apple's opaque "permission denied" come through.
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
}
