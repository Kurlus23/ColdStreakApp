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
| `user_locations` | id, name, country, state, city, latitude, longitude, nominationCount |

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
| `client/src/pages/Explore.tsx` | Chill Places + community locations |
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
| `STRIPE_PRICE_ID` | Secret | Stripe price ID for Pro |
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
- Bluetooth thermometer support (e.g., Govee, SensorPush) via **Web Bluetooth API** (Chrome/Android) or Capacitor Bluetooth plugin
- Auto-fill temperature field when timer starts
- Could display live temp on timer screen during plunge
- iOS Web Bluetooth not supported — would need native Capacitor plugin
