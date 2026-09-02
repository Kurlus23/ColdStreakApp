---
name: Analytics instrumentation
description: How ColdStreak keeps product events available in both existing PostHog and Replit-hosted analytics.
---

The shared analytics wrapper should forward privacy-safe product events to both the existing PostHog client and Replit's injected Umami tracker. Replit-hosted analytics cannot query events that are sent only to PostHog.

Meaningful product events use outcome-oriented names (`plunge_started`, `plunge_completed`, `goal_set`, `benefit_completed`, `brain_freeze_completed`, and focused screen/location events). Generic UI state changes such as menu toggles and tab changes should not become custom events.

Authenticated PostHog identity is the internal ColdStreak user ID only. Event properties must stay primitive and privacy-safe; never add email, names, health data, question/journal text, or precise location.

**Why:** A custom-event query returned no rows even though the app had a PostHog wrapper; the two analytics systems are separate collection paths.

**How to apply:** Add meaningful interaction/outcome events through the shared wrapper, use only primitive non-PII dimensions, keep completion events behind once-per-session guards, and verify analytics after the app is republished.