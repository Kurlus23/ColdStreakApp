/**
 * Shared nudge message strings — single source of truth for title/body copy
 * used by both the server-side push notification (server/nudge.ts) and the
 * in-app card (client/src/components/TryThisNextCard.tsx).
 *
 * Keeping both sides in this file means any copy change is made once and any
 * accidental divergence fails to compile rather than silently reaching users.
 *
 * Note on trending-up: the client renders a temperature-aware personalised
 * nudge via trendingUpNudge().  The server push uses the generic fallback
 * below.  This intentional difference is acceptable; the personalised copy is
 * additional context, not a contradiction of the push content.
 */

export const NUDGE_MESSAGES = {
  /** Generic trending-up copy — used by the server push and as the client
   *  fallback when recent averages are unavailable. */
  trendingUp: {
    title: "Ready for a challenge",
    body:  "Your check-in scores are trending up — consider dropping 2–3°F or adding 30 seconds to your next session and see how you feel.",
  },

  trendingDown: {
    title: "Listen to your body",
    body:  "Your recent check-in ratings have dipped a little. Try dialling back slightly — a warmer temperature or shorter duration can help you stay consistent without burning out.",
  },

  holdingSteady: {
    title: "Stay the course",
    body:  "Your ratings have been consistent — you're in a solid rhythm. Commit to your current temperature and duration for another few sessions before experimenting.",
  },

  sweetSpot: {
    title: "Hit your sweet spot",
    bodyTemplate: (tempLabel: string, durLabel: string) =>
      `Your sweet spot so far is ${tempLabel} for ${durLabel} — try to hit it in your next 3 plunges and keep the momentum going.`,
  },
} as const;
