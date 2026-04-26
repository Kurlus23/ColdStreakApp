# ColdStreak

## Overview
ColdStreak is a cold plunge tracking web application, also available as a PWA and Android app. It enables users to track cold plunge sessions, monitor their "Cold Score" and streaks, set weekly goals, earn achievement badges, and participate in leaderboards. The app also features curated and community-submitted "Chill Places." Users have the option to upgrade to a Pro version for an ad-free experience and unlimited history. The project aims to provide a comprehensive platform for cold plunge enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, using Vite for bundling.
- **Routing**: `wouter` for navigation.
- **State Management & Data Fetching**: TanStack React Query.
- **UI/UX**: `shadcn/ui` (New York style) built on Radix UI, styled with Tailwind CSS, featuring a custom dark navy/cyan theme. Fonts are DM Sans and Outfit from Google Fonts.
- **PWA**: Implemented with `manifest.json` and a service worker for standalone mobile installation.
- **Mobile App**: Capacitor wraps the web app for Android deployment.

### Backend
- **Framework**: Express.js with TypeScript.
- **Authentication**: JWT for tokens and bcrypt for password hashing.
- **API Endpoints**: Comprehensive set of RESTful APIs for user authentication, plunge management (CRUD), leaderboard interactions, community location submissions, and Stripe integration for Pro upgrades.
- **Storage Layer**: An `IStorage` interface with a `DatabaseStorage` implementation using Drizzle ORM.

### Shared Layer
- **Schema**: Defines database schemas for `users`, `plunges`, `leaderboardEntries`, `proUsers`, and `userLocations`.
- **Routes Manifest**: Provides a typed API contract for consistent communication between client and server.

### Database Schema
- **users**: Stores user credentials and metadata.
- **plunges**: Records details of each cold plunge session, including duration, temperature, score, and location.
- **leaderboard_entries**: Manages entries for location-specific leaderboards.
- **pro_users**: Tracks Pro subscription status.
- **user_locations**: Stores community-contributed chill places and business listings. Tracks `view_count` (incremented each time the detail panel is opened) and `nomination_count`.
- **events**: Community cold plunge events with name, description, date, location, a 6-char alphanumeric share code, optional waiver/payment URLs, and max attendees.
- **event_participants**: Join table linking users to events they've RSVP'd to.

### Device Identity
The system uses a `clientId` for anonymous plunge tracking, which can be synced to a `userId` upon account creation.

## External Dependencies
- **PostgreSQL**: Primary database for all application data, accessed via Drizzle ORM.
- **Stripe**: Used for processing Pro subscription payments.
- **PostHog**: Integrated for analytics and event tracking.
- **Sentry**: Utilized for error monitoring and reporting.
- **Capacitor**: Enables wrapping the web application into native Android apps.
- **Google Fonts**: Provides DM Sans and Outfit typefaces.
- **`jsonwebtoken`**: For handling JWTs in authentication.
- **`bcryptjs`**: For hashing user passwords securely.
- **`@capacitor-community/media`**: For camera roll interactions (saving plunge photos).
- **`piexifjs`**: For embedding EXIF data into images.

## Avatar / Profile Photos
Profile avatars currently use a URL field — users paste a link to an image hosted elsewhere (e.g. a profile photo URL). This keeps the app free of file storage requirements and avoids privacy/moderation obligations.

## Pre-Launch Checklist (before Google Play release)
- ✅ **Remove `kurlus23@gmail.com` from admin** — Done. Only `coldstreakapp17@gmail.com` is in `ADMIN_EMAILS`. Security alert emails also updated.
- ✅ **Delete `seedTestVerifiedBusiness()`** — Done. Function and its call removed from `server/routes.ts`.
- ✅ **Switch Stripe to live mode** — Done. `USE_STRIPE_TEST=false`. All live secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs) already configured.
- ✅ **Remove TEMP backfill block** — Done. The kurlus23 contactEmail backfill block removed from `server/routes.ts`.
- **Activate Stripe Customer Portal** — Must be enabled in the Stripe live-mode dashboard before subscription management goes live.
- **Wipe test data from production DB** — Arctic Recovery Studio test business (id=6) is still in the database. Delete it from the admin panel or DB directly before launch.
- **Add `username` column to production DB** — Run `ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;` on the production database if not already applied.

