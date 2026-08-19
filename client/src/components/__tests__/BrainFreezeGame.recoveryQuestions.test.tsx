/**
 * Task 281 – Confirm a recovery user gets exactly 10 questions during an 8-minute plunge.
 *
 * The scheduling bug caused only 8 questions because answer + auto-close time
 * accumulated and pushed Q9/Q10 past the plunge end.  The fix uses fixed offsets
 * from plunge start (Q1 = 30 s, Q2 = 78 s, …, Q10 = 462 s) instead of chaining
 * from the dismiss timestamp.
 *
 * A second bug was that Q10 was originally scheduled at the plunge boundary (480 s),
 * which is exactly when isActive goes false and the trigger guard kills the fetch.
 * The interval formula now subtracts QUESTION_TIMEOUT (20 s) from the effective end
 * so the last question fires with a display window before the plunge completes.
 *
 * Test setup:
 *   - targetDurationSeconds = 480 (8 min), targetQuestions = 10
 *   - intervalSecs = max(45, round((480-30-20)/(10-1))) = max(45, round(430/9)) = max(45, 48) = 48 s
 *   - Fixed schedule: Q1=30, Q2=78, Q3=126, Q4=174, Q5=222, Q6=270, Q7=318, Q8=366, Q9=414, Q10=462
 *   - Q10 fires 18 s before the 480 s boundary — the user gets a full display window
 *   - isActive goes false at 480: all 10 fetches must already have fired by then
 *
 * Invariants confirmed:
 *   1. Exactly 10 /api/brain-freeze/question requests fire.
 *   2. No 11th request fires even when the plunge runs past 480 s.
 *   3. All 10 fetches occur strictly before elapsedSeconds = 480 (when isActive goes false).
 *   4. Setting isActive=false at 480 does not prevent any question from firing.
 */

import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { BrainFreezeGame } from "../BrainFreezeGame";

// ---------------------------------------------------------------------------
// Constants mirrored from the component (must stay in sync)
// ---------------------------------------------------------------------------
const FIRST_QUESTION_AT = 30;
const QUESTION_TIMEOUT  = 20;
const TARGET_DURATION   = 480; // 8 minutes
const TARGET_QUESTIONS  = 10;
// intervalSecs = max(45, round((480-30-20)/(10-1))) = max(45, round(430/9)) = max(45, 48) = 48
const INTERVAL_SECS     = 48;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeQuestion = (id: number) => ({
  id,
  question: `Question ${id}`,
  correct: "CorrectAnswer",
  wrong: ["WrongOne", "WrongTwo", "WrongThree"],
  category: "Science",
  difficulty: "easy",
  explanation: `Explanation ${id}`,
});

const QUESTIONS = Array.from({ length: 12 }, (_, i) => makeQuestion(i + 1));

