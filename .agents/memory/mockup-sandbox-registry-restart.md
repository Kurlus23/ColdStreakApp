---
name: Mockup sandbox registry needs workflow restart
description: New mockup component files only appear in preview URLs after restarting the mockup sandbox workflow.
---

The mockup sandbox preview registry only regenerates on server start.

**Why:** Adding a new component file under `artifacts/mockup-sandbox/src/components/mockups/` does not hot-register a new `/__mockup/preview/...` route; the frame renders blank until the registry rebuilds. This caused blank canvas iframes twice.

**How to apply:** After adding (not just editing) mockup files, restart the "artifacts/mockup-sandbox: Component Preview Server" workflow before screenshotting or embedding iframes. Also: preview URLs must be screenshotted with `type: external_url` (app_preview only hits the main app), and the service worker (`client/public/sw.js`) must bypass `/__mockup` paths (already done, cache v10).
