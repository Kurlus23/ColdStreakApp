/**
 * BrainFreezeGame.coldPlungeSlots.test.tsx
 *
 * Confirms that the correct question slots within a session request the
 * cold-plunge category from the server.
 *
 * How slots work (BrainFreezeGame.tsx ~line 135)
 * -----------------------------------------------
 *   questionCountRef.current += 1          // increment BEFORE the check
 *   const coldPlunge = questionCountRef.current % 3 === 0
 *
 * This means:
 *   - Question 1 (count=1): 1 % 3 = 1 → general
 *   - Question 2 (count=2): 2 % 3 = 2 → general
 *   - Question 3 (count=3): 3 % 3 = 0 → cold-plunge  ✓
 *   - Question 4 (count=4): 4 % 3 = 1 → general
 *   - Question 5 (count=5): 5 % 3 = 2 → general
 *   - Question 6 (count=6): 6 % 3 = 0 → cold-plunge  ✓
 *   - Question 7 (count=7): 7 % 3 = 1 → general
 *   - Question 8 (count=8): 8 % 3 = 2 → general
 *   - Question 9 (count=9): 9 % 3 = 0 → cold-plunge  ✓
 *   - Question 10 (count=10): 10 % 3 = 1 → general
 *
 * Invariants confirmed
 * --------------------
 * 1. In a 10-question session (targetQuestions=10) exactly three question
 *    fetches include "?coldPlunge=1" in the URL — slots 3, 6, and 9.
 * 2. The remaining seven fetches do NOT include "?coldPlunge=1".
 * 3. The cold-plunge fetch indices within the ordered fetch list are
 *    exactly [2, 5, 8] (0-indexed), i.e. the 3rd, 6th, and 9th requests.
 */

