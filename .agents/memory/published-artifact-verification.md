---
name: Published artifact verification
description: Production can report a successful deployment while public domains still serve an older hashed frontend bundle.
---

When a visual change is supposed to be live, verify the HTML and referenced hashed JavaScript from the actual production URL. A successful deployment status and a “Published your App” commit are not sufficient evidence that the active public artifact advanced.

**Why:** A publish attempt created a deployment marker and reported a successful deployment, but both the custom production domain and its generated Replit domain continued returning an older HTML asset and JavaScript bundle. The stale bundle still contained the previous Home layout while the published source contained the new layout.

**How to apply:** Before asking the user to refresh a phone or republish again, compare a distinctive source marker or hashed asset from the local build with both public domains. If both domains serve the old bundle, investigate Publishing build activation/history rather than service-worker or device caching.