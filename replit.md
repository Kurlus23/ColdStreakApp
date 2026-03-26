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

## v2.0 Roadmap Notes
- **Bitmoji / device photo upload for avatars** — Allow users to upload an image directly from their device (including Bitmoji screenshots). Requires cloud image storage (Cloudinary or similar), privacy policy updates to cover image data collection, ToS clause for user-generated content, and a content moderation plan for App Store / Play Store compliance. Current URL-paste approach intentionally deferred until v2.0.