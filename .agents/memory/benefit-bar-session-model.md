---
name: BenefitBar session carry-over model
description: Design decision for how BenefitBar accumulates cold exposure across multiple plunges in a day.
---

## Rule
BenefitBar carries over prior session time only if the most recent completed plunge finished **within the last 2 hours** (`benefitCarryOver` in Home.tsx). Otherwise it resets to 0 for a fresh bar.

Energy, Mood, Metabolism, and Recovery all progress from the start of a plunge toward independent peak-duration thresholds. A threshold means the benefit window is **maximized**, not that the benefit first begins. Keep the active UI compact: labels belong inside the bars and small color-matched time-to-peak values belong beneath them.

## Why
Each separate plunge triggers its own independent acute response (norepinephrine spike, vasoconstriction, mood lift). Benefits build concurrently rather than appearing as a sequential checklist. Benefits from a 6am session have largely dissipated by the afternoon — stacking all of today's plunges onto one bar would imply a continuous physiological cascade that doesn't exist.

The 2-hour window captures the legitimate "interrupted session" case (got too cold, took a short break) where the thermal dose really is still in progress. Three separate daily plunges (morning / afternoon / evening) each get their own independent bar.

## How to apply
- `benefitCarryOver` is computed from `todayPlunges` in Home.tsx right after `todayTotalSec`.
- Passed to `<BenefitBar todayLoggedSeconds={benefitCarryOver} />`.
- If the window needs tuning, change the `2 * 60 * 60 * 1000` ms constant in that IIFE.
- The bar is always rendered (even pre-plunge, dim segments) so the layout never shifts.
- Preserve each benefit's temperature/body-adjusted duration and independent decay; only the progression model is concurrent.
- Adaptation Zone begins only after every benefit window is maximized.