import { vi, describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { BrainFreezeGame } from "../BrainFreezeGame";

// ---------------------------------------------------------------------------
// Constants mirrored from the component (must stay in sync)
// ---------------------------------------------------------------------------
const FIRST_QUESTION_AT = 30;
const QUESTION_TIMEOUT  = 20;
const TARGET_DURATION   = 480; // 8 min
const TARGET_QUESTIONS  = 10;
// intervalSecs = max(45, round((480-30-20)/(10-1))) = 48
const INTERVAL_SECS     = 48;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeQuestion = (id: number) => ({
  id,
  question: `Q${id}`,
  correct:  "Right",
  wrong:    ["W1", "W2", "W3"],
  category: id % 3 === 0 ? "Cold Plunge & Ice Bath" : "Science & Technology",
  difficulty: "easy",
  explanation: `Explanation ${id}`,
});

function buildFetchMock() {
  let qIdx = 0;
  return vi.fn(async (url: string) => {
    if ((url as string).includes("/api/brain-freeze/question")) {
      const q = makeQuestion((qIdx % 12) + 1);
      qIdx++;
      return { ok: true, json: async () => q } as Response;
    }
    if ((url as string).includes("/api/brain-freeze/answer")) {
      return { ok: true, json: async () => ({ points: 0 }) } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

/** Return all question-fetch URLs in the order they were called. */
function questionFetchUrls(mock: ReturnType<typeof vi.fn>): string[] {
  return (mock.mock.calls as unknown[][])
    .map((args) => args[0] as string)
    .filter((url) => url.includes("/api/brain-freeze/question"));
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
// Simulation helper
// ---------------------------------------------------------------------------

/**
 * Advance the component through [0..maxElapsed] one second at a time.
 * isActive flips false once elapsed > isActiveUntil.
 */
async function simulatePlunge(
  rerender: (el: React.ReactElement) => void,
  maxElapsed: number,
  isActiveUntil = Infinity,
): Promise<void> {
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
        />,
      );
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BrainFreezeGame – cold-plunge slots in a 10-question session", () => {
  test("questions 3, 6, and 9 include ?coldPlunge=1 in the fetch URL", async () => {
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
      />,
    );

    await simulatePlunge(rerender as (el: React.ReactElement) => void, 480, 480);

    const urls = questionFetchUrls(fetchMock);
    expect(urls).toHaveLength(10);

    // Slots 3, 6, 9 (0-indexed: 2, 5, 8) must carry the cold-plunge flag.
    const coldSlotIndices = [2, 5, 8];
    for (const idx of coldSlotIndices) {
      expect(urls[idx]).toContain("?coldPlunge=1");
    }
  });

  test("questions 1, 2, 4, 5, 7, 8, 10 do NOT include ?coldPlunge=1", async () => {
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
      />,
    );

    await simulatePlunge(rerender as (el: React.ReactElement) => void, 480, 480);

    const urls = questionFetchUrls(fetchMock);
    expect(urls).toHaveLength(10);

    const generalSlotIndices = [0, 1, 3, 4, 6, 7, 9];
    for (const idx of generalSlotIndices) {
      expect(urls[idx]).not.toContain("coldPlunge");
    }
  });

  test("exactly 3 of 10 fetches carry ?coldPlunge=1", async () => {
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
      />,
    );

    await simulatePlunge(rerender as (el: React.ReactElement) => void, 480, 480);

    const urls = questionFetchUrls(fetchMock);
    const coldCount = urls.filter((u) => u.includes("?coldPlunge=1")).length;
    expect(coldCount).toBe(3);
  });

  test("cold-plunge slots fire at the expected 48-second schedule positions (126, 270, 414 s)", async () => {
    // Cold-plunge slots: questions 3, 6, 9 (1-indexed).
    // Schedule: Q(n) fires at FIRST_QUESTION_AT + (n-1) * INTERVAL_SECS
    //   Q3  → 30 + 2*48 = 126 s
    //   Q6  → 30 + 5*48 = 270 s
    //   Q9  → 30 + 8*48 = 414 s
    const expectedColdElapsed = [
      FIRST_QUESTION_AT + 2 * INTERVAL_SECS, // 126
      FIRST_QUESTION_AT + 5 * INTERVAL_SECS, // 270
      FIRST_QUESTION_AT + 8 * INTERVAL_SECS, // 414
    ];

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
      />,
    );

    // Track elapsed time at which each question fetch fires.
    const fireElapsed: number[] = [];
    let prevCount = 0;
    let elapsed = 0;

    for (; elapsed <= 480; elapsed++) {
      const isActive = elapsed <= 480;
      await act(async () => {
        rerender(
          <BrainFreezeGame
            elapsedSeconds={elapsed}
            temperature={55}
            isActive={isActive}
            enabled
            targetDurationSeconds={TARGET_DURATION}
            targetQuestions={TARGET_QUESTIONS}
          />,
        );
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      const urls = questionFetchUrls(fetchMock);
      if (urls.length > prevCount) {
        fireElapsed.push(elapsed);
        prevCount = urls.length;
      }
    }

    expect(fireElapsed).toHaveLength(10);

    // Cold slots are at fire indices 2, 5, 8 (0-indexed).
    for (let i = 0; i < expectedColdElapsed.length; i++) {
      const actualElapsed = fireElapsed[2 + i * 3];
      expect(actualElapsed).toBeGreaterThanOrEqual(expectedColdElapsed[i] - 1);
      expect(actualElapsed).toBeLessThanOrEqual(expectedColdElapsed[i] + 1);
    }
  });

  test("analytical: cold slot modulo rule produces indices 3, 6, 9 out of 10", () => {
    // Pure logic test — no rendering needed.
    // Mirrors: questionCountRef.current += 1; coldPlunge = count % 3 === 0
    const coldSlots: number[] = [];
    for (let count = 1; count <= 10; count++) {
      if (count % 3 === 0) coldSlots.push(count);
    }
    expect(coldSlots).toEqual([3, 6, 9]);
    expect(coldSlots).toHaveLength(3);
  });
});
