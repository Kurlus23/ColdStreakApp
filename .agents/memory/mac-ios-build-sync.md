---
name: Mac iOS build sync gotchas
description: Lessons from getting the user's Mac Xcode build in sync with Replit (git remote, lockfile registry URLs, Node version, CocoaPods)
---

# Mac iOS build sync gotchas

Chain of issues hit when syncing Replit → GitHub → user's Mac for iOS builds (July 2026):

1. **Wrong git remote on the Mac.** The Mac clone pointed at an old repo (`coldstreakapp/ColdStreak`) instead of the real one (`Kurlus23/ColdStreakApp`). Symptom: pulls "succeed" but code stays stale, package counts differ.
   **How to apply:** if the Mac seems stale despite pulls, check `git remote -v` first.

2. **package-lock.json can contain Replit-internal URLs.** npm installs on Replit write `http://package-firewall.replit.local/npm/...` as resolved URLs for newly added packages. On any machine outside Replit, npm retries these forever (ENOTFOUND) and the install hangs.
   **Why:** Replit routes npm through an internal proxy.
   **How to apply:** after adding packages on Replit, before the user pulls on their Mac, run `sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json`. Check with `grep -c package-firewall package-lock.json`.

3. **Node version on the Mac must be LTS.** Node 25.x + npm 11 crashed with "Exit handler never called" and left node_modules half-installed. Fixed via `brew install node@22` + unlink/link. Replit runs Node 20.
   **How to apply:** if npm crashes mysteriously on the Mac, check `node -v`; keep the Mac on Node 22 LTS.

4. **CocoaPods spec repo staleness.** New RevenueCat versions need `pod install --repo-update` (run in `ios/App`) or CocoaPods can't find the pinned `PurchasesHybridCommon` version.

5. **Push order matters and must be verified.** Main agent cannot push; the user must click "Sync Changes" in the Replit Git pane (the plain Push button can be greyed out — Sync Changes is the one that works). Verify from Replit with `git log --oneline -1 github/main` before telling the user to pull. Every fix follows: Replit edit → Sync Changes → `git pull` on Mac.

Healthy end state: `npx cap sync ios` on the Mac lists **11 plugins** including `@revenuecat/purchases-capacitor` and `coldstreak-musickit` (installed via `npm install ./capacitor-plugins/coldstreak-musickit`).
