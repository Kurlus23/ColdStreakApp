---
name: HealthKit iOS plugin wiring
description: Why Apple Health "won't connect" in the ColdStreak iOS app and how to diagnose it
---

# HealthKit "won't connect" is almost always an Xcode build-wiring issue, not a code bug

The HealthKit plugin (`watchos/ios-bridge/HealthKitPlugin.swift`) uses the modern
`CAPBridgedPlugin` pattern with a `pluginMethods: [CAPPluginMethod]` array. That
self-registers all methods at runtime — so unlike the music plugin it does NOT
need a `.m` CAP_PLUGIN_METHOD file. The Swift + JS bridge (`client/src/lib/healthKit.ts`,
registers `"HealthKit"`) is complete.

**Why:** the `ios/` folder is gitignored (Mac-only). The `.swift` plugin file must be
*manually* dragged into the iOS **App** target in Xcode, the HealthKit capability added
to that target, and `NSHealthShareUsageDescription` added to the iOS app's
`ios/App/App/Info.plist`. Per `watchos/XCODE_SETUP.md` Step 5b. If the file isn't in
the App target, `Capacitor.isPluginAvailable("HealthKit")` is false and the bridge
calls throw — the app can't talk to HealthKit at all.

**How to apply / diagnose:**
- `isHealthKitPluginAvailable()` (uses `Capacitor.isPluginAvailable("HealthKit")`) is
  the reliable on-device signal for "is the native plugin in THIS build?" — use it to
  tell "missing from build" (→ rebuild/TestFlight needed) apart from "permission denied".
- Apple's `requestAuthorization` for READ scopes returns success=true even when the
  user denies read access (privacy by design). So you can NEVER confirm read access via
  the auth result — only a later query returning data confirms it. Don't show a
  "denied" message based on the auth success flag.
- Native plugin changes only reach the device via `npx cap sync ios` + rebuild, never OTA.
