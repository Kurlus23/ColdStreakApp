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
- Privacy Policy: `https://yourdomain.com/privacy`
- Terms of Service: `https://yourdomain.com/terms`

## Notes

- The `capacitor.config.ts` is at the project root
- `androidScheme: "https"` ensures secure context for all browser APIs
- SplashScreen background matches the app's dark blue theme (`#0f1f3d`)
