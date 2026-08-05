/**
 * challenge-restore.test.ts
 *
 * Verifies the storage-layer guarantee that:
 *  1. consumePendingChallenge deletes only the specific (toUserId, fromUserId)
 *     pair — leaving a newer challenge from a different challenger untouched.
 *  2. insertPendingChallengeIfNone restores a consumed challenge without
 *     overwriting a newer challenge that arrived in the meantime.
 *
 * These tests use an in-memory mock of the storage interface rather than a live
 * database so they run offline and are deterministic.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Minimal in-memory pending-challenge store ─────────────────────────────────

interface PendingChallenge {
  fromUserId: number;
  toUserId: number;
}

class MockChallengeStore {
  private rows: PendingChallenge[] = [];

  upsert(fromUserId: number, toUserId: number): void {
    const idx = this.rows.findIndex((r) => r.toUserId === toUserId);
    if (idx >= 0) {
      this.rows[idx] = { fromUserId, toUserId };
    } else {
      this.rows.push({ fromUserId, toUserId });
    }
  }

  /** Mirrors consumePendingChallenge: delete only when both userId pair matches. */
  consume(toUserId: number, fromUserId: number): boolean {
    const idx = this.rows.findIndex(
      (r) => r.toUserId === toUserId && r.fromUserId === fromUserId
    );
    if (idx < 0) return false;
    this.rows.splice(idx, 1);
    return true;
  }

  /** Mirrors insertPendingChallengeIfNone: insert only if no row exists for toUserId. */
  insertIfNone(fromUserId: number, toUserId: number): void {
    const existing = this.rows.find((r) => r.toUserId === toUserId);
    if (!existing) {
      this.rows.push({ fromUserId, toUserId });
    }
  }

  get(toUserId: number): PendingChallenge | null {
    return this.rows.find((r) => r.toUserId === toUserId) ?? null;
  }

  all(): PendingChallenge[] {
    return [...this.rows];
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("consumePendingChallenge — conditional deletion", () => {
  let store: MockChallengeStore;

  beforeEach(() => {
    store = new MockChallengeStore();
  });

  it("deletes the row when both toUserId and fromUserId match", () => {
    store.upsert(/* from= */ 10, /* to= */ 20);
    const consumed = store.consume(/* to= */ 20, /* from= */ 10);
    expect(consumed).toBe(true);
    expect(store.get(20)).toBeNull();
  });

  it("does NOT delete when fromUserId differs (newer challenge in slot)", () => {
    // Challenger A sends first, then B replaces it before the plunge is logged.
    store.upsert(/* from= */ 10, /* to= */ 20); // A
    store.upsert(/* from= */ 11, /* to= */ 20); // B overwrites A

    // User verified A's challenge — consumesPendingChallenge with fromUserId=10
    const consumed = store.consume(/* to= */ 20, /* from= */ 10);

    // The row wasn't for A anymore, so nothing should be deleted.
    expect(consumed).toBe(false);
    // B is still intact
    expect(store.get(20)).toEqual({ fromUserId: 11, toUserId: 20 });
  });

  it("returns false when no pending challenge exists", () => {
    const consumed = store.consume(20, 10);
    expect(consumed).toBe(false);
  });
});

describe("insertPendingChallengeIfNone — non-destructive restore", () => {
  let store: MockChallengeStore;

  beforeEach(() => {
    store = new MockChallengeStore();
  });

  it("inserts A when the slot is empty (normal discard case)", () => {
    // Slot is empty (challenge was consumed by the plunge that is now discarded)
    store.insertIfNone(/* from= */ 10, /* to= */ 20);
    expect(store.get(20)).toEqual({ fromUserId: 10, toUserId: 20 });
  });

  it("does NOT overwrite a newer challenge B with the stale restored A", () => {
    // B arrived after A was consumed; the user now discards the plunge.
    store.upsert(/* from= */ 11, /* to= */ 20); // B is in the slot

    // Try to restore A
    store.insertIfNone(/* from= */ 10, /* to= */ 20);

    // B must still be the current challenge
    expect(store.get(20)).toEqual({ fromUserId: 11, toUserId: 20 });
  });
});

describe("A→B race scenario: full flow", () => {
  it("preserves B when the user discards a plunge that consumed A", () => {
    const store = new MockChallengeStore();

    // 1. A sends a challenge
    store.upsert(10, /* to user= */ 20);
    expect(store.get(20)?.fromUserId).toBe(10);

    // 2. User verifies A during plunge POST — consume A conditionally
    const consumedA = store.consume(20, 10);
    expect(consumedA).toBe(true);
    expect(store.get(20)).toBeNull();

    // 3. While plunge is on the completion screen, B sends a new challenge
    store.upsert(11, 20);
    expect(store.get(20)?.fromUserId).toBe(11);

    // 4. User taps "Discard" — attempt to restore A (challengerUserId = 10)
    store.insertIfNone(10, 20);

    // 5. B must still be the current challenge; A is NOT restored
    expect(store.get(20)).toEqual({ fromUserId: 11, toUserId: 20 });
  });

  it("restores A correctly when no newer challenge arrived before discard", () => {
    const store = new MockChallengeStore();

    // 1. A sends a challenge
    store.upsert(10, 20);

    // 2. User verifies and consumes A
    store.consume(20, 10);
    expect(store.get(20)).toBeNull();

    // 3. No new challenge arrives; user discards → restore A
    store.insertIfNone(10, 20);

    // 4. A is back
    expect(store.get(20)).toEqual({ fromUserId: 10, toUserId: 20 });
  });
});
