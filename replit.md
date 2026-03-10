# OpenPlunge

## Overview

OpenPlunge is a cold plunge tracking web app. It lets users time their cold plunge sessions (with both a stopwatch and a countdown timer), log each session with duration and water temperature, and then view their plunge history. The app calculates a "plunge score" based on how long and how cold the session was, tracks daily streaks, and monitors weekly exposure minutes toward a goal. A confetti celebration fires when a plunge is logged.

The project is a full-stack TypeScript app with a React frontend and an Express backend, sharing types and validation schemas through a `shared/` directory. Data is persisted in a PostgreSQL database via Drizzle ORM.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side router). There's one main route (`/`) pointing to the `Home` page and a catch-all 404 page.
- **State & Data Fetching**: TanStack React Query handles server state. Custom hooks `usePlunges` and `useCreatePlunge` in `client/src/hooks/use-plunges.ts` encapsulate all API calls.
- **UI Components**: shadcn/ui (New York style) built on top of Radix UI primitives. Tailwind CSS handles styling with a custom dark "ice/cold" theme (deep navy + cyan accents) defined in CSS variables.
- **Fonts**: DM Sans (body) and Outfit (display) from Google Fonts.
- **PWA**: A `manifest.json` is present for standalone mobile install support.
- **Confetti**: `canvas-confetti` fires a celebration effect when a plunge is successfully logged.

### Backend

- **Framework**: Express.js running on Node.js with TypeScript (via `tsx` in dev).
- **API Routes**: Defined in `server/routes.ts`. Two endpoints:
  - `GET /api/plunges` — returns all plunges ordered by newest first
  - `POST /api/plunges` — validates input with Zod and creates a new plunge record
- **Storage Layer**: `server/storage.ts` defines an `IStorage` interface with a `DatabaseStorage` implementation using Drizzle ORM queries. This abstraction makes it easy to swap the storage backend if needed.
- **Dev Server**: In development, Vite runs as middleware inside the Express server (via `server/vite.ts`), so there's a single server for both API and frontend.
- **Production Build**: `script/build.ts` runs Vite for the client and esbuild for the server, bundling key server dependencies to reduce cold-start time.

### Shared Layer (`shared/`)

- **Schema** (`shared/schema.ts`): Drizzle table definitions and Zod-inferred TypeScript types. The single `plunges` table has: `id`, `duration` (seconds), `temperature` (°F), `score` (numeric), `createdAt`.
- **Routes manifest** (`shared/routes.ts`): A typed API route registry (`api` object) with path, method, input schema, and response schemas defined in one place. Both client hooks and server routes import from here, keeping the API contract in sync automatically.

### Database

- **PostgreSQL** via the `pg` driver and Drizzle ORM.
- Connection via `DATABASE_URL` environment variable.
- Migrations managed with `drizzle-kit` (`db:push` script for development).
- Schema file: `shared/schema.ts`.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Shared `routes.ts` for API contract | Single source of truth for paths, input/output schemas; both client and server validate against the same Zod schemas |
| Drizzle ORM + PostgreSQL | Type-safe queries, minimal boilerplate, easy schema evolution with `drizzle-kit` |
| `IStorage` interface | Decouples route logic from database implementation; easy to swap in a mock for testing |
| Single Express server serves both API and Vite in dev | Simpler dev setup; no CORS issues; HMR still works via Vite middleware |
| TanStack React Query | Handles caching, refetching, and mutation state without manual `useEffect` plumbing |
| shadcn/ui + Tailwind | Accessible, unstyled-then-restyled component primitives; custom design tokens applied via CSS variables |

---

## External Dependencies

### Runtime Services
- **PostgreSQL database** — Required. Must be provisioned and `DATABASE_URL` set as an environment variable before the app will start.

### Key npm Dependencies

| Package | Purpose |
|---|---|
| `drizzle-orm` + `drizzle-kit` | ORM and migration tooling for PostgreSQL |
| `drizzle-zod` | Auto-generates Zod schemas from Drizzle table definitions |
| `zod` | Runtime validation for API inputs and outputs |
| `express` | HTTP server and API routing |
| `@tanstack/react-query` | Client-side server state management |
| `wouter` | Lightweight React router |
| `canvas-confetti` | Celebration animation on plunge log |
| `date-fns` | Date formatting in the history view |
| `radix-ui/*` (many packages) | Accessible UI primitives underlying shadcn/ui components |
| `tailwind-merge` + `clsx` | Utility for merging Tailwind class names safely |
| `lucide-react` | Icon set used throughout the UI |
| `@replit/vite-plugin-*` | Replit-specific dev tooling (runtime error overlay, cartographer, dev banner) |

### External APIs / CDNs
- **Google Fonts** — Loaded via `<link>` tags in `client/index.html` for DM Sans, Outfit, Fira Code, and Geist Mono fonts. Requires internet access at page load (no self-hosting).

### No Authentication
The app currently has no user authentication or session management. All plunge data is shared/global.