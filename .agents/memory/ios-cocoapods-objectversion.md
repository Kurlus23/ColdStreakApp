---
name: iOS CocoaPods objectVersion=70 vs 56
description: Recurring Mac build failure — CocoaPods can't read Xcode-written objectVersion 70; must downgrade to 56 before every cap sync.
---

# CocoaPods "Unable to find compatibility version string for object version `70`"

On the ColdStreak Mac build (Xcode 26.x + CocoaPods 1.16.x), `npx cap sync ios` fails
during `pod install` with `[Xcodeproj] Unable to find compatibility version string for
object version 70`.

**Cause:** Xcode 26.x writes `objectVersion = 70;` into
`ios/App/App.xcodeproj/project.pbxproj`. The xcodeproj gem bundled with CocoaPods 1.16.x
only understands up to ~56, so pod install crashes.

**Fix — run BEFORE every `npx cap sync ios`:**
```
sed -i '' 's/objectVersion = 70;/objectVersion = 56;/g' ios/App/App.xcodeproj/project.pbxproj
```

**Why it RECURS (the trap):** Xcode rewrites objectVersion back to 70 every time it opens
or modifies the project (e.g. opening to Archive, bumping the build number). So a single
sed is NOT enough — it must be re-applied whenever Xcode has touched the project, i.e.
right before each cap sync. Do NOT tell the user to skip the sed step "because nothing
changed" — opening Xcode alone is enough to revert it.

**Note:** `ios/` is gitignored, so this never travels through git; it's a per-checkout
Mac-local fix.
