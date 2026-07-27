/**
 * Weekly and monthly plunge-insight reports.
 *
 * Each report is sent to every user who:
 *   - Has a verified email address
 *   - Logged at least one plunge in the reporting window
 *
 * Weekly  → sent Monday morning (triggered by scheduler in index.ts)
 * Monthly → sent on the 1st of each month (same scheduler)
 *
 * Benefit segments are computed server-side using temperature factor only
 * (BMI factor defaults to 1.0 — body data not reliably available server-side).
 */

import { db } from "./db";
import { plunges, users } from "../shared/schema";
import { and, gte, lt, isNotNull, eq, desc } from "drizzle-orm";
import { sendEmail } from "./email";

// ─── Server-side segment definitions (mirrors client/src/lib/benefitSegments.ts) ─
const SERVER_SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     baseDuration: 60,  color: "#22d3ee" },
  { id: "mood",       emoji: "😊", label: "Mood",       baseDuration: 120, color: "#fbbf24" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", baseDuration: 120, color: "#f97316" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   baseDuration: 180, color: "#34d399" },
] as const;

const TEMP_POINTS: [number, number][] = [
  [35, 0.55], [38, 0.62], [42, 0.72], [45, 0.82],
  [50, 1.00], [55, 1.28], [60, 1.58], [65, 2.00],
];