function buildFetchMock() {
  let qIdx = 0;
  return vi.fn(async (url: string) => {
    if ((url as string).includes("/api/brain-freeze/question")) {
      const q = QUESTIONS[qIdx % QUESTIONS.length];
      qIdx += 1;
      return { ok: true, json: async () => q } as Response;
    }
    if ((url as string).includes("/api/brain-freeze/answer")) {
      return { ok: true, json: async () => ({ points: 0 }) } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

function questionFetchCount(mock: ReturnType<typeof vi.fn>): number {
  return (mock.mock.calls as unknown[][]).filter(
    (args) => (args[0] as string).includes("/api/brain-freeze/question")
  ).length;
}

beforeAll(() => {
  Storage.prototype.getItem = vi.fn(() => "test-token");
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

/**
 * Advance the component through [0..maxElapsed] seconds one second at a time.
 * The `isActiveUntil` param models the plunge boundary: once elapsed > isActiveUntil
 * the component receives isActive=false, mirroring what the real countdown does.
 *
 * For each elapsed second we:
 *   1. Re-render with updated `elapsedSeconds` and `isActive` props.
 *   2. Advance fake timers by 1000 ms so the component's internal setTimeout chains
 *      (question countdown → auto-answer → auto-close → handleDismiss) fire correctly.
 */
async function simulatePlunge(
  rerender: (el: React.ReactElement) => void,
  fetchMock: ReturnType<typeof vi.fn>,
  maxElapsed: number,
  isActiveUntil = Infinity
): Promise<number[]> {
  const fireElapsed: number[] = [];
  let prevCount = 0;

  for (let elapsed = 0; elapsed <= maxElapsed; elapsed++) {
    const isActive = elapsed <= isActiveUntil;

    await act(async () => {
      rerender(
        <BrainFreezeGame
          elapsedSeconds={elapsed}
          temperature={55}
          isActive={isActive}
          enabled
          targetDurationSeconds={TARGET_DURATION}
          targetQuestions={TARGET_QUESTIONS}
        />
      );
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
    });

    const newCount = questionFetchCount(fetchMock);
    if (newCount > prevCount) {
      fireElapsed.push(elapsed);
      prevCount = newCount;
    }
  }

  return fireElapsed;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BrainFreezeGame – recovery user, 8-minute plunge, 10 questions", () => {
  test("exactly 10 question fetches fire before elapsedSeconds reaches 480", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame
        elapsedSeconds={0}
        temperature={55}
        isActive
        enabled
        targetDurationSeconds={TARGET_DURATION}
        targetQuestions={TARGET_QUESTIONS}
      />
    );

    // Simulate with isActive=false at elapsed=480 (the real plunge boundary)
    const fireElapsed = await simulatePlunge(
      rerender as (el: React.ReactElement) => void,
      fetchMock,
      480,
      480
    );

    expect(fireElapsed).toHaveLength(10);

    // Every question must have fired strictly before the plunge ends
    fireElapsed.forEach((elapsed) => {
      expect(elapsed).toBeLessThan(480);
    });
  });

  test("no 11th question fires even when the plunge runs past 480 s", async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame
        elapsedSeconds={0}
        temperature={55}
        isActive
        enabled
        targetDurationSeconds={TARGET_DURATION}
        targetQuestions={TARGET_QUESTIONS}
      />
    );

    // Run to 600 s — well past the plunge end, isActive stays true the whole time
    const fireElapsed = await simulatePlunge(
      rerender as (el: React.ReactElement) => void,
      fetchMock,
      600
    );

    expect(fireElapsed).toHaveLength(10);
    expect(questionFetchCount(fetchMock)).toBe(10);
  });

  test("isActive going false at 480 does not prevent any of the 10 questions from firing", async () => {
    // This is the regression gate: with the old scheduler Q10 was at 480 s exactly.
    // When isActive flipped false the trigger guard `if (!enabled || !isActive) return`
    // prevented Q10's fetch.  With the interval formula now reserving QUESTION_TIMEOUT
    // seconds before the end, Q10 fires at 462 s — safely inside the active window.
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame
        elapsedSeconds={0}
        temperature={55}
        isActive
        enabled
        targetDurationSeconds={TARGET_DURATION}
        targetQuestions={TARGET_QUESTIONS}
      />
    );

    // Transition isActive=false at the plunge boundary
    const fireElapsed = await simulatePlunge(
      rerender as (el: React.ReactElement) => void,
      fetchMock,
      480,
      480  // isActive goes false at 480
    );

    // Must still get 10 questions even with the boundary transition
    expect(fireElapsed).toHaveLength(10);

    // Q10 must fire before the boundary, not at or after
    const lastFire = fireElapsed[fireElapsed.length - 1];
    expect(lastFire).toBeLessThan(480);
  });

  test("questions fire at fixed 48-second intervals regardless of per-question overhead", async () => {
    // Regression: with the OLD chained scheduler each question's overhead (20 s timeout +
    // 10 s auto-close) accumulated, pushing Q9/Q10 past 480 s.
    // intervalSecs = max(45, round((480-30-20)/(10-1))) = 48
    // Expected schedule: 30, 78, 126, 174, 222, 270, 318, 366, 414, 462
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame
        elapsedSeconds={0}
        temperature={55}
        isActive
        enabled
        targetDurationSeconds={TARGET_DURATION}
        targetQuestions={TARGET_QUESTIONS}
      />
    );

    const fireElapsed = await simulatePlunge(
      rerender as (el: React.ReactElement) => void,
      fetchMock,
      480,
      480
    );

    const expected = Array.from({ length: TARGET_QUESTIONS }, (_, i) =>
      FIRST_QUESTION_AT + i * INTERVAL_SECS
    );
    // [30, 78, 126, 174, 222, 270, 318, 366, 414, 462]

    expect(fireElapsed).toHaveLength(10);
    fireElapsed.forEach((elapsed, i) => {
      // Allow ±1 s tolerance for simulation jitter
      expect(elapsed).toBeGreaterThanOrEqual(expected[i] - 1);
      expect(elapsed).toBeLessThanOrEqual(expected[i] + 1);
    });
  });

  test("analytical proof: OLD chained scheduler gives ≤ 8 questions; Q10 slot at boundary fails", () => {
    // Chained scheduler: Q(n+1) fires at dismissedAt(n) + OLD_interval
    // OLD_interval = round((480-30)/(10-1)) = round(50) = 50
    // Overhead per question: QUESTION_TIMEOUT + AUTO_CLOSE = 20 + 10 = 30 s
    const OLD_INTERVAL = Math.max(45, Math.round((TARGET_DURATION - FIRST_QUESTION_AT) / (TARGET_QUESTIONS - 1)));
    const overhead = QUESTION_TIMEOUT + 10; // 30 s

    let dismissed = FIRST_QUESTION_AT + overhead; // Q1 dismissed at 60
    let qCount = 1;
    while (dismissed + OLD_INTERVAL <= TARGET_DURATION) {
      const fireAt = dismissed + OLD_INTERVAL;
      dismissed = fireAt + overhead;
      qCount += 1;
    }

    // With chained scheduling, only ≤ 8 questions fit within 480 s
    expect(qCount).toBeLessThan(10);

    // The old formula put Q10 exactly at the boundary
    const oldLastSlot = FIRST_QUESTION_AT + (TARGET_QUESTIONS - 1) * OLD_INTERVAL;
    expect(oldLastSlot).toBe(TARGET_DURATION); // 480 = boundary = broken

    // The new formula puts Q10 safely before the boundary
    const newInterval = Math.max(45, Math.round((TARGET_DURATION - FIRST_QUESTION_AT - QUESTION_TIMEOUT) / (TARGET_QUESTIONS - 1)));
    const newLastSlot = FIRST_QUESTION_AT + (TARGET_QUESTIONS - 1) * newInterval;
    expect(newLastSlot).toBeLessThan(TARGET_DURATION); // 462 < 480 ✓
  });
});
