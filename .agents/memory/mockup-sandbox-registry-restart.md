---
name: Mockup sandbox registry needs workflow restart
description: New mockup component files only appear in preview URLs after restarting the mockup sandbox workflow.
---

The mockup sandbox preview registry only regenerates on server start.

**Why:** Adding a new component file under `artifacts/mockup-sandbox/src/components/mockups/` does not hot-register a new `/__mockup/preview/...` route; the frame renders blank until the registry rebuilds. This caused blank canvas iframes twice.

**How to apply:** After adding (not just editing) mockup files, restart the "artifacts/mockup-sandbox: Component Preview Server" workflow before screenshotting or embedding iframes. Also: preview URLs must be screenshotted with `type: external_url` (app_preview only hits the main app), and the service worker (`client/public/sw.js`) must bypass `/__mockup` paths (already done, cache v10).

If the managed restart instead fails before launch with repeated `rg` errors for missing `.local/skills/.old-*` paths, the sandbox source has not started and recreating those paths does not fix the runner cache. A temporary preview can run directly on the workspace's mapped port 5173; use the `https://<development-domain>:5173/__mockup/preview/...` URL for Canvas embeds and external screenshots.

**Why:** The workflow runner's stale path scan is separate from Vite. Local Vite can render the components correctly while the normal no-port preview route remains blank.

**How to apply:** Treat this as a workspace-service issue, not a mockup rendering failure. Verify the component locally first, then use the mapped-port preview only as a temporary design-session recovery path; do not modify production UI or release configuration to work around it.
