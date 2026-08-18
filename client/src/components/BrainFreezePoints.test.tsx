/**
 * Task 271 – Confirm the points animation fires every question, not just the first one.
 *
 * The animation re-trigger mechanism works in two layers:
 *   1. `lastPoints` goes null → value between questions, unmounting and remounting
 *      the pts element so its CSS animation always fires fresh.
 *   2. `pointsAnimKey` increments whenever pts > 0, changing the React `key` prop
 *      on the animation spans, which is an additional guard against stale mounts.
 *
 * These tests verify both layers are intact for BrainFreezeModal and BrainFreezeGame.
 */

import { vi, describe, test, expect, beforeAll, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { BrainFreezeModal } from "./BrainFreezeModal";
import { BrainFreezeGame } from "./BrainFreezeGame";

// ---------------------------------------------------------------------------
// Shared helpers
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

/** Build a fetch mock that serves questions and answer responses in sequence. */
function buildFetchMock(questions: ReturnType<typeof makeQuestion>[], ptsPerAnswer: number[]) {
  let qIdx = 0;
  let aIdx = 0;
  return vi.fn(async (url: string) => {
    if (url.includes("/api/brain-freeze/question")) {
      const q = questions[qIdx++ % questions.length];
      return { ok: true, json: async () => q } as Response;
    }
    if (url.includes("/api/brain-freeze/answer")) {
      const pts = ptsPerAnswer[aIdx++ % ptsPerAnswer.length];
      return { ok: true, json: async () => ({ points: pts }) } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

/** Click an answer button by its answer text (handles shuffled positions).
 *  Fires click on the <span> containing the text; event bubbles to the button. */
function clickAnswerByText(answerText: string) {
  const spans = Array.from(document.querySelectorAll<HTMLElement>(".space-y-2 span.flex-1"));
  const target = spans.find(s => s.textContent === answerText);
  if (!target) throw new Error(`Answer span "${answerText}" not found in DOM`);
  fireEvent.click(target);
}

/** Wait for the pts-pop animation element to appear and return it. */
async function waitForPtsElement(timeout = 3000): Promise<HTMLElement> {
  let el: HTMLElement | null = null;
  await waitFor(
    () => {
      el = document.querySelector<HTMLElement>('[style*="pts-pop"]');
      if (!el) throw new Error("pts-pop element not found");
    },
    { timeout }
  );
  return el!;
}

// Stub localStorage so getToken() doesn't throw in jsdom
beforeAll(() => {
  Storage.prototype.getItem = vi.fn(() => "test-token");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// BrainFreezeModal – animation re-fires on every question
// ---------------------------------------------------------------------------

describe("BrainFreezeModal – points animation key", () => {
  const questions = [makeQuestion(1), makeQuestion(2), makeQuestion(3)];

  test("pts element is present and shows correct value after each of 3 questions", async () => {
    const pts = [100, 130, 90];
    vi.stubGlobal("fetch", buildFetchMock(questions, pts));

    render(
      <BrainFreezeModal
        isOpen
        onClose={() => {}}
        challengeQuestions={questions}
        challengeId={42}
        challengeOpponentName="Bob"
      />
    );

    for (let i = 0; i < 3; i++) {
      await screen.findByText(questions[i].question, {}, { timeout: 3000 });

      await act(async () => { clickAnswerByText("CorrectAnswer"); });

      const ptsEl = await waitForPtsElement();
      expect(ptsEl.textContent).toBe(`+${pts[i]} pts`);

      if (i < 2) {
        const nextBtn = screen.getByRole("button", { name: /next/i });
        await act(async () => { fireEvent.click(nextBtn); });
      }
    }
  });

  test("pts element is remounted on Q2 (confirming animation restart after a correct Q1)", async () => {
    const fetchMock = buildFetchMock(questions, [120, 120]);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <BrainFreezeModal
        isOpen
        onClose={() => {}}
        challengeQuestions={questions}
        challengeId={42}
        challengeOpponentName="Alice"
      />
    );

    // Q1
    await screen.findByText(questions[0].question, {}, { timeout: 3000 });
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsQ1 = await waitForPtsElement();
    expect(ptsQ1.textContent).toBe("+120 pts");

    // Advance to Q2
    const nextBtn = screen.getByRole("button", { name: /next/i });
    await act(async () => { fireEvent.click(nextBtn); });

    // Q2
    await screen.findByText(questions[1].question, {}, { timeout: 3000 });
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsQ2 = await waitForPtsElement();
    expect(ptsQ2.textContent).toBe("+120 pts");

    // The element must be a different DOM node (remounted → CSS animation restarts)
    expect(ptsQ2).not.toBe(ptsQ1);

    // The answer endpoint was called at least twice
    const answerCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => url.includes("/api/brain-freeze/answer")
    );
    expect(answerCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("pts element remounts between questions even when API returns 0 pts (wrong answers)", async () => {
    // 0 pts: pointsAnimKey won't increment, but the null→value cycle still
    // unmounts (lastPoints=null) then remounts (lastPoints=0) the element.
    vi.stubGlobal("fetch", buildFetchMock(questions, [0, 0]));

    render(
      <BrainFreezeModal
        isOpen
        onClose={() => {}}
        challengeQuestions={questions}
        challengeId={42}
        challengeOpponentName="Carol"
      />
    );

    // Q1 – wrong answer
    await screen.findByText(questions[0].question, {}, { timeout: 3000 });
    await act(async () => { clickAnswerByText("WrongOne"); });
    const ptsQ1 = await waitForPtsElement();
    expect(ptsQ1).not.toBeNull();

    // Advance to Q2
    const nextBtn = screen.getByRole("button", { name: /next/i });
    await act(async () => { fireEvent.click(nextBtn); });

    // Q2 – wrong answer
    await screen.findByText(questions[1].question, {}, { timeout: 3000 });
    await act(async () => { clickAnswerByText("WrongOne"); });
    const ptsQ2 = await waitForPtsElement();

    // Different DOM node = remounted = animation re-fired
    expect(ptsQ2).not.toBe(ptsQ1);
    expect(ptsQ2).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BrainFreezeGame – animation re-fires on every question
// ---------------------------------------------------------------------------

describe("BrainFreezeGame – points animation key", () => {
  const q1 = makeQuestion(10);
  const q2 = makeQuestion(11);

  /** Advance elapsed time past FIRST_QUESTION_AT (30 s) to trigger the first question. */
  async function triggerFirstQuestion(rerender: (el: React.ReactElement) => void) {
    await act(async () => {
      rerender(
        <BrainFreezeGame
          elapsedSeconds={31}
          temperature={50}
          isActive
          enabled
        />
      );
    });
    await screen.findByText(q1.question, {}, { timeout: 3000 });
  }

  test("pts element appears with correct value after each of 2 consecutive game questions", async () => {
    const fetchMock = buildFetchMock([q1, q2], [120, 130]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={50} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void);

    // Answer Q1
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsQ1 = await waitForPtsElement();
    expect(ptsQ1.textContent).toBe("+120 pts");

    // Dismiss Q1
    const nextQ1 = screen.getByRole("button", { name: /next/i });
    await act(async () => { fireEvent.click(nextQ1); });

    // Advance elapsed time past interval (dismissedAt≈31, default interval=45 → next at 76 s)
    await act(async () => {
      rerender(
        <BrainFreezeGame elapsedSeconds={80} temperature={50} isActive enabled />
      );
    });
    await screen.findByText(q2.question, {}, { timeout: 3000 });

    // Answer Q2
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsQ2 = await waitForPtsElement();
    expect(ptsQ2.textContent).toBe("+130 pts");

    // Different DOM node = remounted = animation re-fired on Q2
    expect(ptsQ2).not.toBe(ptsQ1);

    const answerCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => url.includes("/api/brain-freeze/answer")
    );
    expect(answerCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("pts element is remounted after each game question even when the API consistently returns the same score", async () => {
    const fetchMock = buildFetchMock([q1, q2], [100, 100]);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={50} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void);

    // Answer Q1
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsSpanQ1 = await waitForPtsElement();
    expect(ptsSpanQ1.textContent).toBe("+100 pts");

    const nextQ1 = screen.getByRole("button", { name: /next/i });
    await act(async () => { fireEvent.click(nextQ1); });

    // Trigger Q2
    await act(async () => {
      rerender(
        <BrainFreezeGame elapsedSeconds={80} temperature={50} isActive enabled />
      );
    });
    await screen.findByText(q2.question, {}, { timeout: 3000 });

    // Answer Q2
    await act(async () => { clickAnswerByText("CorrectAnswer"); });
    const ptsSpanQ2 = await waitForPtsElement();
    expect(ptsSpanQ2.textContent).toBe("+100 pts");

    // Must be a freshly mounted element — animation restarts on Q2
    expect(ptsSpanQ2).not.toBe(ptsSpanQ1);
  });
});
