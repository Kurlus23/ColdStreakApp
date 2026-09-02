---
name: Coach response normalization
description: Defensive handling for AI coach responses that do not honor the requested JSON format.
---

AI provider output must be normalized at the API boundary and again before display. Even with an explicit JSON-only prompt, responses may arrive fenced, truncated before the closing delimiter, or nested inside a reply string. Persist only the unwrapped reply so a malformed response does not keep resurfacing in chat history.

**Why:** The coach provider returned incomplete JSON envelopes, which made the UI show raw `{"reply": ...}` text and made answers appear abruptly short.

**How to apply:** Keep tolerant parsing and display-time sanitization in place whenever the provider response is rendered or sent back through chat history. Prompt for complete multi-sentence answers, but do not rely on the prompt alone.