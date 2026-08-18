/**
 * Task 270 – Confirm the cold-water bonus label appears on the in-plunge
 * Brain Freeze answer card.
 *
 * BrainFreezeGame reads the `temperature` prop at answer time and:
 *   1. Sends it as `waterTempF` to POST /api/brain-freeze/answer
 *   2. Stores the temperature as `lastTempF` so getColdBonusLabel() can render
 *      a label (e.g. "🧊 +30% cold bonus") next to the server-returned points.
 *
 * This file verifies all three temperature buckets that qualify for a bonus,
 * confirms inflated points are displayed, and confirms no label appears when
 * the water is warm (≥ 60 °F).
 */

import { vi, describe, test, expect, beforeAll, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { BrainFreezeGame, getColdBonusLabel } from "./BrainFreezeGame";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const QUESTION = {
  id: 99,
  question: "What is the freezing point of water in Celsius?",
  correct: "0 °C",
  wrong: ["100 °C", "-10 °C", "32 °C"],
  category: "Science",
  difficulty: "easy",
  explanation: "Water freezes at 0 °C (32 °F).",
};

/** Build a fetch mock that serves one question and one answer response. */
function buildFetchMock(ptsFromServer: number) {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/brain-freeze/question")) {
      return { ok: true, json: async () => QUESTION } as Response;
    }
    if (url.includes("/api/brain-freeze/answer")) {
      return { ok: true, json: async () => ({ points: ptsFromServer }) } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

/** Click the correct answer button (handles shuffled positions). */
function clickCorrectAnswer() {
  const spans = Array.from(
    document.querySelectorAll<HTMLElement>(".space-y-2 span.flex-1")
  );
  const target = spans.find((s) => s.textContent === QUESTION.correct);
  if (!target) throw new Error(`Answer span "${QUESTION.correct}" not found`);
  fireEvent.click(target);
}

/** Trigger the first question by advancing elapsed time past FIRST_QUESTION_AT. */
async function triggerFirstQuestion(
  rerender: (el: React.ReactElement) => void,
  temperature: number
) {
  await act(async () => {
    rerender(
      <BrainFreezeGame
        elapsedSeconds={31}
        temperature={temperature}
        isActive
        enabled
      />
    );
  });
  await screen.findByText(QUESTION.question, {}, { timeout: 3000 });
}

/** Wait for the pts-pop animation span and return it. */
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

/** Wait for the cold-bonus label span (text contains "cold bonus") and return it. */
async function waitForColdBonusLabel(timeout = 3000): Promise<HTMLElement> {
  return screen.findByText(/cold bonus/, {}, { timeout }) as Promise<HTMLElement>;
}

// Stub localStorage so getToken() never returns null
beforeAll(() => {
  Storage.prototype.getItem = vi.fn(() => "test-token");
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Unit tests: getColdBonusLabel() production helper (imported from component)
// ---------------------------------------------------------------------------

describe("getColdBonusLabel — production helper", () => {
  test.each([
    [32,  "🧊 +50% cold bonus"],
    [39,  "🧊 +50% cold bonus"],
    [40,  "🧊 +30% cold bonus"],
    [49,  "🧊 +30% cold bonus"],
    [50,  "🧊 +15% cold bonus"],
    [59,  "🧊 +15% cold bonus"],
    [60,  null               ],
    [72,  null               ],
  ] as const)(
    "%i °F → %s",
    (tempF, expected) => {
      expect(getColdBonusLabel(tempF)).toBe(expected);
    }
  );
});

// ---------------------------------------------------------------------------
// Temperature bucket: < 50 °F → "+30% cold bonus"
// ---------------------------------------------------------------------------

describe('BrainFreezeGame cold bonus – 45 °F (< 50 °F → "+30% cold bonus")', () => {
  // 45 °F → multiplier 1.30. Instant-tier correct base = 125.
  // Math.round(125 * 1.30) = 163
  const WATER_TEMP_F = 45;
  const SERVER_PTS   = 163;

  test("shows the cold bonus label after a correct answer", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const coldLabel = await waitForColdBonusLabel();
    expect(coldLabel.textContent).toBe("🧊 +30% cold bonus");
  });

  test("shows the inflated server points after a correct answer at 45 °F", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const ptsEl = await waitForPtsElement();
    expect(ptsEl.textContent).toBe(`+${SERVER_PTS} pts`);
  });

  test("sends waterTempF in the answer request body", async () => {
    const fetchMock = buildFetchMock(SERVER_PTS);
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    await waitForPtsElement();

    const answerCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => url.includes("/api/brain-freeze/answer")
    );
    expect(answerCalls.length).toBeGreaterThanOrEqual(1);

    // Inspect the request body — index via unknown[] to avoid the unsafe tuple cast
    const callArgs = answerCalls[0] as unknown[];
    const init = callArgs[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.waterTempF).toBe(WATER_TEMP_F);
    expect(body.inPlunge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Temperature bucket: < 40 °F → "+50% cold bonus"
// ---------------------------------------------------------------------------

describe('BrainFreezeGame cold bonus – 37 °F (< 40 °F → "+50% cold bonus")', () => {
  // 37 °F → multiplier 1.50. Instant-tier correct base = 125.
  // Math.round(125 * 1.50) = 188 (rounds from 187.5)
  const WATER_TEMP_F = 37;
  const SERVER_PTS   = 188;

  test("shows the cold bonus label after a correct answer", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const coldLabel = await waitForColdBonusLabel();
    expect(coldLabel.textContent).toBe("🧊 +50% cold bonus");
  });

  test("shows the inflated server points after a correct answer at 37 °F", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const ptsEl = await waitForPtsElement();
    expect(ptsEl.textContent).toBe(`+${SERVER_PTS} pts`);
  });
});

// ---------------------------------------------------------------------------
// Temperature bucket: < 60 °F → "+15% cold bonus"
// ---------------------------------------------------------------------------

describe('BrainFreezeGame cold bonus – 55 °F (< 60 °F → "+15% cold bonus")', () => {
  // 55 °F → multiplier 1.15. Instant-tier correct base = 125.
  // Math.round(125 * 1.15) = 144 (rounds from 143.75)
  const WATER_TEMP_F = 55;
  const SERVER_PTS   = 144;

  test("shows the cold bonus label after a correct answer", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const coldLabel = await waitForColdBonusLabel();
    expect(coldLabel.textContent).toBe("🧊 +15% cold bonus");
  });

  test("shows the inflated server points after a correct answer at 55 °F", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const ptsEl = await waitForPtsElement();
    expect(ptsEl.textContent).toBe(`+${SERVER_PTS} pts`);
  });
});

// ---------------------------------------------------------------------------
// No bonus: ≥ 60 °F → no cold bonus label
// ---------------------------------------------------------------------------

describe("BrainFreezeGame cold bonus – 65 °F (no bonus)", () => {
  const WATER_TEMP_F = 65;
  const SERVER_PTS   = 125; // no multiplier

  test("does NOT show a cold bonus label when water is warm (≥ 60 °F)", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    // Wait for the pts element to confirm the answer card rendered
    await waitForPtsElement();

    // The cold bonus text must not be present anywhere in the document
    const allText = document.body.textContent ?? "";
    expect(allText).not.toMatch(/cold bonus/);
  });

  test("shows plain (uninflated) points when water is warm (≥ 60 °F)", async () => {
    vi.stubGlobal("fetch", buildFetchMock(SERVER_PTS));

    const { rerender } = render(
      <BrainFreezeGame elapsedSeconds={29} temperature={WATER_TEMP_F} isActive enabled />
    );

    await triggerFirstQuestion(rerender as (el: React.ReactElement) => void, WATER_TEMP_F);

    await act(async () => { clickCorrectAnswer(); });

    const ptsEl = await waitForPtsElement();
    expect(ptsEl.textContent).toBe(`+${SERVER_PTS} pts`);
  });
});
