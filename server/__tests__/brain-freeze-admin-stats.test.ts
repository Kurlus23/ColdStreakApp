/**
 * Verifies the Admin Brain Freeze leaderboard never presents answers from
 * multiple plunges as though they belonged to one session.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { getBrainFreezeAdminStats } from "../brain-freeze";
import { storage } from "../storage";
import { brainFreezeAnswers, brainFreezeQuestions, plunges } from "@shared/schema";

const TEST_USER_EMAIL = `bf-admin-stats-${process.pid}-${Date.now()}@coldstreak.test`;

let userId: number;
let questionId: number;
let createdUser = false;
const createdAnswerIds: number[] = [];
const createdPlungeIds: number[] = [];

beforeAll(async () => {
  const user = await storage.createUser(TEST_USER_EMAIL, "placeholder-hash");
  createdUser = true;
  userId = user.id;

  const [question] = await db
    .select({ id: brainFreezeQuestions.id })
    .from(brainFreezeQuestions)
    .limit(1);
  if (!question) throw new Error("No Brain Freeze questions are available for the Admin stats test");
  questionId = question.id;
});

afterAll(async () => {
  if (createdAnswerIds.length) {
    await db.delete(brainFreezeAnswers).where(inArray(brainFreezeAnswers.id, createdAnswerIds));
  }
  if (createdPlungeIds.length) {
    await db.delete(plunges).where(inArray(plunges.id, createdPlungeIds));
  }
  if (createdUser) await storage.deleteUser(userId);
});

async function createPlunge(duration: number) {
  const [plunge] = await db.insert(plunges).values({
    userId,
    duration,
    temperature: 45,
    score: "100.00",
  }).returning({ id: plunges.id });
  createdPlungeIds.push(plunge.id);
  return plunge.id;
}

async function createAnswer(data: {
  plungeId?: number;
  inPlunge: boolean;
  isCorrect: boolean;
  pointsEarned: number;
  answeredAt?: Date;
}) {
  const [answer] = await db.insert(brainFreezeAnswers).values({
    userId,
    questionId,
    inPlunge: data.inPlunge,
    plungeId: data.plungeId,
    isCorrect: data.isCorrect,
    pointsEarned: data.pointsEarned,
    responseTimeMs: 3_000,
    answeredAt: data.answeredAt,
  }).returning({ id: brainFreezeAnswers.id });
  createdAnswerIds.push(answer.id);
}

describe("getBrainFreezeAdminStats()", () => {
  it("returns each saved plunge with its own duration and question count", async () => {
    const shortPlungeId = await createPlunge(75);
    const longPlungeId = await createPlunge(180);

    await createAnswer({ plungeId: shortPlungeId, inPlunge: true, isCorrect: true, pointsEarned: 1_000_000 });
    await createAnswer({ plungeId: shortPlungeId, inPlunge: true, isCorrect: false, pointsEarned: 1_000_000 });
    await createAnswer({ plungeId: longPlungeId, inPlunge: true, isCorrect: true, pointsEarned: 1_000_000 });
    await createAnswer({ inPlunge: true, isCorrect: false, pointsEarned: 1_000_000 });
    await createAnswer({ inPlunge: false, isCorrect: false, pointsEarned: 1_000_000 });

    const stats = await getBrainFreezeAdminStats();
    const player = stats.leaderboard.find((row) => row.userId === userId);
    expect(player).toBeDefined();
    expect(player).toMatchObject({
      answers: 5,
      correct: 2,
      inPlungeAnswers: 4,
      inPlungeCorrect: 2,
      outOfPlungeAnswers: 1,
      outOfPlungeCorrect: 0,
      unlinkedInPlungeAnswers: 1,
      unlinkedInPlungeCorrect: 0,
    });

    const plungeSummary = player!.plunges
      .map(({ plungeId, duration, questionTotal, correct }) => ({ plungeId, duration, questionTotal, correct }))
      .sort((a, b) => a.duration - b.duration);
    expect(plungeSummary).toEqual([
      { plungeId: shortPlungeId, duration: 75, questionTotal: 2, correct: 1 },
      { plungeId: longPlungeId, duration: 180, questionTotal: 1, correct: 1 },
    ]);
  });

  it("filters totals, context accuracy, and plunge details to the requested period", async () => {
    const baseline7d = await getBrainFreezeAdminStats("7d");
    const baseline30d = await getBrainFreezeAdminStats("30d");
    const thirtyDayPlungeId = await createPlunge(240);
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400_000);

    await createAnswer({
      plungeId: thirtyDayPlungeId,
      inPlunge: true,
      isCorrect: true,
      pointsEarned: 15,
      answeredAt: eightDaysAgo,
    });
    await createAnswer({
      inPlunge: false,
      isCorrect: true,
      pointsEarned: 10,
      answeredAt: thirtyOneDaysAgo,
    });

    const stats7d = await getBrainFreezeAdminStats("7d");
    const player7d = stats7d.leaderboard.find((row) => row.userId === userId);
    expect(stats7d.period).toBe("7d");
    expect(stats7d.overview).toMatchObject({
      total: baseline7d.overview.total,
      correct: baseline7d.overview.correct,
      inPlunge: baseline7d.overview.inPlunge,
      pts: baseline7d.overview.pts,
      inPlungeCorrect: baseline7d.overview.inPlungeCorrect,
      inPlungeAnswers: baseline7d.overview.inPlungeAnswers,
      outOfPlungeCorrect: baseline7d.overview.outOfPlungeCorrect,
      outOfPlungeAnswers: baseline7d.overview.outOfPlungeAnswers,
    });
    expect(player7d).toMatchObject({
      answers: 5,
      correct: 2,
      inPlungeAnswers: 4,
      inPlungeCorrect: 2,
      outOfPlungeAnswers: 1,
      outOfPlungeCorrect: 0,
    });
    expect(player7d!.plunges.some((plunge) => plunge.plungeId === thirtyDayPlungeId)).toBe(false);

    const stats30d = await getBrainFreezeAdminStats("30d");
    const player30d = stats30d.leaderboard.find((row) => row.userId === userId);
    expect(stats30d.period).toBe("30d");
    expect(stats30d.overview).toMatchObject({
      total: baseline30d.overview.total + 1,
      correct: baseline30d.overview.correct + 1,
      inPlunge: baseline30d.overview.inPlunge + 1,
      pts: baseline30d.overview.pts + 15,
      players: baseline30d.overview.players,
      inPlungeCorrect: baseline30d.overview.inPlungeCorrect + 1,
      inPlungeAnswers: baseline30d.overview.inPlungeAnswers + 1,
      outOfPlungeCorrect: baseline30d.overview.outOfPlungeCorrect,
      outOfPlungeAnswers: baseline30d.overview.outOfPlungeAnswers,
    });
    expect(player30d).toMatchObject({
      answers: 6,
      correct: 3,
      inPlungeAnswers: 5,
      inPlungeCorrect: 3,
      outOfPlungeAnswers: 1,
      outOfPlungeCorrect: 0,
    });
    expect(player30d!.plunges).toEqual(expect.arrayContaining([
      expect.objectContaining({ plungeId: thirtyDayPlungeId, questionTotal: 1, correct: 1 }),
    ]));
  });
});