# ColdStreak

## Overview
ColdStreak is a cold plunge tracking web application, PWA, and Android app. It allows users to log cold plunge sessions, monitor "Cold Score" and streaks, set weekly goals, earn achievements, and participate in leaderboards. The app also features a directory of curated and community-submitted "Chill Places." A Pro version offers an ad-free experience and unlimited history. The project aims to be a comprehensive platform for cold plunge enthusiasts.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, using Vite.
- **Routing**: `wouter`.
- **State Management & Data Fetching**: TanStack React Query.
- **UI/UX**: `shadcn/ui` (New York style) on Radix UI, styled with Tailwind CSS, custom dark navy/cyan theme. Fonts are DM Sans and Outfit.
- **PWA**: `manifest.json` and service worker for mobile installation.
- **Mobile App**: Capacitor wraps the web app for Android.

### Backend
- **Framework**: Express.js with TypeScript.
- **Authentication**: JWT for tokens, bcrypt for password hashing.
- **API Endpoints**: RESTful APIs for user management, plunge tracking, leaderboards, community locations, and Stripe integration.
- **Storage Layer**: `IStorage` interface with `DatabaseStorage` using Drizzle ORM.

### Shared Layer
- **Schema**: Defines database schemas for `users`, `plunges`, `leaderboardEntries`, `proUsers`, `userLocations`, `events`, and `event_participants`.
- **Routes Manifest**: Provides a typed API contract.

### Device Identity
Uses a `clientId` for anonymous plunge tracking, linkable to a `userId` upon account creation.

### UI/UX Decisions
- **Home Screen Background**: Dynamic background images from `attached_assets/`. Future plans include a customizable wallpaper system for users.
- **Avatar/Profile Photos**: Currently uses URL field to avoid file storage.

### Feature Specifications
- **Smartwatch Companion Apps**: Planned for Apple Watch, Garmin, and Amazfit, focusing on timer control and HR sensing. The watch acts as a remote control, with data storage and Cold Score calculation remaining on the phone app.
- **Bluetooth Thermometer Support**: Currently supports Inkbird IBS-TH2 Plus via BLE advertisement scanning. Includes logic to support off-brand thermometers that mimic Inkbird's advertising but use a different encoding, as well as robust reconnection and diagnostic features.
- **Business Owner Dashboard** (`/business`): Verified-listing owners sign in with their existing ColdStreak account; access is granted when their account email matches the listing's `contactEmail` (case-insensitive). Shows views, plunges, unique plungers, click breakdown (website/booking/directions/phone/yelp/facebook/share), trend chart (7/30/90-day window via recharts), and a leaderboard for plunges at that location. Includes listing deletion, account deletion link, and Apple-compliant subscription management links. Backed by `location_views` + `location_clicks` event log tables (cascade-delete from `user_locations`) plus the canonical `viewCount` on `user_locations` for all-time views. Conditional nav button appears in the user menu only when the signed-in account owns at least one verified listing. Query keys are scoped to `auth.user.id` and the cache is cleared on logout/forced-logout to prevent cross-account data leak.
- **Business Owner v1 Expansion**: Public profile pages at `/biz/:slug` (SEO meta tags, hours-aware "open now" badge with overnight wrap, click-tracked website/booking/directions/phone links, top-10 leaderboard). Owner dashboard panels: Share & QR (downloadable QR PNG, copy URL, native share, slug auto-generation), Hours Editor (7-day grid with closed-flag + per-listing IANA timezone via curated `<select>`), Co-managers (email allowlist; access shared with verified owners; adds trigger a one-time invite email via Resend), CSV Export (sortable by best score / period plunges / lifetime / last seen — privacy-safe with anonymized identity hashes only, no email/userId/clientId leakage). Admins (isAdmin) see all verified listings and can manage any listing's co-managers for support. Schema additions: `userLocations.slug` (unique nullable text), `userLocations.hours` (jsonb — `BusinessHours` shape, cast at read sites), `userLocations.timezone` (text nullable, IANA TZ — `isOpenNow` uses `Intl.DateTimeFormat` to resolve), `userLocations.coManagerEmails` (text[]).
- **Business Owner v1 Polish**: Boot-time slug backfill for any verified listing missing one. Rate-limited click endpoint (`POST /api/community-locations/:id/click` — 30/min/IP/listing, 429 on excess). Open Graph link previews: dynamic 1200×630 SVG at `GET /api/og/biz/:slug.svg` plus a crawler-only HTML middleware at `GET /biz/:slug` that injects `og:`/`twitter:` meta tags for known social-media UAs (Facebook/Twitter/LinkedIn/Slack/WhatsApp/Telegram/Discord/Google/Bing/DuckDuckGo/Apple/Pinterest/Reddit/Embedly); browsers fall through to the SPA. Terms/Privacy gained "Verified Business Listings" sections.
- **Hardening**: `app.set("trust proxy", 1)` in `server/index.ts` so `req.ip` resolves to the real client IP behind exactly one trusted hop (Replit's deployment edge). Outbound URLs in invite emails and OG/crawler HTML are built from a single `getCanonicalOrigin()` helper (env `SITE_URL`, default `https://coldstreakapp.com`) — never from `req.get("host")` — to prevent Host-header poisoning. The crawler-vs-browser HTML at `/biz/:slug` sends `Vary: User-Agent` so shared caches don't serve the wrong variant to the wrong audience.
- **Store-Compliance Parity (iOS / Android / Web)**: Subscription-management UX, auto-renew disclosure, and account-deletion cancel-billing guidance branch three ways on `Capacitor.getPlatform()` rather than "iOS vs everything else." iOS deep-links to `itms-apps://apps.apple.com/account/subscriptions`; Android deep-links to `https://play.google.com/store/account/subscriptions` (which the Play Store app intercepts); web opens the Stripe billing portal. The auto-renew disclosure inside the Pro upgrade modal cites Apple ID + iPhone Settings on iOS, Google Play account + Play Store path on Android, and Stripe + Settings on web. Both the in-app delete-account modal in `Home.tsx` and the standalone `/delete-account` page list iPhone, Android, and Web cancellation paths. The BusinessDashboard "Manage subscription" panel exposes all three store deep-links unconditionally so co-managers/admins can route owners regardless of which platform they originally subscribed on.

## External Dependencies
- **PostgreSQL**: Primary database, accessed via Drizzle ORM.
- **Stripe**: For Pro subscription payments.
- **PostHog**: Analytics and event tracking.
- **Sentry**: Error monitoring.
- **Capacitor**: For native Android app wrapping.
- **Google Fonts**: For DM Sans and Outfit typefaces.
- **`jsonwebtoken`**: For JWT authentication.
- **`bcryptjs`**: For password hashing.
- **`@capacitor-community/media`**: For camera roll interactions.
- **`piexifjs`**: For embedding EXIF data.