## Growth Milestones

### At 1,000 users
- **Set up Google Workspace for support email** — Create `support@coldstreakapp.com` (~$6/month) using Google Workspace with the coldstreakapp.com domain. Update `sendSupportEmail` in `server/email.ts` to send TO `support@coldstreakapp.com` instead of `coldstreakapp17@gmail.com`. This separates support traffic from admin email, looks professional in reply-to headers, and makes ticket management much easier at scale.

## Home Screen Background
- **Active background**: `attached_assets/image_1775083022624.png` (Frozen Misty Lake — user-provided photo)
- **Import alias**: `@assets/image_1775083022624.png` in `client/src/pages/Home.tsx`
- To swap backgrounds, update that one import line.

### Saved Wallpaper Library (future interchangeable wallpaper feature)
All options are stored in `attached_assets/generated_images/`:
| File | Description |
|------|-------------|
| `bg_frostlake_hires.png` | Frozen Misty Lake hi-res (alternate) |
| `bg_frostlake.png` | Frozen Misty Lake — **current default** |
| `bg_icecave.png` | Ice Cave with cyan glow |
| `bg_underwater.png` | Underwater cold plunge looking up |
| `bg_aurora.png` | Arctic Aurora Borealis |
| `bg_plungepool.png` | Cold plunge pool top-down at night |
| `bg_crackedice.png` | Cracked ice surface from below |

### Future: Custom Wallpaper System
- Let users pick a wallpaper from the library in Settings (free tier gets 1-2, Pro unlocks all)
- Store choice in `localStorage` key `coldstreak-wallpaper`
- Could offer exclusive Pro-only wallpapers as a perk
- Could tie certain wallpapers to badge milestones (e.g. unlock "Ice Cave" after 30-day streak)
- **Pro exclusive**: Allow Pro users to upload their own photo as a custom wallpaper
  - Store as base64 in `localStorage` key `coldstreak-wallpaper-custom` (keeps it simple, no cloud storage needed for v1)
  - Cap file size at ~3MB with a client-side check before accepting
  - Show a "Custom" option in the wallpaper picker that opens the device photo library
  - If cloud storage is added later (e.g. Cloudinary), migrate to URL-based storage per the avatar roadmap pattern

## Post-iOS Launch (Before v2.0)

### Smartwatch Companion Apps
Priority order: Apple Watch first (existing iOS ecosystem), then Garmin, then Amazfit. Each is a standalone project requiring platform-specific development.

