# coldstreak-musickit

Native iOS MusicKit bridge for ColdStreak. Replaces MusicKit JS inside the
Capacitor WebView (where Apple's auth popup is broken) with iOS's StoreKit
`SKCloudServiceController` APIs which return a music-user-token directly to JS.

## One-time Mac setup (run these the first time you pull this code)

From the repo root **on your Mac**:

```bash
# 1. Install the plugin into the app's node_modules
npm install ./capacitor-plugins/coldstreak-musickit

# 2. Sync the iOS project — Capacitor will pull the Swift files into your
#    Xcode project as a CocoaPod automatically.
npx cap sync ios
```

## Xcode setup (one-time, in the Xcode project)

1. Open `ios/App/App.xcworkspace` in Xcode.
2. **Add the MusicKit capability**
   - Select the `App` target → **Signing & Capabilities** → **+ Capability** → **MusicKit**.
   - (You also need MusicKit enabled on your App ID in Apple Developer portal — already done.)
3. **Add the Apple Music usage description to Info.plist**
   - Open `ios/App/App/Info.plist` (right-click → Open As → Source Code) and add inside the top-level `<dict>`:
     ```xml
     <key>NSAppleMusicUsageDescription</key>
     <string>ColdStreak uses Apple Music to play your playlists during cold-plunge sessions.</string>
     ```
4. **Bump the build number** (so TestFlight accepts it as a new build).
5. Archive → upload to App Store Connect → release to TestFlight.

## After every code change

```bash
npm run build         # rebuild the web bundle
npx cap sync ios      # push the bundle into the Xcode project
# then archive in Xcode
```

## What it does

- `requestAuthorization()` → triggers iOS's "Allow ColdStreak to access Apple Music" prompt and returns the user's choice.
- `getUserToken({ developerToken })` → exchanges the developer token (issued by our server at `/api/apple-music/developer-token`) for a per-user music-user-token, which we cache in `localStorage` and use as the `Music-User-Token` header on subsequent `api.music.apple.com` requests.

The JS bridge is consumed by `client/src/lib/appleMusic.ts` which auto-detects Capacitor and uses this plugin instead of MusicKit JS.
