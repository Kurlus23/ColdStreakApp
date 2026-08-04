---
name: Plunge overlay — challenge vs solo design
description: Deliberate design decisions for how the plunge screen differs between solo and challenge mode.
---

# Plunge Overlay — Challenge vs Solo Design

## The rule
- **Solo plunge**: no ring at all. Timer floats freely. Benefit bar is the only progress indicator, carrying a live countdown header ("🔥 Metabolism — 2:24 remaining") in the active segment's colour.
- **Challenge plunge**: ring visible (benefit arc or PB arc). Two floating score boxes at the bottom of the ring area ("You" / opponent first name) with cyan glow when winning, warm pink when losing. Status pill below timer. Cold takes drawn from the CHALLENGE pool with opponent name substituted.

**Why:** Ring-for-challenge was a deliberate UX call — the ring adds visual weight that feels right when competing but distracts from the clean solo focus. The benefit bar countdown replaces the ring's 12-o'clock goal marker for solo sessions.

## How to apply
- Gate `<ChallengeRing>` render on `!!challengerName` in `PlungeOverlay.tsx`.
- `challengerName` prop is only non-null when `activeChallengerUserId !== null` (set in Home.tsx) — cleared when plunge completes or user taps "✕ dismiss".
- Score boxes are gated the same way (`{challengerName && ...}`).
- `BenefitBar` shows the countdown header whenever `isActive && activeSegIdx >= 0 && !allDone`.
- Cold takes: `ColdTakeOverlay` checks `challengerName` before calling `pickChallengeColdTake`; milestone takes still interrupt in both modes.
- Challenge cold take card header: "⚔ Challenge Take" (vs "❄ Cold Take" for solo).
