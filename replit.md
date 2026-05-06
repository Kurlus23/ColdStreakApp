# ColdStreak

ColdStreak is a cold plunge tracking web application, PWA, and Android app that helps users log sessions, monitor progress, set goals, and connect with a community.

## Run & Operate

*   **Run Dev**: `npm run dev`
*   **Build**: `npm run build`
*   **Typecheck**: `npm run typecheck`
*   **Codegen (Drizzle)**: `npm run generate-drizzle`
*   **DB Push (Drizzle)**: `npm run db:push`
*   **Environment Variables**: `VITE_API_URL`, `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `POSTHOG_API_KEY`, `SENTRY_DSN`, `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID`, `APPLE_MUSIC_PRIVATE_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET`, `SITE_URL`.

## Stack

*   **Frontend**: React 18, TypeScript, Vite, `wouter`, TanStack React Query, `shadcn/ui`, Tailwind CSS.
*   **Backend**: Express.js, TypeScript.
*   **Runtime**: Node.js (version specified in `package.json`).
*   **ORM**: Drizzle ORM.
*   **Validation**: _Populate as you build_
*   **Build Tool**: Vite.

## Where things live

*   `/client`: Frontend source code.
*   `/server`: Backend source code.
*   `/shared`: Shared types, schemas, and API contracts.
*   `./shared/schema.ts`: Database schema definitions.
*   `./shared/routesManifest.ts`: Typed API contract.
*   `./client/src/theme/tailwind.config.js`: Tailwind CSS configuration including custom theme.
*   `./client/src/index.html`: Main HTML file for PWA manifest and script injection.
*   `./capacitor.config.ts`: Capacitor configuration for Android app.

## Architecture decisions

*   **Device Identity**: Uses `clientId` for anonymous tracking, linkable to `userId` upon account creation.
*   **UI/UX Theme**: `shadcn/ui` with custom dark navy/cyan theme using DM Sans and Outfit fonts.
*   **Mobile Strategy**: Web app wrapped by Capacitor for Android, ensuring a consistent codebase.
*   **External Music Integrations**: No server-side OAuth or token storage for Apple Music. Spotify uses Authorization Code flow with server-side token management.
*   **Store Compliance**: Subscription and account deletion UX branches by platform (iOS, Android, Web) for deep linking to respective store management.
*   **Crawler Optimization**: Dynamic SVG for Open Graph images and crawler-specific HTML injection with `Vary: User-Agent` header to prevent caching issues.

## Product

*   **Plunge Tracking**: Log sessions, monitor "Cold Score" and streaks.
*   **Gamification**: Weekly goals, achievements, leaderboards.
*   **Community**: Directory of "Chill Places" (curated and user-submitted).
*   **Pro Features**: Ad-free experience, unlimited history, streak freezes.
*   **Timer Functionality**: Stopwatch and countdown timers with background persistence across process kills.
*   **Bluetooth Thermometer Support**: Integrates with Inkbird IBS-TH2 Plus and similar devices.
*   **Business Owner Dashboard**: Manage verified listings, view analytics, manage co-managers, and generate public profile pages.
*   **Music Integration**: Connects with Spotify and Apple Music to auto-play playlists with timer sessions.

## User preferences

Preferred communication style: Simple, everyday language.

## Gotchas

*   `app.set("trust proxy", 1)` is crucial in `server/index.ts` for correct `req.ip` resolution on Replit.
*   Outbound URLs are built from `getCanonicalOrigin()` (env `SITE_URL`) to prevent Host-header poisoning; never use `req.get("host")`.
*   Spotify callback uses a signed JWT state token for CSRF protection; ensure `SESSION_SECRET` is configured.
*   Streak freezes are a Pro feature and are limited to 2 per calendar month, with a 1-6 day backward window.

## Pointers

*   **React Query Docs**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
*   **Drizzle ORM Docs**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
*   **Tailwind CSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
*   **Capacitor Docs**: [https://capacitorjs.com/docs](https://capacitorjs.com/docs)
*   **Stripe Docs**: [https://stripe.com/docs](https://stripe.com/docs)
*   **PostHog Docs**: [https://posthog.com/docs](https://posthog.com/docs)
*   **Sentry Docs**: [https://docs.sentry.io/](https://docs.sentry.io/)
*   **MusicKit JS Docs**: [https://developer.apple.com/documentation/musickitjs](https://developer.apple.com/documentation/musickitjs)
*   **Spotify Web API Docs**: [https://developer.spotify.com/documentation/web-api/](https://developer.spotify.com/documentation/web-api/)