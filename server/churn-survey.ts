import { db } from "./db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { sendChurnSurveyEmail } from "./email";

// Tunables — kept conservative so we don't spam.
const INACTIVITY_DAYS = 7;          // must be silent at least this many days
const MIN_ACCOUNT_AGE_DAYS = 8;     // don't email brand-new signups
const RESEND_COOLDOWN_DAYS = 60;    // never email same user again within this
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://coldstreakapp.com";

// Pick the right base URL for survey links — env override wins, otherwise prod.
function buildSurveyUrl(token: string): string {
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/feedback/${token}`;
}

interface InactiveCandidate {
  id: number;
  email: string;
  display_name: string | null;
  last_plunge_at: Date | null;
  days_inactive: number;
}

// Find users that should receive the churn-survey email right now.
async function findInactiveUsers(): Promise<InactiveCandidate[]> {
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.display_name,
      MAX(p.created_at) AS last_plunge_at,
      EXTRACT(DAY FROM (NOW() - COALESCE(MAX(p.created_at), u.created_at)))::int AS days_inactive
    FROM users u
    LEFT JOIN plunges p ON p.user_id = u.id
    WHERE u.is_disabled = FALSE
      AND u.email_verified = TRUE
      AND u.created_at < NOW() - (${MIN_ACCOUNT_AGE_DAYS} || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM churn_surveys cs
        WHERE cs.user_id = u.id
          AND cs.sent_at > NOW() - (${RESEND_COOLDOWN_DAYS} || ' days')::interval
      )
    GROUP BY u.id, u.email, u.display_name, u.created_at
    HAVING COALESCE(MAX(p.created_at), u.created_at) < NOW() - (${INACTIVITY_DAYS} || ' days')::interval
    ORDER BY days_inactive DESC
    LIMIT 50
  `);
  return rows.rows as unknown as InactiveCandidate[];
}

// Fire one survey email and persist the row. Safe on duplicate sends.
async function sendOne(c: InactiveCandidate): Promise<{ ok: boolean; reason?: string }> {
  const token = crypto.randomBytes(24).toString("hex");
  try {
    await db.execute(sql`
      INSERT INTO churn_surveys (user_id, email, token, days_inactive)
      VALUES (${c.id}, ${c.email}, ${token}, ${c.days_inactive})
    `);
  } catch (err) {
    return { ok: false, reason: `db insert failed: ${(err as Error).message}` };
  }
  try {
    await sendChurnSurveyEmail({
      to: c.email,
      displayName: c.display_name,
      daysInactive: c.days_inactive,
      surveyUrl: buildSurveyUrl(token),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `email failed: ${(err as Error).message}` };
  }
}

// Cron entry point. Returns a summary so admin can trigger manually too.
export async function runChurnSurveyScan(): Promise<{
  candidates: number;
  sent: number;
  failures: Array<{ email: string; reason: string }>;
}> {
  const candidates = await findInactiveUsers();
  let sent = 0;
  const failures: Array<{ email: string; reason: string }> = [];
  for (const c of candidates) {
    const r = await sendOne(c);
    if (r.ok) sent++;
    else failures.push({ email: c.email, reason: r.reason ?? "unknown" });
  }
  if (candidates.length > 0) {
    console.log(`[churn-survey] candidates=${candidates.length} sent=${sent} failed=${failures.length}`);
  }
  return { candidates: candidates.length, sent, failures };
}

// Mark old surveys as "came_back" if user has plunged after the survey was sent.
// Lets admin see whether the user re-engaged regardless of email response.
export async function reconcileCameBack(): Promise<void> {
  await db.execute(sql`
    UPDATE churn_surveys cs
    SET came_back = TRUE
    WHERE came_back = FALSE
      AND EXISTS (
        SELECT 1 FROM plunges p
        WHERE p.user_id = cs.user_id
          AND p.created_at > cs.sent_at
      )
  `);
}

// Survey-page data fetch (no auth needed, the token IS the auth).
export async function getSurveyByToken(token: string): Promise<{
  id: number;
  email: string;
  displayName: string | null;
  daysInactive: number;
  alreadyResponded: boolean;
} | null> {
  const r = await db.execute(sql`
    SELECT cs.id, cs.email, cs.days_inactive, cs.responded_at,
           u.display_name
    FROM churn_surveys cs
    LEFT JOIN users u ON u.id = cs.user_id
    WHERE cs.token = ${token}
    LIMIT 1
  `);
  const row = r.rows?.[0] as
    | { id: number; email: string; days_inactive: number; responded_at: Date | null; display_name: string | null }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    daysInactive: row.days_inactive,
    alreadyResponded: !!row.responded_at,
  };
}

const ALLOWED_REASONS = new Set([
  "too_cold",
  "lost_interest",
  "app_issue",
  "found_other",
  "life_busy",
  "other",
]);

export async function recordSurveyResponse(
  token: string,
  reason: string,
  comment: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!ALLOWED_REASONS.has(reason)) return { ok: false, reason: "invalid reason" };
  const trimmed = comment?.slice(0, 2000) ?? null;
  const r = await db.execute(sql`
    UPDATE churn_surveys
    SET reason = ${reason},
        comment = ${trimmed},
        responded_at = COALESCE(responded_at, NOW())
    WHERE token = ${token}
    RETURNING id
  `);
  if (!r.rows || r.rows.length === 0) return { ok: false, reason: "survey not found" };
  return { ok: true };
}

export async function listChurnSurveys(): Promise<Array<{
  id: number;
  email: string;
  daysInactive: number;
  sentAt: Date;
  respondedAt: Date | null;
  reason: string | null;
  comment: string | null;
  cameBack: boolean;
}>> {
  const r = await db.execute(sql`
    SELECT id, email, days_inactive, sent_at, responded_at, reason, comment, came_back
    FROM churn_surveys
    ORDER BY sent_at DESC
    LIMIT 500
  `);
  return (r.rows ?? []).map((row: any) => ({
    id: row.id,
    email: row.email,
    daysInactive: row.days_inactive,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    reason: row.reason,
    comment: row.comment,
    cameBack: row.came_back,
  }));
}
