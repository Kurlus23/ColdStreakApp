import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined;

type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: Record<string, AnalyticsValue>): void;
    };
  }
}

export function initPostHog() {
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-01-30",
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug();
    },
  } as const);
}

export { posthog };

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    if (POSTHOG_KEY) posthog.capture(event, properties);
  } catch {
    // Analytics must never break the app.
  }

  try {
    const data: Record<string, AnalyticsValue> = {};
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        data[key] = value;
      }
    }
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the app.
  }
}

export function identifyUser(id: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(id, properties);
}

export const Analytics = {
  track: trackEvent,
  plungeLogged: (duration: number, temp: number, score: number) =>
    trackEvent("plunge_logged", { duration, temp, score }),

  plungeDeleted: () =>
    trackEvent("plunge_deleted"),

  timerStarted: () =>
    trackEvent("timer_started"),

  shareClicked: () =>
    trackEvent("share_clicked"),

  saveClicked: () =>
    trackEvent("save_clicked"),

  proUpgradeStarted: () =>
    trackEvent("pro_upgrade_started"),

  proUpgradeCompleted: () =>
    trackEvent("pro_upgrade_completed"),

  locationSubmitted: () =>
    trackEvent("community_location_submitted"),

  leaderboardSubmitted: () =>
    trackEvent("leaderboard_submitted"),

  onboardingCompleted: (skipped: boolean) =>
    trackEvent("onboarding_completed", { skipped }),

  tabChanged: (tab: string, from?: string) =>
    trackEvent("tab_changed", { tab, ...(from ? { from } : {}) }),

  moodCheckInShown: (source: string, questionSet: string, hoursAfterPlunge: number) =>
    trackEvent("mood_checkin_shown", { source, question_set: questionSet, hours_after_plunge: hoursAfterPlunge }),

  moodCheckInSaved: (source: string, questionSet: string) =>
    trackEvent("mood_checkin_saved", { source, question_set: questionSet }),

  moodCheckInSkipped: (source: string, questionSet: string) =>
    trackEvent("mood_checkin_skipped", { source, question_set: questionSet }),

  musicConnectionStarted: (service: string) =>
    trackEvent("music_connection_started", { service }),

  musicConnected: (service: string) =>
    trackEvent("music_connected", { service }),

  musicPlaylistSelected: (service: string, source: string) =>
    trackEvent("music_playlist_selected", { service, source }),

  musicOpened: (service: string) =>
    trackEvent("music_opened", { service }),

  musicControlUsed: (service: string, action: string) =>
    trackEvent("music_control_used", { service, action }),

  musicBarToggled: (collapsed: boolean) =>
    trackEvent("music_bar_toggled", { collapsed }),

  utilityWindowToggled: (expanded: boolean) =>
    trackEvent("utility_window_toggled", { expanded }),

  friendChallengeSent: (source: string, notificationDelivered: boolean) =>
    trackEvent("friend_challenge_sent", { source, notification_delivered: notificationDelivered }),

  brainFreezeChallengeSent: () =>
    trackEvent("brain_freeze_challenge_sent", { source: "friends_list" }),
};
