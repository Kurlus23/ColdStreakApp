/**
 * Brain Freeze — question serving, answer logging, and Lab stats.
 *
 * Questions are seeded lazily from server/data/brain-freeze-questions.json
 * on the first GET /api/brain-freeze/question call.
 */

import { db } from "./db";
import { brainFreezeQuestions, brainFreezeAnswers } from "../shared/schema";
import { eq, and, notInArray, gte, desc, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// ─── Lazy seeder ─────────────────────────────────────────────────────────────

let _seeded = false;

async function ensureSeeded() {
  if (_seeded) return;
  const [first] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);
  if (first) { _seeded = true; return; }

  const filePath = path.join(process.cwd(), "server/data/brain-freeze-questions.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const questions: Array<{
    id: string; category: string; difficulty: string;
    question: string; correct: string; wrong: string[]; explanation: string;
  }> = JSON.parse(raw);

  const CHUNK = 50;
  for (let i = 0; i < questions.length; i += CHUNK) {
    await db.insert(brainFreezeQuestions)
      .values(questions.slice(i, i + CHUNK).map(q => ({
        externalId: q.id,
        category:   q.category,
        difficulty: q.difficulty,
        question:   q.question,
        correct:    q.correct,
        wrong:      q.wrong,
        explanation: q.explanation,
      })))
      .onConflictDoNothing();
  }
  _seeded = true;
  console.log(`[brain-freeze] seeded ${questions.length} questions`);
}

// ─── Question serving ─────────────────────────────────────────────────────────

export async function getQuestion(userId: number) {
  await ensureSeeded();

  // Avoid questions answered in the last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const seen = await db
    .select({ questionId: brainFreezeAnswers.questionId })
    .from(brainFreezeAnswers)
    .where(and(
      eq(brainFreezeAnswers.userId, userId),
      gte(brainFreezeAnswers.answeredAt, cutoff),
    ));
  const seenIds = seen.map(r => r.questionId);

  let q;
  if (seenIds.length > 0) {
    [q] = await db
      .select()
      .from(brainFreezeQuestions)
      .where(notInArray(brainFreezeQuestions.id, seenIds))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }
  // Fall back to any question if all 200 have been seen recently
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

export async function logAnswer(data: {
  userId:               number;
  questionId:           number;
  isCorrect:            boolean;
  responseTimeMs:       number;
  inPlunge:             boolean;
  plungeElapsedSeconds?: number | null;
  waterTempF?:          number | null;
  plungeId?:            number | null;
}) {
  const [row] = await db
    .insert(brainFreezeAnswers)
    .values({
      userId:               data.userId,
      questionId:           data.questionId,
      isCorrect:            data.isCorrect,
      responseTimeMs:       data.responseTimeMs,
      inPlunge:             data.inPlunge,
      plungeElapsedSeconds: data.plungeElapsedSeconds ?? null,
      waterTempF:           data.waterTempF ?? null,
      plungeId:             data.plungeId ?? null,
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
