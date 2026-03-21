# ColdStreak

## Overview

ColdStreak is a cold plunge tracking web app (PWA + Android via Capacitor). Users time cold plunge sessions, log history, track Cold Score / streaks / weekly goals, earn achievement badges, explore curated Chill Places, submit community locations, compete on leaderboards, and optionally upgrade to Pro (ad-free, unlimited history).

Full-stack TypeScript: React + Vite frontend, Express backend, PostgreSQL via Drizzle ORM.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React 18 + TypeScript, bundled by Vite
- **Routing**: `wouter`. Routes: `/` (Home), `/privacy`, `/terms`
- **State & Data Fetching**: TanStack React Query. Custom hooks in `client/src/hooks/`
- **UI**: shadcn/ui (New York) on Radix UI. Tailwind CSS with custom dark navy/cyan theme
- **Fonts**: DM Sans + Outfit via Google Fonts
- **PWA**: `manifest.json` + service worker for standalone mobile install
- **Analytics**: PostHog (`VITE_PUBLIC_POSTHOG_KEY`) — events: timer_started, plunge_logged, pro_upgrade_started, etc.
- **Error monitoring**: Sentry (`VITE_SENTRY_DSN`) with React ErrorBoundary
- **Android**: Capacitor (`capacitor.config.ts`) wraps the built web app. See `ANDROID_BUILD.md`

### Backend