function getTempFactor(tempF: number): number {
  if (tempF <= TEMP_POINTS[0][0]) return TEMP_POINTS[0][1];
  if (tempF >= TEMP_POINTS[TEMP_POINTS.length - 1][0]) return TEMP_POINTS[TEMP_POINTS.length - 1][1];
  for (let i = 1; i < TEMP_POINTS.length; i++) {
    const [x0, y0] = TEMP_POINTS[i - 1];
    const [x1, y1] = TEMP_POINTS[i];
    if (tempF <= x1) return y0 + ((tempF - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1.0;
}

/** Returns the IDs of benefit segments fully earned by one plunge. */
function earnedSegments(durationSec: number, tempF: number): string[] {
  const tf = getTempFactor(tempF);
  let t = 0;
  const earned: string[] = [];
  for (const seg of SERVER_SEGMENTS) {
    t += Math.round(seg.baseDuration * tf);
    if (durationSec >= t) earned.push(seg.id);
    else break; // segments unlock in order; once one is missed, the rest won't be reached
  }
  return earned;
}

// ─── Mood helpers ─────────────────────────────────────────────────────────────
const MOOD_META: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "🙁", label: "Rough" },
  2: { emoji: "😐", label: "Meh"   },
  3: { emoji: "🙂", label: "Good"  },
  4: { emoji: "😊", label: "Great" },
};

// ─── Date-range helpers ───────────────────────────────────────────────────────

/** Returns [start, end) for the previous Mon–Sun week (UTC). */
function prevWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  // Start = last Monday 00:00 UTC
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek; // days since Monday
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
  const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Returns [start, end) for the previous calendar month (UTC). */
function prevMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const year  = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
  const start = new Date(Date.UTC(year, month, 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

// ─── Stats computation ────────────────────────────────────────────────────────

interface PlungeRow {
  duration: number;
  temperature: number;
  mood: number | null;
  score: string | null;
  createdAt: Date;
}

interface PeriodStats {
  count: number;
  totalMinutes: number;
  uniqueDays: number;
  bestScore: number;
  benefitCounts: Record<string, number>; // segmentId → times earned
  moodCounts: Record<number, number>;    // 1-4 → occurrences
  moodTotal: number;
  moodResponded: number;
  avgMood: number | null;
}

function computeStats(rows: PlungeRow[]): PeriodStats {
  const benefitCounts: Record<string, number> = { energy: 0, mood: 0, metabolism: 0, recovery: 0 };
  const moodCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalSec = 0;
  let moodTotal = 0;
  let moodResponded = 0;
  let bestScore = 0;
  const days = new Set<string>();

  for (const p of rows) {
    totalSec += p.duration;
    const s = parseFloat(p.score ?? "0");
    if (s > bestScore) bestScore = s;
    days.add(p.createdAt.toISOString().slice(0, 10));
    for (const id of earnedSegments(p.duration, p.temperature)) benefitCounts[id]++;
    if (p.mood != null) {
      moodCounts[p.mood] = (moodCounts[p.mood] ?? 0) + 1;
      moodTotal += p.mood;
      moodResponded++;
    }
  }

  return {
    count: rows.length,
    totalMinutes: Math.round(totalSec / 60),
    uniqueDays: days.size,
    bestScore: Math.round(bestScore * 10) / 10,
    benefitCounts,
    moodCounts,
    moodTotal,
    moodResponded,
    avgMood: moodResponded > 0 ? Math.round((moodTotal / moodResponded) * 10) / 10 : null,
  };
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

const BRAND_BG      = "#0f1f3d";
const BRAND_CARD    = "#1e3a5f";
const BRAND_CYAN    = "#22d3ee";
const BRAND_TEXT    = "#e2e8f0";
const BRAND_MUTED   = "#94a3b8";
const BRAND_DIM     = "#475569";

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
  const pct = Math.min(100, count * 25); // 4 unlocks = 100%
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

function moodBar(rating: number, count: number, total: number): string {
  const meta = MOOD_META[rating];
  if (!meta) return "";
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors: Record<number, string> = { 1: "#94a3b8", 2: "#94a3b8", 3: "#6ee7b7", 4: "#22d3ee" };
  return `
    <tr>
      <td style="padding:4px 0;width:72px;color:${BRAND_MUTED};font-size:12px;">${meta.emoji} ${meta.label}</td>
      <td style="padding:4px 8px;">
        <div style="background:#0d1b2e;border-radius:99px;height:6px;overflow:hidden;">
          <div style="background:${colors[rating]};width:${pct}%;height:100%;border-radius:99px;"></div>
        </div>
      </td>
      <td style="padding:4px 0;text-align:right;color:${BRAND_MUTED};font-size:12px;white-space:nowrap;">${count} (${pct}%)</td>
    </tr>`;
}

function buildReportHtml(opts: {
  name: string;
  periodLabel: string;
  isMonthly: boolean;
  stats: PeriodStats;
  windowDays: number;
}): string {
  const { name, periodLabel, stats, windowDays } = opts;
  const greeting = name ? `Hey ${name},` : "Hey there,";

  const avgMoodStr = stats.avgMood != null
    ? `${MOOD_META[Math.round(stats.avgMood)]?.emoji ?? ""} ${stats.avgMood}/4`
    : "—";

  const moodRespondedPct = stats.count > 0
    ? Math.round((stats.moodResponded / stats.count) * 100)
    : 0;

  const totalBenefitUnlocks = Object.values(stats.benefitCounts).reduce((a, b) => a + b, 0);

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

  <!-- Mood trend -->
  <div style="background:${BRAND_CARD};border-radius:12px;padding:18px;margin-bottom:24px;">
    <h3 style="color:#fff;margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.08em;">
      Mood After Plunging
    </h3>
    <p style="color:${BRAND_MUTED};font-size:12px;margin:0 0 14px;">
      Average: <strong style="color:${BRAND_TEXT};">${avgMoodStr}</strong>
      &nbsp;·&nbsp; ${stats.moodResponded} of ${stats.count} plunges rated (${moodRespondedPct}%)
    </p>
    ${stats.moodResponded > 0 ? `
    <table style="width:100%;border-collapse:collapse;">
      ${[4, 3, 2, 1].map((r) => moodBar(r, stats.moodCounts[r] ?? 0, stats.moodResponded)).join("")}
    </table>
    <p style="color:${BRAND_DIM};font-size:11px;margin:10px 0 0;line-height:1.5;">
      Mood is rated 1–4 after each plunge via an in-app check-in sent ~1 hour later.
    </p>
    ` : `<p style="color:${BRAND_DIM};font-size:13px;margin:0;">No mood check-ins recorded this period.</p>`}
  </div>

  <!-- Motivator -->
  <div style="border-left:3px solid ${BRAND_CYAN};padding-left:14px;margin-bottom:28px;">
    <p style="color:${BRAND_MUTED};font-size:13px;font-style:italic;margin:0;">${motivator}</p>
  </div>

  <hr style="border:none;border-top:1px solid ${BRAND_CARD};margin:0 0 20px;" />
  <p style="color:${BRAND_DIM};font-size:12px;margin:0;line-height:1.6;">
    You received this because you have a ColdStreak account.<br>
    Open the app to see your full history and benefit bar.<br>
    — The ColdStreak Team 🥶
  </p>

</div>`;
}

// ─── Public report runners ────────────────────────────────────────────────────

async function runReport(start: Date, end: Date, periodLabel: string, windowDays: number, isMonthly: boolean) {
  // Fetch all plunges in window with user email in one join query
  const rows = await db
    .select({
      userId:      plunges.userId,
      duration:    plunges.duration,
      temperature: plunges.temperature,
      mood:        plunges.mood,
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

  // Group by userId
  const byUser = new Map<number, { email: string; name: string; plunges: PlungeRow[] }>();
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
      score:       r.score,
      createdAt:   r.createdAt,
    });
  }

  console.log(`[reports] ${periodLabel}: ${byUser.size} user(s) to email`);

  let sent = 0;
  for (const [, { email, name, plunges: userPlunges }] of Array.from(byUser.entries())) {
    try {
      const stats = computeStats(userPlunges);
      const html  = buildReportHtml({ name, periodLabel, isMonthly, stats, windowDays });
      const subj  = isMonthly
        ? `🧊 Your ColdStreak ${periodLabel}`
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
