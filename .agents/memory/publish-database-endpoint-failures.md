---
name: Publish database endpoint failures
description: How to distinguish a paused production database endpoint from a code or build failure during publishing.
---

When a publish builds and pushes its image successfully but promotion repeatedly returns HTTP 500 with PostgreSQL code `28000` and “The endpoint has been disabled,” treat it as a database endpoint availability issue before changing application code.

**Why:** A paused or temporarily disabled production database endpoint prevents startup database work and causes the root health check to fail, even though compilation and bundling succeeded.

**How to apply:** Confirm production database reachability, check for conflicting database configuration without exposing credentials, and retry publishing once the production database is unpaused. Do not modify runtime-managed database variables manually.