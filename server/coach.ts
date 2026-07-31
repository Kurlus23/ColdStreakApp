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

import { db } from "./db";
import { plunges, users } from "@shared/schema";
import { eq, desc, count } from "drizzle-orm";

// ── App knowledge injected into every conversation ────────────────────────────

const APP_KNOWLEDGE = `
You are ColdStreak Coach — a warm, encouraging, science-backed guide for the ColdStreak cold plunge tracking app.
Be helpful and complete: explain features fully so the user actually understands them. Aim for 3–6 sentences for feature questions, shorter for simple yes/no questions. Use a friendly, direct tone. Never be preachy. Always finish your thought — never cut off mid-explanation.

APP FEATURES:
• Timer (home screen): Start/stop plunge in Stopwatch or Countdown mode. Tap the mode label below the timer display to switch modes. In Countdown mode, tap the displayed time when the timer is idle to jump to the time-setter in Settings. You can also set the countdown duration directly in Settings → Timer section (choose minutes and seconds). While a countdown is running, two extra buttons appear: "+0:30" adds 30 seconds, and "+Finish [benefit]" adds exactly the seconds needed to complete the benefit segment you're currently in (e.g. "+Finish 😊" to finish Mood). Once all benefit segments are done those buttons switch to "+0:30" and "+1:00".
• Water Temperature: Enter manually or connect a Bluetooth sensor for a live reading. Accuracy powers personalised insights.
• Benefits Bar: 4 segments — Energy (~60s), Mood (~2 min), Metabolism (~3 min), Recovery (~5 min+). Fill during the session, decay slowly after. Achievement border stays all day once earned.
• History tab: Full log of past plunges with score, temp, duration, and mood ratings. This is ONLY the plunge log — Sweet Spot and Cold Adaptation are NOT here.
• Mood check-in: After a plunge, rate Energy (1–3), Focus (1–3), and Overall Mood (1–5). Powers Sweet Spot and Adaptation (both found in Profile → Stats tab, not History).
• Profile screen (Badges & Account): Has two tabs — Account and Stats. The Stats tab is where all personal analytics live: Calorie Burn estimates, Sweet Spot, Cold Adaptation trend, Discovery Report, "Try This Next" card, and a link to the full Insights Dashboard.
• Sweet Spot: Finds the temp/duration combo where the user feels best. Requires 10+ rated plunges. Found in Profile › Stats tab.
• Cold Adaptation: Tracks month-over-month improvement in post-plunge feel. Trending up = adapting; suggests going colder/longer. Found in Profile › Stats tab.
• Try This Next: Temperature-aware progression card. Suggests colder temps for warmer plungers; affirms consistency for advanced (≤45°F) plungers. Found in Profile › Stats tab.
• Calorie Burn: Thermogenic estimate based on duration, temperature, and body weight. Shows Today / This week / All-time. Found in Profile › Stats tab (tap the Profile icon → Stats tab).
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

RESPONSE FORMAT — always return valid JSON, no markdown, no code fences:
{
  "reply": "your message to the user",
  "navigate": null
}

Set "navigate" to the screen name (string) when your answer is specifically about a feature the user can see on that screen — so they can follow along:
• "timer"        — benefits bar, plunge score, streak, temperature, countdown, start/stop
• "history"      — past plunges log, mood check-in
• "achievements" — Profile screen. Account tab: username, body metrics entry (weight, height, body fat % — this is where users enter their BMI/body composition, NOT in Settings). Stats tab: calorie burn, sweet spot, cold adaptation, try this next, discovery report, insights. Always send users here for body weight, height, or body fat questions.
• "explore"      — finding spots, community locations, nearby plunge spots
• "gear"         — equipment, devices, Bluetooth sensors, smart scales
• "settings"     — notification preferences, countdown timer mode/duration, display units
• "friends"      — challenges, friend streaks, pending requests

Set "navigate" to null for general cold-plunge science questions, greetings, or when the answer doesn't map to a single screen.
`.trim();

// ── Main handler ──────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

// ── Screen labels shown to the coach ─────────────────────────────────────────

const SCREEN_LABELS: Record<string, string> = {
  timer:        "Timer (home screen — start/stop plunge)",
  history:      "History tab (past plunges log, mood check-in)",
  achievements: "Profile screen — Badges, Account tab, and Stats tab (calorie burn, sweet spot, cold adaptation, try this next, discovery report, insights)",
  friends:      "Friends tab (friend streaks, challenges, pending requests)",
  explore:      "Explore tab (nearby cold plunge spots)",
  gear:         "Gear tab (equipment browsing)",
  settings:     "Settings / Profile screen",
  legal:        "Legal / Terms screen",
};

export async function coachChat(
  userId: number,
  message: string,
  history: ChatMessage[],
  screenContext?: string,
): Promise<{ reply: string; navigate?: string | null }> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      reply:
        "The AI coach needs a Gemini API key to answer questions. " +
        "Add GEMINI_API_KEY to your server secrets and restart the app.",
    };
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

  // ── Call Gemini via v1beta REST ───────────────────────────────────────────
  // v1beta is the correct endpoint for generateContent; v1 only lists models.
  // Free (unlimited RPD) models first, paid models as last resort.
  const GEMINI_MODELS = [
    "gemini-flash-latest",       // alias → current stable flash (free)
    "gemini-3.5-flash",          // 10K RPD free (may 503 under load — falls through)
    "gemini-3.6-flash",          // 10K RPD free
    "gemini-3-flash-preview",    // 10K RPD free
    "gemini-3.5-flash-lite",     // 150K RPD free — lite but huge quota
    "gemini-3.1-flash-lite",     // 150K RPD free
    "gemini-flash-lite-latest",  // alias → current lite (last resort)
  ];
  const baseUrl = (model: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Gemini uses "user" / "model" roles (not "assistant")
  const geminiHistory = history.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: APP_KNOWLEDGE + "\n\n" + userContext }] },
    contents: [
      ...geminiHistory,
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  };

  async function callGemini(model: string) {
    return fetch(baseUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  let res = await callGemini(GEMINI_MODELS[0]);

  // On overload/quota/deprecation, try each fallback model in turn before giving up
  for (let i = 1; i < GEMINI_MODELS.length && (res.status === 503 || res.status === 429 || res.status === 404); i++) {
    console.warn(`[coach] ${GEMINI_MODELS[i-1]} returned ${res.status}, trying ${GEMINI_MODELS[i]}`);
    res = await callGemini(GEMINI_MODELS[i]);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`);
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text: string }[] } }[] };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Gemini returns JSON — strip any markdown code fences it may have added, then parse
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { reply?: string; navigate?: string | null };
    return {
      reply: parsed.reply || "Sorry, I couldn't generate a response — please try again.",
      navigate: parsed.navigate ?? null,
    };
  } catch {
    // Fallback: treat raw text as reply with no navigation
    return { reply: raw || "Sorry, I couldn't generate a response — please try again." };
  }
}
