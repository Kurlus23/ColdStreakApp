---
name: Analytics instrumentation
description: How ColdStreak keeps product events available in both existing PostHog and Replit-hosted analytics.
---

The shared analytics wrapper should forward privacy-safe product events to both the existing PostHog client and Replit's injected Umami tracker. Replit-hosted analytics cannot query events that are sent only to PostHog.

**Why:** A custom-event query returned no rows even though the app had a PostHog wrapper; the two analytics systems are separate collection paths.

**How to apply:** Add meaningful interaction/outcome events through the shared wrapper, use only primitive non-PII dimensions, and verify analytics after the app is republished.