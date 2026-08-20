/**
 * Brain Freeze — question serving, answer logging, and Lab stats.
 *
 * Questions are seeded lazily from server/data/brain-freeze-questions.json
 * on the first GET /api/brain-freeze/question call.
 */

import { db } from "./db";
import { brainFreezeQuestions, brainFreezeAnswers, brainFreezeChallenges, plunges, users } from "../shared/schema";
import { eq, and, or, ne, notInArray, inArray, gte, lt, desc, isNull, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// ─── Lazy seeder ─────────────────────────────────────────────────────────────

let _seeded = false;

async function ensureSeeded() {
  if (_seeded) return;

  const filePath = path.join(process.cwd(), "server/data/brain-freeze-questions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const questions: Array<{
    id: string; category: string; difficulty: string;
    question: string; correct: string; wrong: string[]; explanation: string;
  }> = JSON.parse(raw);

  const jsonIds = questions.map(q => q.id);

  // Count how many of the JSON's external IDs already exist in the DB.
  // Using a membership check (WHERE external_id IN (...)) rather than a
  // total-row-count comparison means we correctly detect missing questions
  // even when the DB has the same (or more) total rows — e.g. after a
  // question ID is replaced or legacy rows are present.
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(brainFreezeQuestions)
    .where(inArray(brainFreezeQuestions.externalId, jsonIds));

  const dbMatchCount = countRow?.count ?? 0;

  if (dbMatchCount >= questions.length) {
    // All JSON questions are present in the DB — nothing to do.
    _seeded = true;
    return;
  }

  // One or more JSON questions are missing from the DB.
  // Upsert the full set using ON CONFLICT external_id DO UPDATE so that:
  //   - Missing rows are inserted
  //   - Existing rows are updated in-place → FK from brain_freeze_answers stays valid
  // This preserves all user answer history while adding/updating question content.
  console.log(`[brain-freeze] DB has ${dbMatchCount}/${questions.length} JSON questions — upserting missing entries`);
  const CHUNK = 50;
  let upserted = 0;
  for (let i = 0; i < questions.length; i += CHUNK) {
    const batch = questions.slice(i, i + CHUNK).map(q => ({
      externalId:  q.id,
      category:    q.category,
      difficulty:  q.difficulty,
      question:    q.question,
      correct:     q.correct,
      wrong:       q.wrong,
      explanation: q.explanation,
    }));
    await db.insert(brainFreezeQuestions)
      .values(batch)
      .onConflictDoUpdate({
        target: brainFreezeQuestions.externalId,
        set: {
          category:    sql`excluded.category`,
          difficulty:  sql`excluded.difficulty`,
          question:    sql`excluded.question`,
          correct:     sql`excluded.correct`,
          wrong:       sql`excluded.wrong`,
          explanation: sql`excluded.explanation`,
        },
      });
    upserted += batch.length;
  }
  _seeded = true;
  console.log(`[brain-freeze] upserted ${upserted} questions (matched=${dbMatchCount}, json=${questions.length})`);
}

/**
 * Admin-only: delete all existing questions and re-seed from the JSON file.
 * Safe to run while the server is live — the delete + insert is sequential.
 */
export async function reseedBrainFreezeQuestions(): Promise<{ upserted: number }> {
  // Reset the in-memory seed flag
  _seeded = false;

  // Read the current question bank from disk
  const filePath = path.join(process.cwd(), "server/data/brain-freeze-questions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const questions: Array<{
    id: string; category: string; difficulty: string;
    question: string; correct: string; wrong: string[]; explanation: string;
  }> = JSON.parse(raw);

  // Upsert by externalId so FK references from brain_freeze_answers stay intact.
  const CHUNK = 50;
  let upserted = 0;
  for (let i = 0; i < questions.length; i += CHUNK) {
    const batch = questions.slice(i, i + CHUNK).map(q => ({
      externalId:  q.id,
      category:    q.category,
      difficulty:  q.difficulty,
      question:    q.question,
      correct:     q.correct,
      wrong:       q.wrong,
      explanation: q.explanation,
    }));
    await db.insert(brainFreezeQuestions)
      .values(batch)
      .onConflictDoUpdate({
        target: brainFreezeQuestions.externalId,
        set: {
          category:    sql`excluded.category`,
          difficulty:  sql`excluded.difficulty`,
          question:    sql`excluded.question`,
          correct:     sql`excluded.correct`,
          wrong:       sql`excluded.wrong`,
          explanation: sql`excluded.explanation`,
        },
      });
    upserted += batch.length;
  }
  _seeded = true;
  console.log(`[brain-freeze] admin reseed complete: upserted=${upserted}`);
  return { upserted };
}

// ─── Question serving ─────────────────────────────────────────────────────────

/**
 * Pure helper: given a pool of candidate questions and the category of the
 * user's last-answered question, pick one — preferring a different category to
 * avoid back-to-back repetition.  Falls back to the full pool only when every
 * candidate belongs to the same category.
 *
 * Exported for unit testing.
 */
export function pickFromPool<T extends { category: string }>(
  pool: T[],
  lastCategory: string | null,
): T | null {
  if (pool.length === 0) return null;
  const diffCat = lastCategory
    ? pool.filter(q => q.category !== lastCategory)
    : pool;
  const candidates = diffCat.length > 0 ? diffCat : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

const COLD_PLUNGE_CATEGORY = "Cold Plunge & Ice Bath";

export async function getQuestion(userId: number, preferColdPlunge = false) {
  await ensureSeeded();

  // Avoid questions answered in the last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentAnswers = await db
    .select({ questionId: brainFreezeAnswers.questionId })
    .from(brainFreezeAnswers)
    .where(and(
      eq(brainFreezeAnswers.userId, userId),
      gte(brainFreezeAnswers.answeredAt, cutoff),
    ));
  const seenIds = recentAnswers.map(r => r.questionId);

  // ── Cold Plunge slot (every 3rd question) ────────────────────────────────
  // No exclusion window for cold-plunge questions — always pick randomly from
  // the full pool so active users always get cold-specific content.
  if (preferColdPlunge) {
    const [cpQ] = await db
      .select()
      .from(brainFreezeQuestions)
      .where(eq(brainFreezeQuestions.category, COLD_PLUNGE_CATEGORY))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    if (cpQ) return cpQ;
    // No cold-plunge questions seeded yet — fall through to general pool
  }

  // Find the category of the user's most-recently answered question so we can
  // avoid serving the same category back-to-back.
  const [lastAnswerRow] = await db
    .select({ category: brainFreezeQuestions.category })
    .from(brainFreezeAnswers)
    .innerJoin(brainFreezeQuestions, eq(brainFreezeAnswers.questionId, brainFreezeQuestions.id))
    .where(eq(brainFreezeAnswers.userId, userId))
    .orderBy(desc(brainFreezeAnswers.answeredAt))
    .limit(1);
  const lastCategory = lastAnswerRow?.category ?? null;

  // ── 1. Best case: unseen + different category ────────────────────────────
  let q;
  if (seenIds.length > 0 && lastCategory) {
    [q] = await db
      .select()
      .from(brainFreezeQuestions)
      .where(and(
        notInArray(brainFreezeQuestions.id, seenIds),
        ne(brainFreezeQuestions.category, lastCategory),
      ))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else if (lastCategory) {
    [q] = await db
      .select()
      .from(brainFreezeQuestions)
      .where(ne(brainFreezeQuestions.category, lastCategory))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  // ── 2. Fallback: unseen, any category ────────────────────────────────────
  if (!q && seenIds.length > 0) {
    [q] = await db
      .select()
      .from(brainFreezeQuestions)
      .where(notInArray(brainFreezeQuestions.id, seenIds))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  // ── 3. Final fallback: all questions (all seen recently) ─────────────────
  if (!q) {
    [q] = await db
      .select()
      .from(brainFreezeQuestions)
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  return q ?? null;
}

// ─── Answer logging ───────────────────────────────────────────────────────────

/**
 * Speed tiers (0-indexed, evaluated in order against responseTimeMs).
 * "No answer" (timedOut) always returns 0 before reaching this table.
 */
const SPEED_TIERS = [
  { maxMs:  4_000, correct: 125, wrong: 25 }, // instant   0–4 s
  { maxMs:  8_000, correct: 110, wrong: 20 }, // fast      4–8 s
  { maxMs: 14_000, correct:  90, wrong: 10 }, // normal    8–14 s
  { maxMs: 20_000, correct:  60, wrong:   5 }, // slow/barely  14–20 s
] as const;

/**
 * Cold-water multiplier applied only during an active plunge.
 * Colder water → bigger bonus (reward for playing while genuinely cold).
 */
function coldTempMultiplier(waterTempF: number | null | undefined): number {
  if (!waterTempF) return 1.0;
  if (waterTempF < 40) return 1.50; // sub-4 °C — extreme
  if (waterTempF < 50) return 1.30; // 4–10 °C — very cold
  if (waterTempF < 60) return 1.15; // 10–15 °C — cold
  return 1.0;                        // ≥ 15 °C — mild, no bonus
}

/**
 * Compute points for a Brain Freeze answer.
 *
 * - timedOut (no tap)            → 0
 * - Wrong answers score by speed (25 / 20 / 10 / 5)
 * - Correct answers score by speed (125 / 110 / 90 / 60)
 * - In-plunge answers get a cold-temp multiplier (1.0–1.5×)
 */
export function computePoints(
  isCorrect:     boolean,
  responseTimeMs: number,
  waterTempF?:   number | null,
  timedOut?:     boolean,
): number {
  if (timedOut) return 0;
  const tier = SPEED_TIERS.find(t => responseTimeMs <= t.maxMs) ?? SPEED_TIERS[SPEED_TIERS.length - 1];
  const base = isCorrect ? tier.correct : tier.wrong;
  const multiplier = waterTempF ? coldTempMultiplier(waterTempF) : 1.0;
  return Math.round(base * multiplier);
}

export async function logAnswer(data: {
  userId:               number;
  questionId:           number;
  isCorrect:            boolean;
  responseTimeMs:       number;
  timedOut?:            boolean;
  inPlunge:             boolean;
  plungeElapsedSeconds?: number | null;
  waterTempF?:          number | null;
  plungeId?:            number | null;
  challengeId?:         number | null;
}) {
  const pointsEarned = computePoints(data.isCorrect, data.responseTimeMs, data.waterTempF, data.timedOut);
  const [row] = await db
    .insert(brainFreezeAnswers)
    .values({
      userId:               data.userId,
      questionId:           data.questionId,
      isCorrect:            data.isCorrect,
      responseTimeMs:       data.responseTimeMs,
      pointsEarned,
      inPlunge:             data.inPlunge,
      plungeElapsedSeconds: data.plungeElapsedSeconds ?? null,
      waterTempF:           data.waterTempF ?? null,
      plungeId:             data.plungeId ?? null,
      challengeId:          data.challengeId ?? null,
    })
    .returning();
  return row;
}

// ─── Lab stats ────────────────────────────────────────────────────────────────

const MIN_FOR_STAT = 10; // answers per context before we show a stat

export interface BrainFreezeLabStats {
  totalAnswers: number;
  inPlunge: ContextStats | null;
  outOfPlunge: ContextStats | null;
  byMinute: MinuteBucket[] | null;
  byTemp: TempBucket[] | null;
  adaptation: AdaptationStats | null;
  minForStat: number;
}

export interface ContextStats {
  count: number;
  accuracy: number;       // 0–1
  avgResponseMs: number;
  fastestResponseMs: number;
}

export interface MinuteBucket {
  label: string;          // "0–1 min", "1–2 min", …
  accuracy: number;
  count: number;
}

export interface TempBucket {
  label: string;          // "40–45°F", …
  accuracy: number;
  avgResponseMs: number;
  count: number;
}

export interface AdaptationStats {
  early:  { accuracy: number; avgResponseMs: number };
  recent: { accuracy: number; avgResponseMs: number };
  weeksTracked: number;
}

export async function getLabStats(userId: number): Promise<BrainFreezeLabStats | null> {
  const answers = await db
    .select()
    .from(brainFreezeAnswers)
    .where(eq(brainFreezeAnswers.userId, userId))
    .orderBy(desc(brainFreezeAnswers.answeredAt));

  if (answers.length === 0) return null;

  const inPlunge    = answers.filter(a => a.inPlunge);
  const outOfPlunge = answers.filter(a => !a.inPlunge);

  const contextStat = (arr: typeof answers): ContextStats | null => {
    if (arr.length < MIN_FOR_STAT) return null;
    return {
      count:            arr.length,
      accuracy:         +(arr.filter(a => a.isCorrect).length / arr.length).toFixed(3),
      avgResponseMs:    Math.round(arr.reduce((s, a) => s + a.responseTimeMs, 0) / arr.length),
      fastestResponseMs: Math.min(...arr.map(a => a.responseTimeMs)),
    };
  };

  // ── Consistency: accuracy by minute of plunge ──────────────────────────────
  const buckets: Record<number, { correct: number; total: number }> = {};
  for (const a of inPlunge) {
    if (a.plungeElapsedSeconds == null) continue;
    const b = Math.min(4, Math.floor(a.plungeElapsedSeconds / 60));
    if (!buckets[b]) buckets[b] = { correct: 0, total: 0 };
    if (a.isCorrect) buckets[b].correct++;
    buckets[b].total++;
  }
  const byMinute: MinuteBucket[] = Object.entries(buckets)
    .filter(([, v]) => v.total >= 3)
    .map(([b, v]) => ({
      label:    Number(b) < 4 ? `${b}–${Number(b) + 1} min` : `${b}+ min`,
      accuracy: +(v.correct / v.total).toFixed(3),
      count:    v.total,
    }))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label));

  // ── Temperature breakdown ──────────────────────────────────────────────────
  const TEMP_BANDS = [
    { label: "35–40°F", min: 35, max: 40 },
    { label: "40–45°F", min: 40, max: 45 },
    { label: "45–50°F", min: 45, max: 50 },
    { label: "50–55°F", min: 50, max: 55 },
    { label: "55–60°F", min: 55, max: 60 },
    { label: "60°F+",   min: 60, max: 999 },
  ];
  const byTemp: TempBucket[] = TEMP_BANDS.map(band => {
    const sub = inPlunge.filter(a =>
      a.waterTempF != null && a.waterTempF >= band.min && a.waterTempF < band.max,
    );
    if (sub.length < 5) return null;
    return {
      label:        band.label,
      accuracy:     +(sub.filter(a => a.isCorrect).length / sub.length).toFixed(3),
      avgResponseMs: Math.round(sub.reduce((s, a) => s + a.responseTimeMs, 0) / sub.length),
      count:        sub.length,
    };
  }).filter((x): x is TempBucket => x !== null);

  // ── Adaptation: first 4 weeks vs recent 4 weeks (in-plunge only) ──────────
  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
  const now       = Date.now();
  const earliest  = inPlunge.length
    ? new Date(inPlunge[inPlunge.length - 1].answeredAt).getTime()
    : now;
  const weeksTracked = Math.round((now - earliest) / (7 * 24 * 60 * 60 * 1000));

  let adaptation: AdaptationStats | null = null;
  if (weeksTracked >= 3) {
    const early  = inPlunge.filter(a => new Date(a.answeredAt).getTime() - earliest < FOUR_WEEKS_MS);
    const recent = inPlunge.filter(a => now - new Date(a.answeredAt).getTime() < FOUR_WEEKS_MS);
    if (early.length >= MIN_FOR_STAT && recent.length >= MIN_FOR_STAT) {
      adaptation = {
        early: {
          accuracy:     +(early.filter(a => a.isCorrect).length / early.length).toFixed(3),
          avgResponseMs: Math.round(early.reduce((s, a) => s + a.responseTimeMs, 0) / early.length),
        },
        recent: {
          accuracy:     +(recent.filter(a => a.isCorrect).length / recent.length).toFixed(3),
          avgResponseMs: Math.round(recent.reduce((s, a) => s + a.responseTimeMs, 0) / recent.length),
        },
        weeksTracked,
      };
    }
  }

  return {
    totalAnswers: answers.length,
    inPlunge:     contextStat(inPlunge),
    outOfPlunge:  contextStat(outOfPlunge),
    byMinute:     byMinute.length >= 2 ? byMinute : null,
    byTemp:       byTemp.length >= 2 ? byTemp : null,
    adaptation,
    minForStat:   MIN_FOR_STAT,
  };
}

// ─── Link in-plunge answers to a saved plunge record ────────────────────────

/**
 * After createPlunge succeeds, back-fill plungeId on any brain_freeze_answers
 * that were logged during that session (inPlunge=true, plungeId IS NULL,
 * answeredAt >= since, userId matches).
 */
export async function linkAnswersToPlunge(data: {
  userId:   number;
  plungeId: number;
  since:    Date;
}): Promise<number> {
  const result = await db
    .update(brainFreezeAnswers)
    .set({ plungeId: data.plungeId })
    .where(
      and(
        eq(brainFreezeAnswers.userId, data.userId),
        eq(brainFreezeAnswers.inPlunge, true),
        gte(brainFreezeAnswers.answeredAt, data.since),
        sql`${brainFreezeAnswers.plungeId} IS NULL`,
      )
    )
    .returning({ id: brainFreezeAnswers.id });
  return result.length;
}

// ─── Head-to-head record between two players ─────────────────────────────────

export interface BrainFreezeHeadToHead {
  wins:   number;
  losses: number;
  ties:   number;
}

/**
 * Aggregate completed Brain Freeze challenges between `userId` and `friendId`.
 * Returns null when no completed challenges exist between the pair.
 */
export async function getBrainFreezeHeadToHead(
  userId:   number,
  friendId: number,
): Promise<BrainFreezeHeadToHead | null> {
  const completed = await db
    .select({
      winnerId:     brainFreezeChallenges.winnerId,
      challengerId: brainFreezeChallenges.challengerId,
      challengeeId: brainFreezeChallenges.challengeeId,
    })
    .from(brainFreezeChallenges)
    .where(
      and(
        eq(brainFreezeChallenges.status, "complete"),
        or(
          and(
            eq(brainFreezeChallenges.challengerId, userId),
            eq(brainFreezeChallenges.challengeeId, friendId),
          ),
          and(
            eq(brainFreezeChallenges.challengerId, friendId),
            eq(brainFreezeChallenges.challengeeId, userId),
          ),
        ),
      )
    );

  if (completed.length === 0) return null;

  let wins = 0, losses = 0, ties = 0;
  for (const c of completed) {
    if (c.winnerId === null) {
      ties++;
    } else if (c.winnerId === userId) {
      wins++;
    } else {
      losses++;
    }
  }
  return { wins, losses, ties };
}

// ─── Quick summary for weekly/monthly email reports ───────────────────────────

export interface BrainFreezeEmailStats {
  inColdAccuracy:    number;   // 0–1
  outColdAccuracy:   number;   // 0–1
  inColdAvgMs:       number;
  outColdAvgMs:      number;
  totalAnswers:      number;
  inPlungeCount:     number;
  outPlungeCount:    number;
  accuracyDeltaPct:  number;   // positive = better in cold
  adaptationNote:    string | null; // e.g. "Up 10 pts vs your first 4 weeks"
}

// ─── Brain Freeze Challenges ──────────────────────────────────────────────────

const CHALLENGE_Q_COUNT  = 10;
const CHALLENGE_EXPIRY_H = 48;

/** Pick CHALLENGE_Q_COUNT question IDs, avoiding recent history of both players. */
export async function pickChallengeQuestions(
  challengerId: number,
  challengeeId: number,
): Promise<number[]> {
  await ensureSeeded();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recent = await db
    .select({ questionId: brainFreezeAnswers.questionId })
    .from(brainFreezeAnswers)
    .where(and(
      inArray(brainFreezeAnswers.userId, [challengerId, challengeeId]),
      gte(brainFreezeAnswers.answeredAt, cutoff),
    ));
  const seenIds = [...new Set(recent.map(r => r.questionId))];

  // Pull a random pool of fresh questions (2× the target size for category diversity)
  const wanted = CHALLENGE_Q_COUNT * 2;
  let pool: { id: number; category: string }[] = [];
  if (seenIds.length > 0) {
    pool = await db
      .select({ id: brainFreezeQuestions.id, category: brainFreezeQuestions.category })
      .from(brainFreezeQuestions)
      .where(notInArray(brainFreezeQuestions.id, seenIds))
      .orderBy(sql`RANDOM()`)
      .limit(wanted);
  } else {
    pool = await db
      .select({ id: brainFreezeQuestions.id, category: brainFreezeQuestions.category })
      .from(brainFreezeQuestions)
      .orderBy(sql`RANDOM()`)
      .limit(wanted);
  }

  // Top-up if not enough fresh questions
  if (pool.length < CHALLENGE_Q_COUNT) {
    const haveIds = pool.map(q => q.id);
    const extra = await db
      .select({ id: brainFreezeQuestions.id, category: brainFreezeQuestions.category })
      .from(brainFreezeQuestions)
      .where(haveIds.length ? notInArray(brainFreezeQuestions.id, haveIds) : sql`true`)
      .orderBy(sql`RANDOM()`)
      .limit(CHALLENGE_Q_COUNT - pool.length);
    pool = [...pool, ...extra];
  }

  // Greedy category-diversity pass: avoid back-to-back same category
  const selected: { id: number; category: string }[] = [];
  for (const q of pool) {
    if (selected.length >= CHALLENGE_Q_COUNT) break;
    const lastCat = selected[selected.length - 1]?.category ?? null;
    const otherCats = pool.filter(p => p.category !== lastCat && !selected.some(s => s.id === p.id));
    if (lastCat && lastCat === q.category && otherCats.length > 0) continue;
    selected.push(q);
  }
  // Fill any remaining slots
  if (selected.length < CHALLENGE_Q_COUNT) {
    const taken = new Set(selected.map(q => q.id));
    for (const q of pool) {
      if (selected.length >= CHALLENGE_Q_COUNT) break;
      if (!taken.has(q.id)) selected.push(q);
    }
  }

  return selected.slice(0, CHALLENGE_Q_COUNT).map(q => q.id);
}

/** Fetch full question objects in the original challenge order. */
async function getQuestionsById(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(brainFreezeQuestions)
    .where(inArray(brainFreezeQuestions.id, ids));
  const map = new Map(rows.map(q => [q.id, q]));
  return ids.map(id => map.get(id)).filter(Boolean) as (typeof rows);
}

/**
 * Create a BF challenge and return the row plus the ordered question objects.
 *
 * Concurrency-safe: the check for an existing active challenge and the insert
 * are both executed inside a transaction that holds a PostgreSQL session-level
 * advisory lock keyed on (challengerId, challengeeId).  This ensures that two
 * simultaneous POST requests for the same pair cannot both pass the duplicate
 * check and produce two rows.
 *
 * Returns `null` when the challenger already has a non-expired, non-complete
 * challenge against this challengee — the caller should respond with HTTP 409.
 */
export async function createBrainFreezeChallenge(
  challengerId: number,
  challengeeId: number,
): Promise<{ challenge: typeof brainFreezeChallenges.$inferSelect; questions: Awaited<ReturnType<typeof getQuestionsById>> } | null> {
  // Pick questions outside the transaction (read-only, no ordering concerns).
  const questionIds = await pickChallengeQuestions(challengerId, challengeeId);
  const expiresAt   = new Date(Date.now() + CHALLENGE_EXPIRY_H * 3_600_000);

  const row = await db.transaction(async (tx) => {
    // Acquire a transaction-scoped advisory lock for this (challenger, challengee)
    // pair.  pg_advisory_xact_lock blocks until the lock is free and releases
    // automatically when the transaction ends — no manual release needed.
    // The two-argument form takes two int4 values and combines them into a
    // single int8 lock key, so concurrent pairs don't collide.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${challengerId}::int, ${challengeeId}::int)`,
    );

    // Authoritative duplicate check inside the lock.
    const [existing] = await tx
      .select({ id: brainFreezeChallenges.id })
      .from(brainFreezeChallenges)
      .where(
        and(
          eq(brainFreezeChallenges.challengerId, challengerId),
          eq(brainFreezeChallenges.challengeeId, challengeeId),
          ne(brainFreezeChallenges.status, "complete"),
          gte(brainFreezeChallenges.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (existing) return null; // Duplicate — signal 409 to the caller.

    const [inserted] = await tx
      .insert(brainFreezeChallenges)
      .values({ challengerId, challengeeId, questionIds, expiresAt })
      .returning();

    return inserted;
  });

  if (!row) return null;

  const questions = await getQuestionsById(questionIds);
  return { challenge: row, questions };
}

/** Get a challenge with its ordered questions (called when the challengee opens it). */
export async function getBrainFreezeChallenge(challengeId: number) {
  const [row] = await db
    .select()
    .from(brainFreezeChallenges)
    .where(eq(brainFreezeChallenges.id, challengeId));
  if (!row) return null;
  const questions = await getQuestionsById(row.questionIds as number[]);
  return { ...row, questions };
}

/**
 * Delete expired, non-complete Brain Freeze challenges.
 * Safe to run on every pending-challenges fetch — it's fast and idempotent.
 * Returns the number of rows deleted.
 */
export async function deleteExpiredBrainFreezeChallenges(): Promise<number> {
  const result = await db
    .delete(brainFreezeChallenges)
    .where(
      and(
        lt(brainFreezeChallenges.expiresAt, new Date()),
        ne(brainFreezeChallenges.status, "complete"),
      )
    )
    .returning({ id: brainFreezeChallenges.id });
  return result.length;
}

/** List non-expired challenges where userId is the challengee and hasn't played yet. */
export async function getPendingBrainFreezeChallenges(challengeeId: number) {
  return db
    .select()
    .from(brainFreezeChallenges)
    .where(and(
      eq(brainFreezeChallenges.challengeeId, challengeeId),
      inArray(brainFreezeChallenges.status, ["pending", "challenger_done"]),
      gte(brainFreezeChallenges.expiresAt, new Date()),
    ))
    .orderBy(desc(brainFreezeChallenges.createdAt));
}

/**
 * After the player answers all questions, sum their score and detect completion.
 * Returns null if the player hasn't finished all CHALLENGE_Q_COUNT questions yet.
 */
export async function checkAndFinalizeChallengeAnswer(
  challengeId: number,
  userId:      number,
): Promise<{
  statusForCaller: "won" | "lost" | "tie" | "waiting";
  opponentScore:   number | null;
  opponentId:      number;
  isComplete:      boolean;
  myScore:         number;
} | null> {
  const myAnswers = await db
    .select({ pointsEarned: brainFreezeAnswers.pointsEarned })
    .from(brainFreezeAnswers)
    .where(and(
      eq(brainFreezeAnswers.challengeId, challengeId),
      eq(brainFreezeAnswers.userId, userId),
    ));

  if (myAnswers.length < CHALLENGE_Q_COUNT) return null;

  const myScore = myAnswers.reduce((s, r) => s + r.pointsEarned, 0);

  const [challenge] = await db
    .select()
    .from(brainFreezeChallenges)
    .where(eq(brainFreezeChallenges.id, challengeId));
  if (!challenge) return null;

  const isChallenger  = challenge.challengerId === userId;
  const opponentId    = isChallenger ? challenge.challengeeId : challenge.challengerId;
  const opponentScore = isChallenger ? challenge.challengeeScore : challenge.challengerScore;
  const newStatus     = opponentScore !== null
    ? "complete"
    : (isChallenger ? "challenger_done" : "challengee_done");

  let winnerId: number | null = null;
  if (newStatus === "complete" && opponentScore !== null) {
    if (myScore > opponentScore)      winnerId = userId;
    else if (opponentScore > myScore) winnerId = opponentId;
  }

  await db
    .update(brainFreezeChallenges)
    .set({
      ...(isChallenger ? { challengerScore: myScore } : { challengeeScore: myScore }),
      status: newStatus,
      ...(newStatus === "complete" ? { winnerId } : {}),
    })
    .where(eq(brainFreezeChallenges.id, challengeId));

  let statusForCaller: "won" | "lost" | "tie" | "waiting";
  if (newStatus === "complete") {
    if (winnerId === null)        statusForCaller = "tie";
    else if (winnerId === userId) statusForCaller = "won";
    else                          statusForCaller = "lost";
  } else {
    statusForCaller = "waiting";
  }

  return { statusForCaller, opponentScore: opponentScore ?? null, opponentId, isComplete: newStatus === "complete", myScore };
}

export async function getEmailLabStats(
  userId: number,
  periodStart: Date,
  periodEnd: Date,
): Promise<BrainFreezeEmailStats | null> {
  const answers = await db
    .select()
    .from(brainFreezeAnswers)
    .where(and(
      eq(brainFreezeAnswers.userId, userId),
      gte(brainFreezeAnswers.answeredAt, periodStart),
    ))
    .orderBy(desc(brainFreezeAnswers.answeredAt));

  const inP  = answers.filter(a => a.inPlunge);
  const outP = answers.filter(a => !a.inPlunge);
  if (inP.length < 5 || outP.length < 5) return null;

  const acc = (arr: typeof answers) => arr.filter(a => a.isCorrect).length / arr.length;
  const avgMs = (arr: typeof answers) => Math.round(arr.reduce((s, a) => s + a.responseTimeMs, 0) / arr.length);

  const inAcc  = acc(inP);
  const outAcc = acc(outP);

  // Check all-time adaptation note
  const allTime = await getLabStats(userId);
  let adaptationNote: string | null = null;
  if (allTime?.adaptation) {
    const delta = allTime.adaptation.recent.accuracy - allTime.adaptation.early.accuracy;
    if (Math.abs(delta) >= 0.05) {
      const dir = delta > 0 ? "up" : "down";
      adaptationNote = `Your in-cold accuracy is ${dir} ${Math.round(Math.abs(delta) * 100)} points vs your first 4 weeks of data.`;
    }
  }

  return {
    inColdAccuracy:   +inAcc.toFixed(3),
    outColdAccuracy:  +outAcc.toFixed(3),
    inColdAvgMs:      avgMs(inP),
    outColdAvgMs:     avgMs(outP),
    totalAnswers:     answers.length,
    inPlungeCount:    inP.length,
    outPlungeCount:   outP.length,
    accuracyDeltaPct: +((inAcc - outAcc) * 100).toFixed(1),
    adaptationNote,
  };
}

// ─── Admin: aggregate Brain Freeze usage stats ───────────────────────────────

export interface BrainFreezeAdminPlungeBreakdown {
  plungeId: number;
  duration: number;
  questionTotal: number;
  correct: number;
  pts: number;
  startedAt: string;
}

export type BrainFreezeAdminPeriod = "all" | "30d" | "7d";

export async function getBrainFreezeAdminStats(period: BrainFreezeAdminPeriod = "all") {
  const now   = new Date();
  const ago7  = new Date(now.getTime() -  7 * 86400_000);
  const ago30 = new Date(now.getTime() - 30 * 86400_000);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodCondition = period === "7d"
    ? gte(brainFreezeAnswers.answeredAt, ago7)
    : period === "30d"
      ? gte(brainFreezeAnswers.answeredAt, ago30)
      : sql`true`;

  // Keep the comparison cards and points-by-period cards all-time/current,
  // even while the selected period changes the leaderboard below.
  const [allTimeTotals] = await db
    .select({
      total:    sql<number>`count(*)::int`,
      correct:  sql<number>`sum(case when ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      inPlunge: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge}  then 1 else 0 end)::int`,
      pts:      sql<number>`coalesce(sum(${brainFreezeAnswers.pointsEarned}), 0)::int`,
      players:  sql<number>`count(distinct ${brainFreezeAnswers.userId})::int`,
      last7d:   sql<number>`sum(case when ${brainFreezeAnswers.answeredAt} >= ${ago7}  then 1 else 0 end)::int`,
      last30d:  sql<number>`sum(case when ${brainFreezeAnswers.answeredAt} >= ${ago30} then 1 else 0 end)::int`,
      players7d:  sql<number>`count(distinct case when ${brainFreezeAnswers.answeredAt} >= ${ago7}  then ${brainFreezeAnswers.userId} end)::int`,
      players30d: sql<number>`count(distinct case when ${brainFreezeAnswers.answeredAt} >= ${ago30} then ${brainFreezeAnswers.userId} end)::int`,
      pointsToday: sql<number>`coalesce(sum(case when ${brainFreezeAnswers.answeredAt} >= ${todayStart} then ${brainFreezeAnswers.pointsEarned} else 0 end), 0)::int`,
      pointsWeek:  sql<number>`coalesce(sum(case when ${brainFreezeAnswers.answeredAt} >= ${weekStart} then ${brainFreezeAnswers.pointsEarned} else 0 end), 0)::int`,
      pointsMonth: sql<number>`coalesce(sum(case when ${brainFreezeAnswers.answeredAt} >= ${monthStart} then ${brainFreezeAnswers.pointsEarned} else 0 end), 0)::int`,
      inPlungeCorrect: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      inPlungeAnswers: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
      outOfPlungeCorrect: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      outOfPlungeAnswers: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
    })
    .from(brainFreezeAnswers);

  const [periodTotals] = await db
    .select({
      total:    sql<number>`count(*)::int`,
      correct:  sql<number>`sum(case when ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      inPlunge: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
      pts:      sql<number>`coalesce(sum(${brainFreezeAnswers.pointsEarned}), 0)::int`,
      players:  sql<number>`count(distinct ${brainFreezeAnswers.userId})::int`,
      inPlungeCorrect: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      inPlungeAnswers: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
      outOfPlungeCorrect: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      outOfPlungeAnswers: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
    })
    .from(brainFreezeAnswers)
    .where(periodCondition);

  // Daily answer count for last 30 days
  const trend = await db
    .select({
      date:  sql<string>`(date_trunc('day', ${brainFreezeAnswers.answeredAt}) at time zone 'utc')::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(brainFreezeAnswers)
    .where(gte(brainFreezeAnswers.answeredAt, ago30))
    .groupBy(sql`date_trunc('day', ${brainFreezeAnswers.answeredAt})`)
    .orderBy(sql`date_trunc('day', ${brainFreezeAnswers.answeredAt})`);

  // Per-user leaderboard — top 25 by total points
  const leaderboard = await db
    .select({
      userId:      brainFreezeAnswers.userId,
      email:       users.email,
      username:    users.username,
      displayName: users.displayName,
      answers:     sql<number>`count(*)::int`,
      correct:     sql<number>`sum(case when ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      pts:         sql<number>`coalesce(sum(${brainFreezeAnswers.pointsEarned}), 0)::int`,
      inPlunge:    sql<number>`sum(case when ${brainFreezeAnswers.inPlunge}  then 1 else 0 end)::int`,
      inPlungeCorrect: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      inPlungeAnswers: sql<number>`sum(case when ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
      outOfPlungeCorrect: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} and ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
      outOfPlungeAnswers: sql<number>`sum(case when not ${brainFreezeAnswers.inPlunge} then 1 else 0 end)::int`,
      lastPlayed:  sql<string>`max(${brainFreezeAnswers.answeredAt})::text`,
    })
    .from(brainFreezeAnswers)
    .innerJoin(users, eq(brainFreezeAnswers.userId, users.id))
    .where(periodCondition)
    .groupBy(brainFreezeAnswers.userId, users.email, users.username, users.displayName)
    .orderBy(sql`coalesce(sum(${brainFreezeAnswers.pointsEarned}), 0) desc`)
    .limit(25);

  // Keep the per-plunge view separate from the all-time leaderboard totals.
  // In-plunge answers are back-filled with plungeId after a plunge is saved, so
  // joining to plunges gives Admin the actual duration for every grouped set.
  const leaderboardUserIds = leaderboard.map(row => row.userId);
  const plungeBreakdownRows = leaderboardUserIds.length > 0
    ? await db
      .select({
        userId:       brainFreezeAnswers.userId,
        plungeId:     plunges.id,
        duration:     plunges.duration,
        questionTotal: sql<number>`count(*)::int`,
        correct:      sql<number>`sum(case when ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
        pts:          sql<number>`coalesce(sum(${brainFreezeAnswers.pointsEarned}), 0)::int`,
        startedAt:    sql<string>`${plunges.createdAt}::text`,
      })
      .from(brainFreezeAnswers)
      .innerJoin(plunges, and(
        eq(brainFreezeAnswers.plungeId, plunges.id),
        eq(brainFreezeAnswers.userId, plunges.userId),
      ))
      .where(and(
        inArray(brainFreezeAnswers.userId, leaderboardUserIds),
        eq(brainFreezeAnswers.inPlunge, true),
        periodCondition,
      ))
      .groupBy(
        brainFreezeAnswers.userId,
        plunges.id,
        plunges.duration,
        plunges.createdAt,
      )
      .orderBy(desc(plunges.createdAt))
    : [];

  // An answer can temporarily remain unlinked if a plunge was not saved, the
  // linking request did not complete, or the saved plunge was removed. Keep
  // these answers visible instead of silently dropping them from the session
  // breakdown. The user match in the join also prevents a malformed answer
  // record from borrowing another player's plunge duration.
  const unlinkedInPlungeRows = leaderboardUserIds.length > 0
    ? await db
      .select({
        userId:   brainFreezeAnswers.userId,
        correct:  sql<number>`sum(case when ${brainFreezeAnswers.isCorrect} then 1 else 0 end)::int`,
        answers:  sql<number>`count(*)::int`,
      })
      .from(brainFreezeAnswers)
      .leftJoin(plunges, and(
        eq(brainFreezeAnswers.plungeId, plunges.id),
        eq(brainFreezeAnswers.userId, plunges.userId),
      ))
      .where(and(
        inArray(brainFreezeAnswers.userId, leaderboardUserIds),
        eq(brainFreezeAnswers.inPlunge, true),
        isNull(plunges.id),
        periodCondition,
      ))
      .groupBy(brainFreezeAnswers.userId)
    : [];

  const plungeBreakdowns = new Map<number, BrainFreezeAdminPlungeBreakdown[]>();
  for (const row of plungeBreakdownRows) {
    const existing = plungeBreakdowns.get(row.userId) ?? [];
    existing.push({
      plungeId:      row.plungeId,
      duration:      row.duration,
      questionTotal: row.questionTotal,
      correct:       row.correct,
      pts:           row.pts,
      startedAt:     row.startedAt,
    });
    plungeBreakdowns.set(row.userId, existing);
  }
  const unlinkedInPlunge = new Map(
    unlinkedInPlungeRows.map(row => [row.userId, {
      correct: row.correct,
      answers: row.answers,
    }]),
  );

  return {
    period,
    overview: {
      total:      periodTotals?.total      ?? 0,
      correct:    periodTotals?.correct    ?? 0,
      inPlunge:   periodTotals?.inPlunge   ?? 0,
      pts:        periodTotals?.pts        ?? 0,
      players:    periodTotals?.players    ?? 0,
      last7d:     allTimeTotals?.last7d     ?? 0,
      last30d:    allTimeTotals?.last30d    ?? 0,
      players7d:  allTimeTotals?.players7d  ?? 0,
      players30d: allTimeTotals?.players30d ?? 0,
      pointsToday: allTimeTotals?.pointsToday ?? 0,
      pointsWeek:  allTimeTotals?.pointsWeek  ?? 0,
      pointsMonth: allTimeTotals?.pointsMonth ?? 0,
      pointsAllTime: allTimeTotals?.pts ?? 0,
      inPlungeCorrect: periodTotals?.inPlungeCorrect ?? 0,
      inPlungeAnswers: periodTotals?.inPlungeAnswers ?? 0,
      outOfPlungeCorrect: periodTotals?.outOfPlungeCorrect ?? 0,
      outOfPlungeAnswers: periodTotals?.outOfPlungeAnswers ?? 0,
    },
    trend,
    // The nested rows prevent a user's selected-period answer count from being
    // read as the question count of a single plunge.
    leaderboard: leaderboard.map(row => ({
      ...row,
      plunges: plungeBreakdowns.get(row.userId) ?? [],
      unlinkedInPlungeCorrect: unlinkedInPlunge.get(row.userId)?.correct ?? 0,
      unlinkedInPlungeAnswers: unlinkedInPlunge.get(row.userId)?.answers ?? 0,
    })),
  };
}
