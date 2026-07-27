/**
 * Feature announcements surfaced by the ColdStreak Coach.
 *
 * Add a new entry whenever a notable feature ships. The coach FAB shows a
 * badge until the user opens the panel; the first panel open injects unseen
 * announcements as coach messages.
 *
 * localStorage key: "coach-seen-announcement-ids"  (JSON string[])
 */

export interface Announcement {
  id: string;
  title: string;
  message: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "cold-adaptation-v1",
    title: "🧊 Cold Adaptation tracking is here",
    message:
      "Check the History tab — there's now a Cold Adaptation card that shows whether your body is improving month over month. Once you've adapted, the \"Try This Next\" card gives you a temperature-specific next step based on exactly where you're plunging.",
  },
  {
    id: "try-this-next-temp-aware",
    title: "📈 Smarter progression suggestions",
    message:
      "The \"Try This Next\" card now knows your current temperature. Plunging at 55°F? It suggests a concrete colder target. Already in the low 40s? It affirms your consistency instead of pushing you further.",
  },
  {
    id: "benefits-bar-per-segment-decay",
    title: "⚡ Benefits bar now decays per segment",
    message:
      "A short second session no longer resets the decay on benefits you earned hours ago. Each segment now fades from the moment it was individually earned — so Recovery from your morning plunge keeps decaying even if you do a quick evening session.",
  },
];

const STORAGE_KEY = "coach-seen-announcement-ids";

function getSeenIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function getUnseenAnnouncements(): Announcement[] {
  const seen = new Set(getSeenIds());
  return ANNOUNCEMENTS.filter((a) => !seen.has(a.id));
}

export function markAnnouncementSeen(id: string): void {
  const seen = new Set(getSeenIds());
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
}

export function markAllAnnouncementsSeen(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ANNOUNCEMENTS.map((a) => a.id)));
}
