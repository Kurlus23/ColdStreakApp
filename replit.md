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

- **Apple Watch** — watchOS app written in Swift/SwiftUI alongside the Xcode project. Features: press Digital Crown or a button to start/stop the ColdStreak timer (via WatchConnectivity messaging to the iPhone app); automatically start an HKWorkoutSession so the watch records continuous heart rate throughout the plunge; heart rate data syncs back into ColdStreak session automatically. Requires HealthKit + WatchKit entitlements in App Store Connect and a new watchOS target in the Xcode project. This is the highest-priority watch platform given the existing iOS distribution.

- **Garmin (Connect IQ)** — Garmin widget or datafield app written in Monkey C using the Connect IQ SDK. Communicates with the phone via the Garmin Connect companion API. Start/stop timer from the watch; HR auto-recorded by Garmin's native workout tracking and optionally pushed to ColdStreak. Covers a large user base (Fenix, Forerunner, Epix, Venu series). Requires a Connect IQ developer account and publishing to the Garmin Connect IQ store.

- **Amazfit T-Rex 2 / Zepp OS** — Zepp OS mini-program written in JavaScript-adjacent syntax (most approachable of the three). Start/stop timer from the watch face; HR data from Zepp's native BioTracker sensor passed to the phone companion app. Requires a Zepp developer account and publishing to the Zepp app store. Zepp OS 2.0+ required (T-Rex 2, GTR 4, GTS 4, Falcon support this).

**Shared design principle across all platforms**: the watch is a remote control + HR sensor only — all data storage, Cold Score calculation, and session history remain in the ColdStreak iPhone/Android app.

## Bluetooth Thermometer Support
- **Currently supported model: Inkbird IBS-TH2 Plus** (waterproof external probe, standard BLE Health Thermometer GATT service `0x1809` / characteristic `0x2A1C`). Selected after retiring ThermoPro TP25 reverse-engineering work — TP25 used a proprietary protocol (`1086fff0…`) that never returned reliable probe data over its `fff2` notify or `8ec90003` indicate characteristics, even after writing cmd-A/B/C activation packets. IBS-TH2 Plus also supports BLE advertisement broadcasts (no GATT connection needed), which sidesteps the iOS BLE cache/disconnect issues that plagued TP25 — broadcast-mode parsing is a future enhancement; current implementation uses standard GATT subscriptions.
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