- **Apple Watch** — watchOS app written in Swift/SwiftUI alongside the Xcode project. Features: press Digital Crown or a button to start/stop the ColdStreak timer (via WatchConnectivity messaging to the iPhone app); automatically start an HKWorkoutSession so the watch records continuous heart rate throughout the plunge; heart rate data syncs back into ColdStreak session automatically. Requires HealthKit + WatchKit entitlements in App Store Connect and a new watchOS target in the Xcode project. This is the highest-priority watch platform given the existing iOS distribution. **Apple Watch never exposes HR over BLE** (Apple gates that through HealthKit) — the iPhone HR picker now detects Apple Watch in the scan list and shows a "use the watch app instead" card. **Live HR streaming during a plunge** (build 20+): `PlungeWorkoutManager.swift` HR delegate calls `PhoneSyncService.sendLiveHR(bpm)` which uses `WCSession.sendMessage` (throttled to ~1 Hz) with `updateApplicationContext` fallback. iPhone-side `WatchSyncPlugin.swift` receives via `didReceiveMessage` / `didReceiveApplicationContext` and emits `watchLiveHR` events to JS. `client/src/pages/Home.tsx` subscribes to `watchLiveHR` and pipes BPM into `setCurrentHR/setHrPeak/hrReadingsRef` with a 12 s stale-clear timer so the iPhone HR display works exactly like a BLE strap during plunges. Requires TestFlight rebuild — the Capacitor sync is needed for the new native code.

  **HealthKit permission gotcha (Apr 2026)**: For `.other` workouts, HR collection requires Active Energy permission to be granted in addition to Heart Rate — empirically, denying Active Energy prevents HR samples from being delivered to `HKLiveWorkoutBuilder` even though Heart Rate itself was granted. `requestAuthorization()` therefore requests `heartRate`, `heartRateVariabilitySDNN`, `restingHeartRate`, `activeEnergyBurned`, and `workoutType()` for READ, plus `workoutType`, `activeEnergyBurned`, and `heartRate` for SHARE — all in a single dialog so the user grants them together. iOS only shows the dialog once per app install; if any type was denied, the user must manually fix it in iPhone Settings → Health → Data Access & Devices → ColdStreak. We cannot programmatically grant HealthKit permissions (Apple deliberately blocks that). New testers should be told up front to enable **Heart Rate, HRV, and Active Energy** when the dialog appears.

  **Permission-missing detector (build 20+)**: `PlungeWorkoutManager.permissionsLikelyMissing` checks `healthStore.authorizationStatus(for:)` for the SHARE-side permissions (Active Energy, Heart Rate, Workout) — Apple hides READ status entirely for privacy reasons, so SHARE-status is the only signal we have. When `true`, `ReadyView.swift` shows an orange tappable banner: "Heart rate may not record. Please ensure Heart Rate, HRV, and Active Energy are enabled. Tap to verify permissions." Tap → `PhoneSyncService.requestOpenHealthSettings()` sends a `kind: "openHealthSettings"` WatchConnectivity message to the iPhone → `WatchSyncPlugin.swift` calls `UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)` which opens the iPhone's per-app settings page (closest landing point — iOS doesn't deep-link directly to Health → Data Access). Banner re-checks on every `onAppear` so it auto-dismisses after the user fixes permissions and returns to the watch. The iPhone HR scanner's "Apple Watch detected" card in `client/src/pages/Home.tsx` also includes the same first-time setup guidance.

- **Garmin (Connect IQ)** — Garmin widget or datafield app written in Monkey C using the Connect IQ SDK. Communicates with the phone via the Garmin Connect companion API. Start/stop timer from the watch; HR auto-recorded by Garmin's native workout tracking and optionally pushed to ColdStreak. Covers a large user base (Fenix, Forerunner, Epix, Venu series). Requires a Connect IQ developer account and publishing to the Garmin Connect IQ store.

- **Amazfit T-Rex 2 / Zepp OS** — Zepp OS mini-program written in JavaScript-adjacent syntax (most approachable of the three). Start/stop timer from the watch face; HR data from Zepp's native BioTracker sensor passed to the phone companion app. Requires a Zepp developer account and publishing to the Zepp app store. Zepp OS 2.0+ required (T-Rex 2, GTR 4, GTS 4, Falcon support this).

**Shared design principle across all platforms**: the watch is a remote control + HR sensor only — all data storage, Cold Score calculation, and session history remain in the ColdStreak iPhone/Android app.

