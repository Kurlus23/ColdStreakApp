---
name: Post-plunge photo capture intentionally removed
description: The photo take/upload UI was deliberately removed from the post-plunge sheet; leftover photo code is dormant, not a regression.
---

The post-plunge "Plunge Complete" sheet in the Home page has NO photo capture/upload UI by design.

**Why:** Photo functionality was intentionally removed in an earlier session (commit message: "Make user activity rows sortable and remove photo functionality"). Leftover code (`promptPhotoData`, `startWebCamera`, `photoInputRef`, share-image compositing paths) still exists but has no user-facing entry point from the sheet — only the camera-flip button inside the web-camera overlay references `startWebCamera`.

**How to apply:** If a code review or test flags "missing photo capture on the post-plunge sheet" as a regression, verify against history first — it is pre-existing and deliberate. Don't re-add photo UI unless the user asks. Test IDs on the sheet that must be preserved: `button-save-photo`, `button-skip-photo`, `button-share-after-plunge`, `button-discard-plunge`, `card-xp-progress`, `card-cold-take-unlocked`, `select-location`.
