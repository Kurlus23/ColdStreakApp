import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined;

type AnalyticsValue = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsValue>;

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
  const safeProperties: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safeProperties[key] = value;
    }
  }

  try {
    if (POSTHOG_KEY) posthog.capture(event, safeProperties);
  } catch {
    // Analytics must never break the app.
  }

  try {
    window.umami?.track(event, safeProperties);
  } catch {
    // Analytics must never break the app.
  }
}

export function identifyUser(id: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  try {
    const safeProperties: AnalyticsProperties = {};
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safeProperties[key] = value;
      }
    }
    posthog.identify(id, safeProperties);
  } catch {
    // Analytics must never break the app.
  }
}

export function resetAnalyticsUser() {
  if (!POSTHOG_KEY) return;
  try {
    posthog.reset();
  } catch {
    // Analytics must never break the app.
  }
}

export const Analytics = {
  track: trackEvent,
  plungeStarted: (properties: {
    water_temp_f: number;
    target_duration_seconds?: number;
    goal_type?: string;
    device_source: string;
  }) => trackEvent("plunge_started", properties),

  plungeCompleted: (properties: {
    duration_seconds: number;
    water_temp_f: number;
    target_duration_seconds?: number;
    goal_type?: string;
    goal_met: boolean;
    calories_burned: number;
    device_source: string;
  }) => trackEvent("plunge_completed", properties),

  plungeAbandoned: (properties: {
    duration_seconds: number;
    water_temp_f: number;
    target_duration_seconds?: number;
    goal_type?: string;
    reason: "reset" | "stopped_before_save";
  }) => trackEvent("plunge_abandoned", properties),

  plungeDeleted: () =>
    trackEvent("plunge_deleted"),

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

  onboardingStarted: () =>
    trackEvent("onboarding_started"),

  firstPlungeStarted: (properties: { water_temp_f: number; goal_type?: string }) =>
    trackEvent("first_plunge_started", properties),

  firstPlungeCompleted: (properties: { duration_seconds: number; water_temp_f: number; goal_type?: string }) =>
    trackEvent("first_plunge_completed", properties),

  goalViewed: () =>
    trackEvent("goal_viewed"),

  goalSet: (goal_type: string, properties?: { target_duration_seconds?: number; recommended_duration_seconds?: number; water_temp_f?: number }) =>
    trackEvent("goal_set", { goal_type, ...properties }),

  goalCompleted: (properties: { goal_type: string; target_duration_seconds: number; actual_duration_seconds: number; water_temp_f: number }) =>
    trackEvent("goal_completed", properties),

  benefitViewed: (benefit_type: string, properties?: { required_duration_seconds?: number; water_temp_f?: number }) =>
    trackEvent("benefit_viewed", { benefit_type, ...properties }),

  benefitCompleted: (properties: { benefit_type: string; required_duration_seconds: number; actual_duration_seconds: number; water_temp_f: number }) =>
    trackEvent("benefit_completed", properties),

  moodCheckInStarted: (source: string, questionSet: string, hoursAfterPlunge: number) =>
    trackEvent("mood_checkin_started", { source, question_set: questionSet, hours_after_plunge: hoursAfterPlunge }),

  moodCheckInSaved: (source: string, questionSet: string, properties?: { mood?: number; plunge_id?: number; duration_seconds?: number; water_temp_f?: number }) =>
    trackEvent("mood_checkin_saved", { source, question_set: questionSet, ...properties }),

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

  brainFreezeStarted: (properties?: { in_plunge?: boolean }) =>
    trackEvent("brain_freeze_started", properties),

  brainFreezeQuestionAnswered: (properties: { question_number: number; answer_correct: boolean; benefit_stage?: string; in_plunge?: boolean }) =>
    trackEvent("brain_freeze_question_answered", properties),

  brainFreezeCompleted: (properties: { questions_answered: number; correct_answers: number; accuracy: number; in_plunge?: boolean }) =>
    trackEvent("brain_freeze_completed", properties),

  locationViewed: (properties: { location_type: string; location_id?: number }) =>
    trackEvent("location_viewed", properties),

  locationSaved: (properties: { location_id?: number; location_type: string }) =>
    trackEvent("location_saved", properties),

  locationDirectionsClicked: (properties: { location_id?: number; location_type: string }) =>
    trackEvent("location_directions_clicked", properties),

  statsViewed: () =>
    trackEvent("stats_viewed"),

  historyViewed: () =>
    trackEvent("history_viewed"),

  exploreViewed: () =>
    trackEvent("explore_viewed"),

  streakViewed: () =>
    trackEvent("streak_viewed"),

  badgesViewed: () =>
    trackEvent("badges_viewed"),

  leaderboardViewed: (properties?: { location_type?: string }) =>
    trackEvent("leaderboard_viewed", properties),

  friendsViewed: () =>
    trackEvent("friends_viewed"),

  profileViewed: () =>
    trackEvent("profile_viewed"),

  friendChallengeSent: (source: string, notificationDelivered: boolean) =>
    trackEvent("friend_challenge_sent", { source, notification_delivered: notificationDelivered }),

  brainFreezeChallengeSent: () =>
    trackEvent("brain_freeze_challenge_sent", { source: "friends_list" }),
};
