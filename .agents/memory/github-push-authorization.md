---
name: GitHub push authorization
description: Recovery note for a GitHub remote that can fetch but rejects pushes.
---

The repository's HTTPS GitHub remote may still fetch successfully while push fails with GitHub's `Invalid username or token` error. In that state, the Replit GitHub OAuth connection can appear healthy and include the `repo` scope while the credential exposed to Git is unusable.

**Why:** A stale or invalid Git credential affects write operations separately from read access; changing remotes or local branches does not repair it.

**How to apply:** Confirm the remote URL and `git ls-remote` first. If fetch works but `git push --dry-run` reports invalid credentials, use the existing GitHub integration's OAuth reauthorization flow. Do not ask the user to paste a token into chat.