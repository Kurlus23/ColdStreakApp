/**
 * Weekly and monthly plunge-insight "discovery reports".
 *
 * Each report is sent to every user who:
 *   - Has a verified email address
 *   - Logged at least one plunge in the reporting window
 *
 * Weekly  → sent Monday morning (triggered by scheduler in index.ts)
 * Monthly → sent on the 1st of each month (same scheduler)
 *
 * Philosophy (from product brief):
 *   - Make it a DISCOVERY report, not a report card.
 *   - Show patterns: "your best mood boost happens at 41–44 °F for 2–4 min"
 *   - Use safe, non-causal language: "associated with", "correlated with",
 *     "your highest-rated sessions were" — never "improved your mood by X%"
 */

import { db } from "./db";
import { plunges, users } from "../shared/schema";
import { and, gte, lt, isNotNull, eq, desc } from "drizzle-orm";
import { getEmailLabStats } from "./brain-freeze";
import { sendEmail } from "./email";
import { analysePatterns, computeStats, type ReportRow, type PeriodStats } from "../shared/reportAnalysis";

// ─── Segment display metadata (email rendering only) ─────────────────────────
const SERVER_SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     color: "#22d3ee" },
  { id: "mood",       emoji: "😊", label: "Mood",       color: "#fbbf24" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", color: "#f97316" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   color: "#34d399" },
] as const;

// ─── Date-range helpers (server only — drives email send windows) ────────────

function prevWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  // "Previous week" = the 7 days that just ended at today's midnight UTC.
  // Called on Monday at 07:00 UTC → covers Mon–Sun of the week that just finished.
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end   = todayMidnight;
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function prevMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year  = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, month, 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

const BRAND_BG   = "#0f1f3d";
const BRAND_CARD = "#1e3a5f";
const BRAND_CYAN = "#22d3ee";
const BRAND_TEXT = "#e2e8f0";
const BRAND_MUTED = "#94a3b8";
const BRAND_DIM  = "#475569";

function statCard(value: string, label: string, color = BRAND_CYAN): string {
  return `
    <td style="width:25%;padding:0 6px;">
      <div style="background:${BRAND_CARD};border-radius:12px;padding:14px 8px;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:${color};line-height:1.1;">${value}</div>
        <div style="font-size:10px;color:${BRAND_DIM};text-transform:uppercase;letter-spacing:.08em;margin-top:4px;">${label}</div>
      </div>
    </td>`;
}

function benefitRow(id: string, emoji: string, label: string, count: number, color: string): string {
  const pct = Math.min(100, count * 25);
  return `
    <tr>
      <td style="padding:6px 0;width:110px;color:${BRAND_MUTED};font-size:13px;">${emoji} ${label}</td>
      <td style="padding:6px 8px;">
        <div style="background:#0d1b2e;border-radius:99px;height:8px;overflow:hidden;">
          <div style="background:${color};width:${pct}%;height:100%;border-radius:99px;"></div>
        </div>
      </td>
      <td style="padding:6px 0;text-align:right;color:${BRAND_TEXT};font-size:13px;font-weight:600;white-space:nowrap;">${count}×</td>
    </tr>`;
}

function insightCard(emoji: string, title: string, body: string): string {
  return `
    <div style="background:#0d1b2e;border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px;">${emoji} ${title}</div>
      <div style="font-size:13px;color:${BRAND_MUTED};line-height:1.5;">${body}</div>
    </div>`;
}

interface BfEmailStats {
  inColdAccuracy: number; outColdAccuracy: number;
  inColdAvgMs: number; outColdAvgMs: number;
  inPlungeCount: number; outPlungeCount: number;
  accuracyDeltaPct: number; adaptationNote: string | null;
}

