---
name: Mood check-in & push conventions
description: How scheduled pushes, plunge ownership, and db:push quirks work in ColdStreak
---

## Scheduled pushes ride the existing web-push pipe
The app's only push infra is web push (sw.js + `webpush` on the server, subscriptions in `push_subscriptions` keyed by userId/clientId). New timed notifications (e.g. the 1-hour mood check-in) should be implemented as a server-side minute sweeper, NOT a native local-notifications plugin.
**Why:** No @capacitor/local-notifications is installed; adding it forces a new native build. The sweeper pattern (query due rows → atomic conditional UPDATE with RETURNING to claim → send) prevents duplicate sends across restarts and races with user answers.
**How to apply:** Copy the mood sweeper pattern in server/routes.ts; always stamp a `*_prompted_at` column atomically before sending.

## Plunge mutation ownership
PATCH/DELETE /api/plunges/:id enforce ownership via `assertPlungeOwnership`: userId-linked rows need a matching JWT, clientId-linked rows need a matching `X-Client-Id` header (sent automatically by `buildHeaders()` in use-plunges.ts). Legacy null/null rows are allowed.
**Why:** Deep-link URLs like `/?mood=<id>` expose row IDs, so ID-guessing must not permit writes.
**How to apply:** Any new plunge-mutating route must call `assertPlungeOwnership` first.

## db:push hangs on an interactive prompt
`npm run db:push` stalls on a churn_surveys unique-constraint prompt that can't be answered non-interactively.
**How to apply:** For simple additive columns, run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via psql instead, keeping schema.ts in sync.
