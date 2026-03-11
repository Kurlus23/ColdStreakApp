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

- ✅ Step 1 — Deploy (free tier on Replit)
- ✅ Step 2 — Privacy policy + Terms of Service pages
- ✅ Step 3 — PostHog analytics
- ✅ Step 4 — Sentry error monitoring
- 🔧 Step 5 — Android build (Capacitor configured; run `ANDROID_BUILD.md` steps locally)
- ✅ Step 6 — First-launch onboarding flow
- ✅ Step 7 — Account login + data sync
- ⬜ Step 8 — Stripe live mode
- ⬜ Step 9 — Custom domain (~$12)
