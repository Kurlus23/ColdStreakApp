---
name: Native timer resume
description: iOS/WebView resume behavior for the active plunge timer when an external music app is opened.
---

# Native Timer Resume

## Rule

When the app returns from an external music app, treat the persisted active-session start timestamp as the source of truth and refresh the visible timer even if the in-memory running ref already says the session is active.

**Why:** iOS can suspend or delay the WebView display updates while the music app is foregrounded. The session itself continues correctly from its wall-clock start time, but guarding resume logic with “only restore if not already running” can leave the visible timer frozen until the app is killed and relaunched.

**How to apply:** On Capacitor app resume and browser visibility/pageshow events, recompute elapsed time from the saved start timestamp. Do not reset accumulated temperature samples when the session was already running.