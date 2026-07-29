/**
 * ColdStreak Coach — AI chat backend.
 *
 * POST /api/coach/chat
 *   Body:  { message: string, history: {role:"user"|"assistant", content:string}[] }
 *   Reply: { reply: string }
 *
 * Uses Google Gemini 1.5 Flash (free tier: 1,500 req/day, no card required).
 * Falls back gracefully when GEMINI_API_KEY is not configured.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db";
import { plunges, users } from "@shared/schema";
import { eq, desc, count } from "drizzle-orm";

// ── App knowledge injected into every conversation ────────────────────────────

const APP_KNOWLEDGE = `
You are ColdStreak Coach — a warm, encouraging, science-backed guide for the ColdStreak cold plunge tracking app.
Be concise: 2–4 sentences max unless the user asks for detail. Use a friendly, direct tone. Never be preachy.

APP FEATURES:
• Timer (home screen): Start/stop plunge with stopwatch or countdown mode. Tap temperature to change it.
• Water Temperature: Enter manually or connect a Bluetooth sensor for a live reading. Accuracy powers personalised insights.
• Benefits Bar: 4 segments — Energy (~60s), Mood (~2 min), Metabolism (~3 min), Recovery (~5 min+). Fill during the session, decay slowly after. Achievement border stays all day once earned.
• History tab: Full log of past plunges with score, temp, duration, and mood ratings. Houses Sweet Spot, Cold Adaptation trend, and "Try This Next" card.
• Sweet Spot: Finds the temp/duration combo where the user feels best. Requires 10+ rated plunges.
• Cold Adaptation: Tracks month-over-month improvement in post-plunge feel. Trending up = adapting; suggests going colder/longer.
• Try This Next: Temperature-aware progression card. Suggests colder temps for warmer plungers; affirms consistency for advanced (≤45°F) plungers.
• Mood check-in: After a plunge, rate Energy (1–3), Focus (1–3), and Overall Mood (1–5). Powers Sweet Spot and Adaptation.
• Streak: Daily plunge streak. Streak Freeze tokens protect it on rest days.
• Friends tab: See friends' streaks, send challenges, view profiles.
• Explore tab: Discover cold plunge spots near you.
• Insights: Web dashboard at /insights — monthly charts, full analysis.
• Push notifications: Personalised nudge based on adaptation trend (trending up → challenge; down → ease up; away 7 days → gentle return).

COLD PLUNGE SCIENCE:
• Cold exposure triggers norepinephrine within 30s — sharpens focus and energy immediately.
• 2–3 min: Dopamine upregulation → lasting mood lift.
• Brown fat activation: Builds over weeks of regular cold exposure.
• Muscle recovery: Cold constricts vessels, reduces inflammation — effective post-workout.
• Cold adaptation: When feel-scores plateau or improve, the body has adapted. Time to nudge colder or longer.
• Safety: Start at 55–60°F. Build slowly. Never plunge alone. Listen to your body.

TEMPERATURE TIERS:
• Beginner: 55–65°F — great for building habit
• Intermediate: 46–54°F — strong benefits, active cold response
• Advanced: 40–45°F — significant stimulus; consistency > going colder
• Elite: < 40°F — serious cold exposure; focus on showing up, not going colder

SCORING: Plunge Score combines duration × temperature factor × body-weight factor. Higher = colder + longer.

Always answer from the app's perspective. If unsure, be honest. Never make up statistics.
`.trim();

// ── Main handler ──────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

// ── Screen labels shown to the coach ─────────────────────────────────────────

const SCREEN_LABELS: Record<string, string> = {
  timer:        "Timer (home screen — start/stop plunge)",
  history:      "History tab (past plunges, Sweet Spot, Cold Adaptation, Try This Next)",
  friends:      "Friends tab (friend streaks, challenges, pending requests)",
  explore:      "Explore tab (nearby cold plunge spots)",
  gear:         "Gear tab (equipment browsing)",
  settings:     "Settings / Profile screen",
  achievements: "Achievements screen (badges, passport)",
  legal:        "Legal / Terms screen",
};

export async function coachChat(
  userId: number,
  message: string,
  history: ChatMessage[],
  screenContext?: string,
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return (
      "The AI coach needs a Gemini API key to answer questions. " +
      "Add GEMINI_API_KEY to your server secrets and restart the app."
    );
  }

  // ── Build user context ──────────────────────────────────────────────────
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const [{ value: totalPlunges }] = await db
    .select({ value: count() })
    .from(plunges)
    .where(eq(plunges.userId, userId));

  const recentPlunges = await db
    .select()
    .from(plunges)
    .where(eq(plunges.userId, userId))
    .orderBy(desc(plunges.createdAt))
    .limit(5);

  const avgTemp =
    recentPlunges.length > 0
      ? Math.round(recentPlunges.reduce((s, p) => s + p.temperature, 0) / recentPlunges.length)
      : null;

  const ratedCount = recentPlunges.filter((p) => p.mood != null).length;

  const screenLine =
    screenContext && SCREEN_LABELS[screenContext]
      ? `• Current screen: ${SCREEN_LABELS[screenContext]}`
      : screenContext
        ? `• Current screen: ${screenContext}`
        : null;

  const userContext = `
CURRENT USER:
• Username: ${user?.username ?? "unknown"}
• Total plunges: ${totalPlunges}
• Recent avg temp (last 5): ${avgTemp != null ? `${avgTemp}°F` : "no plunges yet"}
• Rated plunges (last 5): ${ratedCount} / ${recentPlunges.length}
• Height: ${user?.bodyHeight ? `${user.bodyHeight} cm` : "not set"}
• Weight: ${user?.bodyWeight ? `${user.bodyWeight} lbs` : "not set"}${screenLine ? `\n${screenLine}` : ""}
`.trim();

  // ── Call Gemini ─────────────────────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: APP_KNOWLEDGE + "\n\n" + userContext,
  });

  // Gemini uses "user" / "model" roles (not "assistant")
  const geminiHistory = history.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);

  return (
    result.response.text() ||
    "Sorry, I couldn't generate a response — please try again."
  );
}