## Bluetooth Thermometer Support
- **Currently supported model: Inkbird IBS-TH2 Plus** (waterproof external probe). As of build 19 we read it via **BLE advertisement scanning** (no GATT connection), modeled on Home Assistant's `inkbird-ble` library. The device broadcasts manufacturer-specific data every ~1–2s: bytes 0–1 = signed int16 LE ÷ 100 = °C, byte 6 = external probe flag, byte 7 = battery %. Build 18 and earlier mistakenly subscribed to the standard Health Thermometer GATT service (`0x1809` / `0x2A1C`) — IBS-TH2 Plus does not actually implement that profile, which is why every reading came back as ~45°F garbage regardless of probe state. The beacon implementation lives in `client/src/pages/Home.tsx` (`parseTempFromBytes`, `inspectScanResultPayloads`, `detectThermoProtocol`, `startThermoStream`, `startThermoKeepalive`, `autoReconnectThermo`). A keepalive watchdog restarts the scan if no broadcast arrives for 15s (handles the case where HR scanner pre-empts the global LE scan slot) and escalates to `autoReconnectThermo` after 3 silent restart attempts (~45s). Selected after retiring ThermoPro TP25 reverse-engineering work — TP25 used a proprietary protocol (`1086fff0…`) that never returned reliable probe data.
- **Diagnostic + iOS deviceId-mismatch handling**: `detectThermoProtocol` tracks every BLE device seen during its 20s scan window and surfaces them in a yellow diagnostic panel under the Bluetooth settings card so the user can confirm what's broadcasting even when the expected device isn't being matched. It accepts an optional `expectedName` so that — when the iOS Capacitor BLE plugin returns a fresh `deviceId` between sessions — the scanner falls back to matching by name and returns the resolved `matchedDeviceId`; all callers (`reconnectThermo`, `autoReconnectThermo`, `connectThermometer`, `connectFromThermoScan`, `reconnectThermoFromUI`) adopt that id and persist it to localStorage. To prevent false positives, only manufacturer data ≥ 6 bytes can auto-resolve a temperature; service-data parses are shown in the diagnostic but never used to match. `startThermoScan`/`startHrScan` now track their auto-stop timers via refs (`thermoScanTimeoutRef`, `hrScanTimeoutRef`) so a delayed `stopLEScan()` cannot kill the active beacon stream after the user picks a device. `detectThermoProtocol` explicitly stops the scan on its own timeout / error paths.
- **Equipment-bay temperature & fan control** — Handled by standalone hardware (Pymeter PY-20TT or Inkbird IPT-2CH), intentionally **independent of the app** so chiller automation never depends on a phone being nearby.

## v2.0 Roadmap Notes


- **Bitmoji / device photo upload for avatars** — Allow users to upload an image directly from their device (including Bitmoji screenshots). Requires cloud image storage (Cloudinary or similar), privacy policy updates to cover image data collection, ToS clause for user-generated content, and a content moderation plan for App Store / Play Store compliance. Current URL-paste approach intentionally deferred until v2.0.
- **Plunge photo cloud storage** — Currently plunge photos are stored as base64 in the database, which bloats storage and limits scalability. Migrate to a cloud storage provider (Cloudinary or S3-compatible) so photos are stored as URLs. Requires a CDN-backed upload flow, signed upload tokens so the client can upload directly without routing through the server, privacy policy updates for image data, and a moderation plan for App Store / Play Store compliance. On-device base64 approach is intentionally kept for v1 simplicity.
- **Spotify & Apple Music integration** — Let users link their Spotify or Apple Music account and pick a playlist that auto-plays when the timer starts and pauses/stops when the session ends. On Android this would use Capacitor + the respective SDK or deep-link API; on iOS it would require the MusicKit entitlement. Requires OAuth flow for Spotify (PKCE) and MusicKit token for Apple. Both platforms have strict SDK terms around background audio — review before building. Consider making playlist selection a Pro perk.
- **Social / Friends Feed ("Facebook of Cold Plunges")** — The flagship 2.0 social layer. Depends on cloud image storage being in place first (see avatar and plunge photo roadmap items above). Planned features:
  - Friend requests: search by username, send/accept/decline
  - Friends feed tab: chronological stream of friends' plunges (name, Cold Score, duration, temp, location, photo)
  - Quick reactions on plunges (fire / ice / 💪 — no full comment system needed for v1 social)
  - "Plunging now" live status indicator when a friend has an active timer
  - Public profile page extending the existing badge profile (streak, stats, recent plunges, total count)
  - Privacy controls per plunge: Public / Friends Only / Private
  - Auto-posted milestones (e.g. "Just hit a 30-day streak!")
  - **Key differentiator vs. PlungePalz**: every feed post is data-first — Cold Score, temp, and duration are baked into every entry, not just a photo caption
  - Infrastructure prerequisites: cloud image storage (Cloudinary or S3), a real-time or polling notification layer for friend activity, and server-side capacity planning for feed generation at scale.