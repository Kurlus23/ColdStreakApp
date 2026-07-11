---
name: Mockup sandbox gotchas
description: Pitfalls when building mockups in the isolated mockup sandbox (imports, screenshot caching)
---

# Imports must exist in the sandbox's own package.json

**Rule:** In mockup components, only import packages listed in `artifacts/mockup-sandbox/package.json` (lucide-react, shadcn/ui, etc.). Anything else (e.g. `react-icons`) silently resolves from the main app's root `node_modules` and pulls in a second copy of React, crashing every preview with "A React Element from an older version of React was rendered."

**Why:** Vite walks up to the workspace root node_modules when a package isn't found locally — no build error, only a runtime error overlay.

**How to apply:** For brand icons, inline an SVG (simple-icons path data) instead of importing react-icons. If a package is truly needed, add it to the sandbox package.json and `npm install` there.

# External-URL screenshots can be cached

The screenshot tool may return a stale cached image for a URL you already screenshotted. When re-verifying after a fix, append a cache-busting query param (e.g. `?v=2`) before concluding the fix didn't work.
