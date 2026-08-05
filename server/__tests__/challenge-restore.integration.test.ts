/**
 * challenge-restore.integration.test.ts
 *
 * Integration tests for the Drizzle-backed consumePendingChallenge and
 * insertPendingChallengeIfNone storage methods.  Uses the real database to
 * verify the SQL conditional-delete and ON-CONFLICT-DO-NOTHING semantics that
 * protect the A→B race during challenge restoration.
 *
 * High-range synthetic user IDs (≥999_000) are used so rows never collide with
 * real accounts; all rows are cleaned up in afterEach.
 */

import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db";
import { pendingChallenges } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";

// Synthetic user IDs that will never conflict with real data.
const TO   = 999_001; // the challenge recipient
const FROM_A = 999_002; // challenger A
const FROM_B = 999_003; // challenger B (arrives later and replaces A)

// Ensure no leftover rows from a previous (interrupted) test run.
async function cleanup() {
  await db.delete(pendingChallenges).where(eq(pendingChallenges.toUserId, TO));
}

afterEach(cleanup);

// ── consumePendingChallenge ───────────────────────────────────────────────────

describe("consumePendingChallenge — conditional SQL delete", () => {
  it("deletes the row when both toUserId and fromUserId match", async () => {
    await storage.upsertPendingChallenge(FROM_A, TO);

    const consumed = await storage.consumePendingChallenge(TO, FROM_A);
    expect(consumed).toBe(true);

    const [row] = await db.select().from(pendingChallenges).where(eq(pendingChallenges.toUserId, TO));
    expect(row).toBeUndefined();
  });

  it("does NOT delete when fromUserId differs (B has replaced A in the slot)", async () => {
    // B overwrites A in the slot
    await storage.upsertPendingChallenge(FROM_A, TO);
    await storage.upsertPendingChallenge(FROM_B, TO);

    // User verified A before the plunge was posted; try to consume A's slot
    const consumed = await storage.consumePendingChallenge(TO, FROM_A);
    expect(consumed).toBe(false);

    // B must still be present and intact
    const [row] = await db.select().from(pendingChallenges).where(eq(pendingChallenges.toUserId, TO));
    expect(row).toBeDefined();
    expect(row.fromUserId).toBe(FROM_B);
  });

  it("returns false when no pending challenge exists for this recipient", async () => {
    const consumed = await storage.consumePendingChallenge(TO, FROM_A);
    expect(consumed).toBe(false);
  });
});

// ── insertPendingChallengeIfNone ──────────────────────────────────────────────

describe("insertPendingChallengeIfNone — ON CONFLICT DO NOTHING", () => {
  it("inserts a row when the slot is empty (normal discard path)", async () => {
    await storage.insertPendingChallengeIfNone(FROM_A, TO);

    const [row] = await db.select().from(pendingChallenges).where(eq(pendingChallenges.toUserId, TO));
    expect(row).toBeDefined();
    expect(row.fromUserId).toBe(FROM_A);
  });

  it("does NOT overwrite a newer challenge B with stale restored A", async () => {
    // B is already in the slot (arrived after A was consumed)
    await storage.upsertPendingChallenge(FROM_B, TO);

    // Attempt to restore A
    await storage.insertPendingChallengeIfNone(FROM_A, TO);

    // B must remain
    const [row] = await db.select().from(pendingChallenges).where(eq(pendingChallenges.toUserId, TO));
    expect(row).toBeDefined();
    expect(row.fromUserId).toBe(FROM_B);
  });
});

// ── Full A→B race scenario ────────────────────────────────────────────────────

describe("A→B race scenario — full DB flow", () => {
  it("preserves B when the user discards a plunge that consumed A", async () => {
    // 1. A sends a challenge
    await storage.upsertPendingChallenge(FROM_A, TO);
    const afterA = await storage.getPendingChallenge(TO);
    expect(afterA?.fromUserId).toBe(FROM_A);

    // 2. User verifies A and logs a plunge — consume A conditionally
    const consumedA = await storage.consumePendingChallenge(TO, FROM_A);
    expect(consumedA).toBe(true);
    expect(await storage.getPendingChallenge(TO)).toBeNull();

    // 3. B sends a challenge while the user is on the completion screen
    await storage.upsertPendingChallenge(FROM_B, TO);

    // 4. User taps Discard — attempt to restore A
    await storage.insertPendingChallengeIfNone(FROM_A, TO);

    // 5. B must remain; A is NOT restored
    const current = await storage.getPendingChallenge(TO);
    expect(current?.fromUserId).toBe(FROM_B);
  });

  it("restores A when no newer challenge arrived before discard", async () => {
    // 1. A sends, gets consumed
    await storage.upsertPendingChallenge(FROM_A, TO);
    await storage.consumePendingChallenge(TO, FROM_A);

    // 2. No B arrives; user discards → restore A
    await storage.insertPendingChallengeIfNone(FROM_A, TO);

    const current = await storage.getPendingChallenge(TO);
    expect(current?.fromUserId).toBe(FROM_A);
  });
});
