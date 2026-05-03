# ColdStreak — Android Build Guide

Capacitor is fully configured. Follow these steps to generate the Android APK for Google Play.

## Prerequisites

- Node.js 18+
- Android Studio (includes the Android SDK)
- Java 17+

## One-time setup (run locally, not in Replit)

```bash
# 1. Install dependencies (already done in Replit, repeat locally)
npm install

# 2. Build the web app
npm run build

# 3. Add the Android platform (only needed once)
npx cap add android

# 4. Copy web assets into the Android project
npx cap sync
```

## Every release: update and sync

```bash
npm run build
npx cap sync
```

## Open in Android Studio

```bash
npx cap open android
```

Then in Android Studio:
- **Build → Generate Signed Bundle / APK** to create a release build
- Or use **Run** to test on a connected device / emulator

## App details

| Field | Value |
|-------|-------|
| App ID | `com.coldstreak.app` |
| App Name | `ColdStreak` |
| Web Dir | `dist/public` |

## Publishing to Google Play

1. Create a [Google Play Developer account](https://play.google.com/console) ($25 one-time fee)
2. Create a new app in the Play Console
3. Upload the signed `.aab` (Android App Bundle) from Android Studio
4. Fill in store listing: description, screenshots, privacy policy URL (`/privacy`), and terms URL (`/terms`)
5. Set content rating and submit for review

## Privacy policy & Terms URLs (required for Play Store)

Once deployed:
- Privacy Policy: `https://coldstreakapp.com/privacy`
- Terms of Service: `https://coldstreakapp.com/terms`

## Notes

- The `capacitor.config.ts` is at the project root
- `androidScheme: "https"` ensures secure context for all browser APIs
- SplashScreen background matches the app's dark blue theme (`#0f1f3d`)

## Required AndroidManifest.xml permissions

The `android/` folder is gitignored and regenerated locally each release.
After running `npx cap add android` (first time) or any time you regenerate
the Android project, verify these `<uses-permission>` entries exist in
`android/app/src/main/AndroidManifest.xml` inside the `<manifest>` block:

```xml
<!-- Required by RevenueCat / Google Play Services on Android 13+ (API 33+).
     Without this, Play Console rejects releases with:
     "Your advertising ID declaration says your app uses advertising ID
      but the manifest doesn't include com.google.android.gms.permission.AD_ID" -->
<uses-permission android:name="com.google.android.gms.permission.AD_ID" />
```

Capacitor's default manifest does NOT include AD_ID — you must add it manually
each time the manifest is freshly generated. `cap sync` preserves it on subsequent
runs.

---

## ⏳ TODO — Health Tracker Integration (Android)

When building the Android version, add automatic export to **Google Health Connect**
so plunge sessions (duration, calories, workout type) sync directly to the user's
health app without any manual CSV step.

**Recommended package:** `@capacitor-community/health-connect`

**What to log per plunge:**
- Workout type: `EXERCISE_TYPE_SWIMMING` (closest match) or `OTHER`
- Duration: plunge duration in seconds
- Calories: use the existing `estimateCalories(duration, tempF, weightLbs)` formula
- Start/end time: from `plunge.createdAt`

**Steps when ready:**
1. `npm install @capacitor-community/health-connect`
2. Add Health Connect permissions to `AndroidManifest.xml`
3. Request permission on first Pro login
4. Write session on every plunge log (in `doLogPlunge` success handler)
5. Declare Health Connect usage in Play Store listing (required by Google)

---

## ⏳ TODO — Health Tracker Integration (iOS)

When building the iOS App Store version, add **Apple HealthKit** integration so
plunge sessions sync directly to the Health app.

**Recommended package:** `@capacitor-community/health` (covers both HealthKit + Google Fit)

**What to log per plunge:**
- Category: `HKWorkoutActivityTypeOther` or swimming
- Duration, active energy burned (calories), start/end time

**Steps when ready:**
1. `npm install @capacitor-community/health`
2. Add `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` to `Info.plist`
3. Enable HealthKit capability in Xcode (requires Apple Developer account)
4. Request permission on first Pro login
5. Write session on every plunge log (in `doLogPlunge` success handler)

**Note:** Apple requires you to justify HealthKit usage during App Store review.
Describe it as: "ColdStreak writes cold plunge workout sessions and estimated calorie
burn to Apple Health to help users track their wellness data in one place."
