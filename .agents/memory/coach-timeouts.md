---
name: Coach request timeouts
description: Reliability rules for the ColdStreak AI coach when provider or network requests stall.
---

AI coach requests must have bounded time at the provider, server route, and client UI. Provider fallbacks should share a total deadline instead of allowing every model attempt to hang independently.

**Why:** An unbounded provider fetch left the chat typing indicator active for several minutes, making the coach appear offline without giving the user a retry path.

**How to apply:** Keep the client timeout slightly longer than the server timeout, map timeout responses to a clear retry message, and ensure retry requests do not duplicate the current message in conversation history.