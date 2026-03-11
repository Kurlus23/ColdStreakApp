import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

export function initAnalytics() {
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    autocapture: false,
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

export function identifyUser(id: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(id, properties);
}

export const Analytics = {
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

  tabChanged: (tab: string) =>
    trackEvent("tab_changed", { tab }),
};
