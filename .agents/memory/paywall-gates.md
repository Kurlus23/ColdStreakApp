---
name: Paywall Gates
description: Full list of features that were behind isPro checks, with file locations, so they can be re-gated later.
---

# ColdStreak Pro Paywall Gates

All paywalls were removed on 2026-07-24 by hardcoding `isPro: true` in the return of `useProStatus()` (`client/src/hooks/use-pro-status.ts`, last line of the hook).

To re-enable paywalls: remove the hardcoded `isPro: true` from the return statement so the real state variable is returned again.

## Feature Gates by File

### `client/src/pages/Home.tsx`
| Feature | Approx Line | Behavior when not Pro |
|---|---|---|
| Streak Freeze | ~3235 | Button disabled / upgrade prompt |
| CSV History Export | ~3364 | Export button hidden / upgrade prompt |
| Full Plunge History | ~3805 | Only last 7 days visible to free users |
| Music Widget / Playlist access | ~2969 | Music widget hidden or restricted |
| Device Connectivity (hardware integrations) | ~5530 | Certain device connections blocked |

### `client/src/pages/Explore.tsx`
| Feature | Approx Line | Behavior when not Pro |
|---|---|---|
| Community discovery / submission | ~1984 | Hidden or upgrade prompt |
| Curated "Passport" bucket-list locations | ~2428 | Hidden or upgrade prompt |

### `client/src/components/PlungeCard.tsx`
| Feature | Approx Line | Behavior when not Pro |
|---|---|---|
| Detailed plunge data overlay | ~171, ~404 | Restricted view / upgrade prompt |

## Upgrade Modals
Triggered via `setShowUpgradeModal(true)` in `Home.tsx` and `Explore.tsx` whenever a gated feature is tapped by a non-pro user.

## Business Subscription Paywall — NOT removed, keep intact
The business subscription system is completely separate from `isPro` and was unaffected by the 2026-07-24 unlock. Do not touch these:
- `requireBusinessOwner` middleware in `server/routes.ts` (~line 994) — gates all `/api/business/:id/*` endpoints
- `bindIapBusinessListing` in `server/storage.ts` (~line 804) — enforces 1/3/10 location capacity with DB-level locking
- `fetchRCVerifiedBusinessEntitlement` in `server/routes.ts` (~line 2325) — server-side RevenueCat verification
- `loc.businessVerified` flag on listings — controls verified badge and public profile visibility
- Public profile gate in `server/routes.ts` (~lines 1164, 1203, 1252) — only `businessVerified` locations get public pages

## How to Re-Gate Regular Pro Features
1. In `client/src/hooks/use-pro-status.ts`, change the return from:
   ```ts
   return { isPro: true, ... };
   ```
   to:
   ```ts
   return { isPro, ... };
   ```
2. All the individual `isPro` checks throughout the files above will automatically enforce the gates again.