- **Framework**: Express.js + TypeScript (tsx in dev)
- **Auth**: JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`). Token extracted from `Authorization: Bearer` header. Secret from `SESSION_SECRET` env var.
- **API Routes** (`server/routes.ts`):
  - `POST /api/auth/register` — create account (email + password)
  - `POST /api/auth/login` — login, returns JWT
  - `GET /api/auth/me` — verify token
  - `POST /api/auth/sync` — claim local clientId plunges to logged-in account
  - `GET /api/plunges` — returns plunges (by userId if authed, else by clientId)
  - `POST /api/plunges` — create plunge (attaches userId if authed)
  - `PATCH /api/plunges/:id`, `DELETE /api/plunges/:id`
  - `GET /api/leaderboard/:locationId`, `POST /api/leaderboard`, `DELETE /api/leaderboard/:id`
  - `GET /api/community-locations`, `POST /api/community-locations`, `POST /api/community-locations/:id/nominate`
  - `POST /api/stripe/checkout`, `GET /api/stripe/verify`
  - `GET /api/pro-status/:email`
- **Storage Layer**: `server/storage.ts` — `IStorage` interface + `DatabaseStorage` with Drizzle

### Shared Layer

- **Schema** (`shared/schema.ts`): `users`, `plunges`, `leaderboardEntries`, `proUsers`, `userLocations`
- **Routes manifest** (`shared/routes.ts`): Typed API contract shared by client and server

### Database Tables

| Table | Key Fields |
|---|---|
| `users` | id, email, passwordHash, createdAt |
| `plunges` | id, clientId, userId (nullable), duration, temperature, score, photoData, locationName, createdAt |
| `leaderboard_entries` | id, locationId, username, score, duration, temperature |
| `pro_users` | id, email, stripeSessionId, active |
| `user_locations` | id, name, country, state, city, latitude, longitude, isBusiness, businessVerified, websiteUrl, phone, yelpUrl, facebookUrl, bookingUrl, contactEmail, fullAddress, nominationCount |
| `business_listings` | id, locationId, email, stripeSessionId, stripeSubscriptionId, active, expiresAt |

### Device Identity

Plunges use a `clientId` (UUID stored in localStorage) for anonymous tracking. When a user creates an account and syncs, plunges are migrated to their `userId`. Logged-in users fetch plunges by userId; anonymous users fetch by clientId.

---

## Key Files

| File | Purpose |
|---|---|
| `client/src/pages/Home.tsx` | Main app (timer, history, settings, leaderboard, badges) |
| `client/src/components/PlungeCard.tsx` | Plunge history card with share/save/edit/delete |
| `client/src/components/AdUnit.tsx` | FeedAd + InterstitialAd (skipped for Pro users) |
| `client/src/components/Onboarding.tsx` | First-launch 3-slide onboarding flow |
| `client/src/hooks/use-auth.ts` | Auth state hook (login/register/logout/sync) |
| `client/src/hooks/use-plunges.ts` | Plunge CRUD hooks (includes auth headers) |
| `client/src/lib/analytics.ts` | PostHog event tracking |
| `client/src/lib/monitoring.ts` | Sentry error monitoring |
| `client/src/lib/queryClient.ts` | TanStack Query client (includes auth header injection) |
| `client/src/pages/Explore.tsx` | Business listings (verified/free), Chill Places, community locations |
| `client/src/pages/Privacy.tsx` | Public privacy policy page |
| `client/src/pages/Terms.tsx` | Public terms of service page |
| `capacitor.config.ts` | Android/iOS wrapper config (appId: com.coldstreak.app) |
| `ANDROID_BUILD.md` | Step-by-step Android build + Play Store submission guide |

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Secret | PostgreSQL connection string |
| `SESSION_SECRET` | Secret | JWT signing key |
| `STRIPE_SECRET_KEY` | Secret | Stripe server-side key |
| `STRIPE_PRICE_ID` | Secret | Stripe price ID — $19.99 lifetime (price_1TBb4nK8VT5F0tqBBF57jj2V) |
| `STRIPE_ANNUAL_PRICE_ID` | Secret | Stripe price ID — $9.99/year (price_1TBb4oK8VT5F0tqBIywsZxeO) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Shared | Stripe client-side key |
| `VITE_PUBLIC_POSTHOG_KEY` | Secret | PostHog project API key |
| `VITE_SENTRY_DSN` | Secret | Sentry DSN for error tracking |

---

## Monetization

- **Free tier**: Ads every 5 cards (FeedAd), interstitial before share/save (InterstitialAd), last 7 days history
- **ColdStreak Pro** (~$7.99 one-time via Stripe): No ads, unlimited history, leaderboards, Chill Places

> **App Store note**: For native iOS/Android App Store builds, Stripe must be replaced with RevenueCat (Apple IAP + Google Play Billing). See `.local/skills/revenuecat/`.

---

## Launch Status

- ✅ Step 1 — Deploy (Replit autoscale, production DB connected)
- ✅ Step 2 — Privacy policy + Terms of Service pages
- ✅ Step 3 — PostHog analytics
- ✅ Step 4 — Sentry error monitoring
- ✅ Step 5 — Android build (AAB generated via Capacitor + Android Studio, uploaded to Play Console)
- ✅ Step 6 — First-launch onboarding flow
- ✅ Step 7 — Account login + data sync (cross-device profile sync: displayName, bodyWeight)
- ✅ Step 8 — Stripe live mode (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET set)
- ✅ Step 9 — Custom domain (coldstreakapp.com live, DNS via Cloudflare A record → Replit)
- ✅ Step 10 — Milestone email alerts (100 / 500 / 1000 / 2500 / 5000 / 10000 users → ColdStreakApp17@gmail.com)
- ⬜ Step 11 — RevenueCat / Google Play Billing (required before Android Pro purchases go live)
- ✅ Step 12 — Store listing assets (512×512 icon, 1024×500 feature graphic, screenshots)
- 🔧 Step 13 — Google Play Console submission (AAB uploaded, closed test created; blocked on Google identity verification — awaiting email approval)

---

## Growth Roadmap (trigger: ~1,000 registered users)

### Admin Panel (`/admin` — password-protected, owner-only)
Build when user base reaches scale where manual Stripe dashboard management becomes painful.

**Features planned:**
- User lookup by email — see account details, plunge count, Pro status
- Revoke Pro access with one click (marks `pro_users.active = false`)
- User count dashboard (total registered, Pro count, DAU estimate)
- Milestone email alert — server automatically emails `ColdStreakApp17@gmail.com` when the 1,000th account is created

**Implementation notes:**
- Protect route with a hardcoded admin secret env var (`ADMIN_SECRET`)
- No separate login UI needed — just a header-based token check
- Refunds still issued manually via Stripe dashboard; admin panel just handles access revocation on the app side
- Stripe subscription cancellation can be added to the revoke action via `stripe.subscriptions.cancel()`

**To check current user count at any time:** just ask — the database can be queried instantly.

---

## Future Feature Ideas

### Voice Commands (Siri / Google Assistant)
- "Hey Siri, start my ColdStreak timer" / "Hey Siri, stop my ColdStreak timer"
- iOS: Implement via **Siri Shortcuts** + Capacitor App plugin (expose `startTimer` / `stopTimer` as Shortcut actions in `Info.plist`)
- Android: Implement via **Google Assistant App Actions** (define intents in `shortcuts.xml`)
- Both require native app builds (already in place via Capacitor)
- Siri Shortcuts require Apple Developer account capability enabled in Xcode

### Smartwatch Integration
**Database already prepared** — `plunges` table has `hr_avg` (avg heart rate BPM) and `spo2_avg` (avg blood oxygen %) columns ready to receive data. Currently stored as `null` on every plunge.

**Phase 1 — Health app sync (next after Android launch):**
- Android: **Google Health Connect** — export plunge sessions (duration, calories, workout type) automatically. See `ANDROID_BUILD.md` for full implementation steps.
- iOS: **Apple HealthKit** — same data exported to Apple Health app. Declared in App Store listing as: *"ColdStreak writes cold plunge workout sessions and estimated calorie burn to Apple Health."*

**Phase 2 — Live biometric capture during plunge:**
- Pull `hrAvg` and `spo2Avg` from a connected smartwatch/sensor in real time while the timer runs
- Display live heart rate on the timer screen during the plunge
- Auto-populate heart rate and SpO2 fields when the session is saved
- Apple Watch: via HealthKit live queries during active workout session
- Wear OS / Galaxy Watch: via Health Services API
- Show post-plunge heart rate recovery curve in the history card

**Phase 3 — Wrist controls:**
- Apple Watch: **watchOS companion app** — start/stop timer from wrist without touching phone
- Wear OS: Similar companion app via Wear OS SDK
- Both require separate watch app targets in Xcode / Android Studio

### Digital Thermometer Integration
- Bluetooth thermometer support via **`@capacitor-community/bluetooth-le`** — works natively in Android app AND in Chrome browser. Supports ThermoPro TP25 (TP25_SERVICE `1086fff0-...`), standard health_thermometer (`00001809-...`), Govee INTELLI_ROCKS. Probe temp parsed from TLVC packets (bytes 2+ aligned, big-endian tenths-of-°C). **Android build requires these AndroidManifest.xml permissions:**
  ```xml
  <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  ```
  After any BLE plugin changes run: `npx cap sync android`
- Auto-fill temperature field when timer starts
- Could display live temp on timer screen during plunge
- iOS: `@capacitor-community/bluetooth-le` also supports iOS natively via CoreBluetooth — no Web Bluetooth needed

---

## Monetization Reminders

### Google AdSense — Do this at 1,000 users
## REMINDER — Delete Before Google Play Launch

The following test entry was added to help testers preview the Verified Business profile:
- **"Arctic Recovery Studio"** — fake verified business (Fredericksburg, VA)
- Inserted via `seedTestVerifiedBusiness()` in `server/routes.ts`
- **Remove before Google Play launch**: delete `seedTestVerifiedBusiness()` from `server/routes.ts` startup, then run `DELETE FROM user_locations WHERE name = 'Arctic Recovery Studio'` on production.

## ⏰ REMINDER — June 21, 2026
**Pricing Phase 3**: When ColdStreak hits 5k–10k daily active users, set `LIFETIME_PRICE_PHASE=3` in Secrets and redeploy. This switches the lifetime Pro price from $24.99 → $29.99 automatically on the next checkout.
- Phase 2 ($24.99) kicks in automatically when the 1,000th Founding Plunger badge slot is claimed.
- Phase 3 ($29.99) requires the manual env var set above.
- Stripe Price IDs: P2 = `STRIPE_LIFETIME_PRICE_ID_P2`, P3 = `STRIPE_LIFETIME_PRICE_ID_P3` (both already in Secrets).

---

## Admin System

### Admin account
- **Email**: `admin@coldstreakapp.com` (or override with `ADMIN_EMAIL` env var)
- **Password**: `ColdStreak-Admin-2026!` (or override with `ADMIN_PASSWORD` env var)
- **Status**: Disabled by default (`is_disabled = true` in DB). Login returns 403 until enabled.
- **To enable**: Run `UPDATE users SET is_disabled = false WHERE email = 'admin@coldstreakapp.com';` on the production database.
- **To change password**: Update the `ADMIN_PASSWORD` env var — the seeder re-hashes it each startup only if the account doesn't exist yet. To reset manually: `UPDATE users SET password_hash = '<bcrypt hash>' WHERE email = 'admin@coldstreakapp.com';`

### Admin privileges (all except pay system)
- Sees all community locations including hidden ones
- Per-card controls in Explore: Hide, Restore, Delete (no email verification required)
- Can edit any location (not just their own)
- Excluded from: Stripe/payment flows

### Admin detection
- `ADMIN_EMAILS` set in `server/routes.ts` (currently `kurlus23@gmail.com`) — always has admin rights via email match
- DB `users.is_admin = true` — elevated at login, stored in JWT claim `isAdmin`
- `isCallerAdmin(caller)` helper checks both sources

## TEMP — Startup backfill (safe to remove after first prod deploy)
- A one-time backfill in `server/routes.ts` startup sets `contact_email = 'kurlus23@gmail.com'` on production location IDs 7 and 8 (FoR Quarry, FoR Plunge) so `isOwner` returns true for the submitter.
- **Remove after first successful prod deploy** by deleting the `inArray(userLocations.id, [7, 8])` update block from `registerRoutes`.

---

## Version 2.0 Roadmap

Features deliberately deferred from v1 — revisit after Google Play launch and initial user growth.

### Community Location Photos
- Allow the location owner (and only the owner) to upload one cover photo per location.
- Photo starts hidden (`isApproved = false`) until an admin approves it — satisfies App Store / Google Play user-generated content moderation requirements.
- **Before building:** migrate off base64-in-Postgres to a proper image host (Cloudinary, Supabase Storage, or similar) — base64 is fine for per-user session photos but becomes a performance problem when fetched by all Explore users.
- Add a reporting mechanism so users can flag inappropriate photos (required by Apple App Store Review Guideline 1.2 and Google Play User Generated Content policy).
- Schema additions needed: `locationPhoto text` (URL, not base64), `locationPhotoApproved boolean default false` on `userLocations`.

### Other 2.0 Candidates
- Social following / friend leaderboards
- Push notifications for streak reminders
- Apple Health / Google Fit integration for heart rate import
- In-app streak sharing / social cards

---

Current ads are Amazon Associates affiliate links (commission-only, no impression revenue).
Once the app reaches **1,000 registered users**, apply for Google AdSense to add impression-based banner revenue:
1. Apply at https://adsense.google.com — site must be coldstreakapp.com
2. Replace the `BannerAd` component in `client/src/components/AdUnit.tsx` with AdSense ad units
3. Keep affiliate ads for Pro users who are also shown gear (or remove ads entirely for Pro — current behavior)
4. AdSense pays per 1,000 impressions (CPM), typically $1–$5 CPM for fitness/health apps
