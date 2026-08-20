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
}) {
  const [answer] = await db.insert(brainFreezeAnswers).values({
    userId,
    questionId,
    inPlunge: data.inPlunge,
    plungeId: data.plungeId,
    isCorrect: data.isCorrect,
    pointsEarned: data.pointsEarned,
    responseTimeMs: 3_000,
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
});