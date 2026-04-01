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
- **user_locations**: Stores information about community-contributed chill places and business listings.
- **events**: Community cold plunge events with name, description, date, location, and a 6-char alphanumeric share code.
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
- **Remove `kurlus23@gmail.com` from admin** — After go-live, only `CStreak28` (`coldstreakapp17@gmail.com`) should be admin. Remove `kurlus23@gmail.com` from the `ADMIN_EMAILS` list in `server/routes.ts` and from any admin-seed logic in `server/storage.ts`.
- **Delete `seedTestVerifiedBusiness()`** — Remove the test verified business seed call before production launch.
- **Activate Stripe Customer Portal** — Must be enabled in the Stripe dashboard before subscription management goes live.
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

## v2.0 Roadmap Notes
- **Bitmoji / device photo upload for avatars** — Allow users to upload an image directly from their device (including Bitmoji screenshots). Requires cloud image storage (Cloudinary or similar), privacy policy updates to cover image data collection, ToS clause for user-generated content, and a content moderation plan for App Store / Play Store compliance. Current URL-paste approach intentionally deferred until v2.0.