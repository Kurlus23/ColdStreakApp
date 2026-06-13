---
name: Capacitor iOS plugin method registration
description: Every @objc Swift plugin method must ALSO be listed in the .m bridge file or JS calls silently no-op.
---

# Capacitor iOS plugin: methods need ObjC bridge registration

For a Capacitor iOS plugin, defining an `@objc func foo(_ call: CAPPluginCall)` in the
Swift file is NOT enough. Each method must ALSO be registered in the ObjC bridge
`.m` file via `CAP_PLUGIN_METHOD(foo, CAPPluginReturnPromise);` inside the
`CAP_PLUGIN(...)` macro. If it is missing there, Capacitor cannot see the method:
the JS-side proxy call rejects/throws and (when wrapped in try/catch returning
false) the action silently does nothing.

**Why:** The `coldstreak-musickit` plugin had `playPlaylist` registered but
`pause/resume/skipNext/skipPrevious/stop` were implemented in Swift yet absent
from the `.m`. Result: Play worked on device, all transport controls silently
failed — looked like a logic bug but was a registration gap.

**How to apply:** Whenever you add or rename an `@objc` method in a Capacitor
plugin's Swift file, immediately mirror it with a `CAP_PLUGIN_METHOD` line in the
matching `.m`. Changes require a fresh `npx cap sync ios` + native rebuild
(TestFlight) to reach devices — they will not appear via OTA/web.