function buildReportHtml(opts: {
  name:       string;
  periodLabel: string;
  isMonthly:  boolean;
  stats:      PeriodStats;
  windowDays: number;
  bfStats?:   BfEmailStats | null;
}): string {
  const { name, periodLabel, stats, windowDays, bfStats } = opts;
  const greeting = name ? `Hey ${name},` : "Hey there,";
  const { insights } = stats;

  const moodRespondedPct = stats.count > 0
    ? Math.round((stats.moodResponded / stats.count) * 100)
    : 0;

  const totalBenefitUnlocks = Object.values(stats.benefitCounts).reduce((a: number, b: number) => a + b, 0);

  // ── Build discovery insight cards ──────────────────────────────────────────

  const discoveryCards: string[] = [];

  // Sweet spot card (needs temp + dur + some check-ins)
  if (insights.tempLabel && insights.durLabel && insights.sampleSize >= 5) {
    const forText = insights.sweetSpotFor ? ` — best for <strong style="color:#6ee7b7;">${insights.sweetSpotFor}</strong>` : "";
    discoveryCards.push(insightCard(
      "🎯",
      "Your Current Sweet Spot",
      `Your sessions in the <strong style="color:#22d3ee;">${insights.tempLabel}</strong> range lasting <strong style="color:#22d3ee;">${insights.durLabel}</strong> are most consistently <em>associated with</em> your highest mood and energy ratings${forText}. (${insights.sampleSize} check-ins)`,
    ));
  } else if (insights.sampleSize > 0 && insights.sampleSize < 5) {
    discoveryCards.push(insightCard(
      "🎯",
      "Sweet Spot — Building Data",
      `You have ${insights.sampleSize} check-in${insights.sampleSize === 1 ? "" : "s"} so far. Complete a few more after plunges and we'll start surfacing personalised patterns.`,
    ));
  }

  // Morning plunges
  if (insights.morningBest === true) {
    discoveryCards.push(insightCard(
      "🌅",
      "Morning Timing Advantage",
      `Your pre-10 AM plunges are <em>associated with</em> higher next-day mood ratings compared with later sessions. Early cold exposure may prime your nervous system for the day.`,
    ));
  }

  // Diminishing returns
  if (insights.diminishing) {
    discoveryCards.push(insightCard(
      "📉",
      "Diminishing Returns",
      `Sessions longer than 6 minutes didn't produce meaningfully higher mood or energy ratings compared with your 3–6 minute plunges. More time in the cold isn't always better.`,
    ));
  }

  // Check-in response section
  const hasCheckins = stats.moodResponded > 0;

  const moodLabels: Record<number, string> = { 1: "😞 Rough", 2: "😕 Low", 3: "😐 OK", 4: "🙂 Good", 5: "😄 Great" };
  const energyLabels: Record<number, string> = { 1: "💤 Drained", 2: "⚡ Neutral", 3: "🔋 Energized" };
  const focusLabels: Record<number, string>  = { 1: "🌫️ Worse", 2: "🧠 Same", 3: "🎯 Better" };

  function miniBar(label: string, count: number, total: number, color: string): string {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    if (count === 0) return "";
    return `
      <tr>
        <td style="padding:3px 0;width:96px;color:${BRAND_MUTED};font-size:12px;">${label}</td>
        <td style="padding:3px 8px;">
          <div style="background:#0d1b2e;border-radius:99px;height:6px;overflow:hidden;">
            <div style="background:${color};width:${pct}%;height:100%;border-radius:99px;"></div>
          </div>
        </td>
        <td style="padding:3px 0;text-align:right;color:${BRAND_MUTED};font-size:11px;white-space:nowrap;">${count} (${pct}%)</td>
      </tr>`;
  }

  const checkinSection = hasCheckins ? `
  <!-- Check-in results -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:20px;">
    <h3 style="color:#fff;margin:0 0 4px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">
      How You Felt After Plunging
    </h3>
    <p style="color:${BRAND_MUTED};font-size:12px;margin:0 0 14px;">
      ${stats.moodResponded} of ${stats.count} plunges rated (${moodRespondedPct}%)
      ${stats.avgMood != null ? `· Avg mood <strong style="color:${BRAND_TEXT};">${stats.avgMood}/5</strong>` : ""}
      ${stats.avgEnergy != null ? `· Avg energy <strong style="color:${BRAND_TEXT};">${stats.avgEnergy}/3</strong>` : ""}
    </p>

    <!-- Mood -->
    <div style="font-size:11px;color:${BRAND_DIM};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">😊 Mood</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${[5, 4, 3, 2, 1].map((r) => miniBar(moodLabels[r], stats.moodCounts[r] ?? 0, stats.moodResponded, r >= 4 ? "#22d3ee" : r === 3 ? "#6ee7b7" : "#94a3b8")).join("")}
    </table>

    ${stats.avgEnergy != null ? `
    <!-- Energy -->
    <div style="font-size:11px;color:${BRAND_DIM};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">⚡ Energy</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${[3, 2, 1].map((r) => miniBar(energyLabels[r], stats.energyCounts[r] ?? 0, stats.moodResponded, r === 3 ? "#22d3ee" : r === 2 ? "#fbbf24" : "#94a3b8")).join("")}
    </table>` : ""}

    ${stats.avgFocus != null ? `
    <!-- Focus -->
    <div style="font-size:11px;color:${BRAND_DIM};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">🧠 Focus</div>
    <table style="width:100%;border-collapse:collapse;">
      ${[3, 2, 1].map((r) => miniBar(focusLabels[r], stats.focusCounts[r] ?? 0, stats.moodResponded, r === 3 ? "#a78bfa" : r === 2 ? "#fbbf24" : "#94a3b8")).join("")}
    </table>` : ""}

    <p style="color:${BRAND_DIM};font-size:11px;margin:10px 0 0;line-height:1.5;">
      Rated via in-app check-in sent ~1 hour after each plunge. Results are self-reported and correlational — not medical data.
    </p>
  </div>` : `
  <!-- No check-ins -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:20px;">
    <h3 style="color:#fff;margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">How You Felt After Plunging</h3>
    <p style="color:${BRAND_DIM};font-size:13px;margin:0;">No check-ins recorded this period. Tap the in-app prompt after your next plunge to start building your personal dataset.</p>
  </div>`;

  const discoverySection = discoveryCards.length > 0 ? `
  <!-- Discovery insights -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:20px;">
    <h3 style="color:#fff;margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">
      📊 Your Cold Response Patterns
    </h3>
    ${discoveryCards.join("")}
    <p style="color:${BRAND_DIM};font-size:10px;margin:8px 0 0;line-height:1.5;">
      Patterns are based on your self-reported check-ins and are correlational only. Not medical advice.
    </p>
  </div>` : "";

  const motivators = [
    "Keep getting cold — your body is adapting.",
    "Consistency is the only metric that matters.",
    "Every plunge is a vote for the person you're becoming.",
    "The discomfort you choose builds the resilience you need.",
    "Cold water doesn't care how you feel. Neither should you.",
  ];
  const motivator = motivators[stats.count % motivators.length];

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:${BRAND_BG};color:${BRAND_TEXT};border-radius:16px;padding:32px;">

  <h1 style="color:${BRAND_CYAN};margin:0 0 4px;font-size:22px;">🧊 ColdStreak</h1>
  <h2 style="color:#fff;margin:0 0 6px;font-size:20px;">${periodLabel}</h2>
  <p style="color:${BRAND_MUTED};margin:0 0 24px;font-size:14px;">${greeting}</p>

  <!-- Summary stats -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      ${statCard(String(stats.count), "Plunges")}
      ${statCard(String(stats.totalMinutes), "Minutes")}
      ${statCard(`${stats.uniqueDays}/${windowDays}`, "Days", "#6ee7b7")}
      ${statCard(stats.bestScore > 0 ? String(stats.bestScore) : "—", "Best Score", "#fbbf24")}
    </tr>
  </table>

  <!-- Benefits earned -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:20px;">
    <h3 style="color:#fff;margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">
      Benefits Earned &nbsp;<span style="color:${BRAND_MUTED};font-weight:400;font-size:12px;">${totalBenefitUnlocks} total unlocks</span>
    </h3>
    <table style="width:100%;border-collapse:collapse;">
      ${SERVER_SEGMENTS.map((s) => benefitRow(s.id, s.emoji, s.label, stats.benefitCounts[s.id] ?? 0, s.color)).join("")}
    </table>
  </div>

  ${checkinSection}

  ${discoverySection}

  ${bfStats ? `
  <!-- Brain Freeze Lab -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:20px;">
    <h3 style="color:#fff;margin:0 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">
      🧠 Brain Freeze Lab &nbsp;<span style="color:${BRAND_MUTED};font-weight:400;font-size:12px;">${bfStats.inPlungeCount + bfStats.outPlungeCount} questions this period</span>
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>
        <td style="padding:4px 0;color:${BRAND_MUTED};"></td>
        <td style="padding:4px 8px;text-align:center;color:#22d3ee;font-weight:700;font-size:11px;text-transform:uppercase;">In Cold</td>
        <td style="padding:4px 0;text-align:center;color:${BRAND_MUTED};font-size:11px;text-transform:uppercase;">Outside</td>
      </tr>
      <tr style="border-top:1px solid #0d1b2e;">
        <td style="padding:7px 0;color:${BRAND_MUTED};">Accuracy</td>
        <td style="padding:7px 8px;text-align:center;color:#fff;font-weight:700;">${Math.round(bfStats.inColdAccuracy * 100)}%</td>
        <td style="padding:7px 0;text-align:center;color:${BRAND_TEXT};">${Math.round(bfStats.outColdAccuracy * 100)}%</td>
      </tr>
      <tr style="border-top:1px solid #0d1b2e;">
        <td style="padding:7px 0;color:${BRAND_MUTED};">Avg response</td>
        <td style="padding:7px 8px;text-align:center;color:#fff;font-weight:700;">${(bfStats.inColdAvgMs / 1000).toFixed(1)}s</td>
        <td style="padding:7px 0;text-align:center;color:${BRAND_TEXT};">${(bfStats.outColdAvgMs / 1000).toFixed(1)}s</td>
      </tr>
    </table>
    ${bfStats.accuracyDeltaPct !== 0 ? `
    <div style="margin-top:12px;background:#0d1b2e;border-radius:8px;padding:10px 12px;">
      <span style="color:${bfStats.accuracyDeltaPct > 0 ? "#6ee7b7" : "#94a3b8"};font-size:13px;">
        ${bfStats.accuracyDeltaPct > 0 ? "✓" : "→"} You answered ${Math.abs(bfStats.accuracyDeltaPct).toFixed(0)} points ${bfStats.accuracyDeltaPct > 0 ? "more" : "fewer"} correctly in the cold than outside it this period.
      </span>
    </div>` : ""}
    ${bfStats.adaptationNote ? `
    <div style="margin-top:8px;background:#0d1b2e;border-radius:8px;padding:10px 12px;">
      <span style="color:${BRAND_MUTED};font-size:12px;">📈 ${bfStats.adaptationNote}</span>
    </div>` : ""}
  </div>` : ""}

  <!-- Motivator -->
  <div style="border-left:3px solid ${BRAND_CYAN};padding-left:14px;margin-bottom:28px;">
    <p style="color:${BRAND_MUTED};font-size:13px;font-style:italic;margin:0;">${motivator}</p>
  </div>

  <hr style="border:none;border-top:1px solid ${BRAND_CARD};margin:0 0 20px;" />
  <p style="color:${BRAND_DIM};font-size:12px;margin:0;line-height:1.6;">
    You received this because you have a ColdStreak account.<br>
    Open the app to see your full history, benefit bar, and sweet spot card.<br>
    — The ColdStreak Team 🥶
  </p>

</div>`;
}

// ─── Public report runners ────────────────────────────────────────────────────

async function runReport(start: Date, end: Date, periodLabel: string, windowDays: number, isMonthly: boolean) {
  const rows = await db
    .select({
      userId:      plunges.userId,
      duration:    plunges.duration,
      temperature: plunges.temperature,
      mood:        plunges.mood,
      moodEnergy:  plunges.moodEnergy,
      moodFocus:   plunges.moodFocus,
      score:       plunges.score,
      createdAt:   plunges.createdAt,
      email:       users.email,
      displayName: users.displayName,
      username:    users.username,
    })
    .from(plunges)
    .innerJoin(users, eq(plunges.userId, users.id))
    .where(
      and(
        isNotNull(plunges.userId),
        gte(plunges.createdAt, start),
        lt(plunges.createdAt, end),
      )
    )
    .orderBy(desc(plunges.createdAt));

  const byUser = new Map<number, { email: string; name: string; plunges: ReportRow[] }>();
  for (const r of rows) {
    if (!r.userId || !r.email) continue;
    if (!byUser.has(r.userId)) {
      const name = r.displayName || r.username || "";
      byUser.set(r.userId, { email: r.email, name, plunges: [] });
    }
    byUser.get(r.userId)!.plunges.push({
      duration:    r.duration,
      temperature: r.temperature,
      mood:        r.mood,
      moodEnergy:  r.moodEnergy,
      moodFocus:   r.moodFocus,
      score:       r.score,
      createdAt:   r.createdAt,
    });
  }

  console.log(`[reports] ${periodLabel}: ${byUser.size} user(s) to email`);

  let sent = 0;
  for (const [userId, { email, name, plunges: userPlunges }] of Array.from(byUser.entries())) {
    try {
      const stats   = computeStats(userPlunges);
      const bfStats = await getEmailLabStats(userId, start, end).catch(() => null);
      const html    = buildReportHtml({ name, periodLabel, isMonthly, stats, windowDays, bfStats });
      const subj    = isMonthly
        ? `🧊 Your ColdStreak ${periodLabel} Cold Response Report`
        : `🧊 Your ColdStreak Week in Review`;
      await sendEmail(email, subj, html);
      sent++;
    } catch (err) {
      console.error(`[reports] failed to send to ${email}:`, err);
    }
  }

  console.log(`[reports] ${periodLabel}: sent ${sent}/${byUser.size}`);
}

export async function runWeeklyReports(): Promise<void> {
  const { start, end } = prevWeekRange();
  const label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  await runReport(start, end, label, 7, false);
}

export async function runMonthlyReports(): Promise<void> {
  const { start, end, label } = prevMonthRange();
  await runReport(start, end, label, new Date(end.getTime() - 1).getUTCDate(), true);
}
