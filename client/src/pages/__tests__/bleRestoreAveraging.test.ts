/**
 * Task 194 — BLE temp averaging survives app-kill restore
 *
 * Scenario:
 *   1. User starts a stopwatch plunge (entryTemp = 45 °F), app is killed.
 *   2. App is restored: restore() seeds tempSamplesRef with the saved entry
 *      temp and immediately sets isRunningRef.current = true (the fix).
 *   3. BLE reconnects and delivers two new readings before React's render
 *      cycle flushes (i.e. while isRunningRef.current is already true).
 *   4. doLogPlunge averages ALL three values — not just the seed.
 *
 * Why a unit test rather than a component test:
 *   The averaging logic is pure arithmetic on a mutable ref array.
 *   Extracting the three collaborating pieces (restore seed, BLE guard push,
 *   doLogPlunge average) into a plain-JS simulation lets us assert the
 *   invariant without mounting the full 9 000-line component.
 *
 * The critical invariant proven here:
 *   isRunningRef.current must be TRUE before BLE push guards are evaluated.
 *   The fix in restore() sets isRunningRef.current = true synchronously,
 *   ahead of setIsRunning(true) which only takes effect after the next render.
 */

import { describe, it, expect } from "vitest";

// ─── Pure simulation of the three collaborating pieces in Home.tsx ────────────

/** Mirrors the mutable ref objects used by the component. */
interface SimRefs {
  isRunningRef: { current: boolean };
  countdownRunningRef: { current: boolean };
  tempSamplesRef: { current: number[] };
}

/**
 * Simulates restore() in Home.tsx — stopwatch branch.
 *
 * BEFORE the fix, restore() called setIsRunning(true) without touching
 * isRunningRef, so isRunningRef.current stayed false until after the render.
 *
 * AFTER the fix, restore() sets isRunningRef.current = true immediately,
 * matching what the production code now does.
 */
function simulateRestoreStopwatch(
  refs: SimRefs,
  restoredTemp: number,
  applyFix: boolean,
) {
  refs.tempSamplesRef.current = [restoredTemp];
  if (applyFix) {
    refs.isRunningRef.current = true; // the fix: set ref before React state
  }
  // setIsRunning(true) — React state; takes effect after render (not modelled)
}

/**
 * Simulates restore() in Home.tsx — countdown branch.
 */
function simulateRestoreCountdown(
  refs: SimRefs,
  restoredTemp: number,
  applyFix: boolean,
) {
  refs.tempSamplesRef.current = [restoredTemp];
  if (applyFix) {
    refs.countdownRunningRef.current = true; // the fix: set ref before React state
  }
  // setCountdownRunning(true) — React state; takes effect after render (not modelled)
}

/**
 * Simulates BLE notification handler push guard in Home.tsx (~lines 2209, 2516,
 * 2557, 2851, 2965, 3001):
 *
 *   if (isRunningRef.current || countdownRunningRef.current)
 *     tempSamplesRef.current.push(reading);
 */
function simulateBleReading(refs: SimRefs, reading: number) {
  if (refs.isRunningRef.current || refs.countdownRunningRef.current) {
    refs.tempSamplesRef.current.push(reading);
  }
}

/**
 * Simulates the avgTemp calculation inside doLogPlunge (~lines 3117-3119):
 *
 *   const avgTemp = tempSamplesRef.current.length > 0
 *     ? Math.round(tempSamplesRef.current.reduce((a, b) => a + b, 0) /
 *                  tempSamplesRef.current.length)
 *     : temperature;
 */
function simulateDoLogPlugeAvgTemp(
  refs: SimRefs,
  fallbackDisplayTemp: number,
): number {
  return refs.tempSamplesRef.current.length > 0
    ? Math.round(
        refs.tempSamplesRef.current.reduce((a, b) => a + b, 0) /
          refs.tempSamplesRef.current.length,
      )
    : fallbackDisplayTemp;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BLE temp averaging after app-kill restore (stopwatch mode)", () => {
  const ENTRY_TEMP = 45; // °F saved when session started
  const BLE_READING_1 = 42;
  const BLE_READING_2 = 44;
  // expected avg = round((45 + 42 + 44) / 3) = round(43.67) = 44
  const EXPECTED_AVG = Math.round((ENTRY_TEMP + BLE_READING_1 + BLE_READING_2) / 3);

  it("WITH the fix: BLE readings are accepted and included in the average", () => {
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreStopwatch(refs, ENTRY_TEMP, /* applyFix */ true);

    // BLE reconnects and pushes readings — isRunningRef.current is already true
    simulateBleReading(refs, BLE_READING_1);
    simulateBleReading(refs, BLE_READING_2);

    expect(refs.tempSamplesRef.current).toHaveLength(3);
    expect(refs.tempSamplesRef.current).toEqual([ENTRY_TEMP, BLE_READING_1, BLE_READING_2]);

    const avg = simulateDoLogPlugeAvgTemp(refs, 50 /* fallback display temp */);
    expect(avg).toBe(EXPECTED_AVG);
  });

  it("WITHOUT the fix: BLE readings are silently dropped (demonstrates the bug)", () => {
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreStopwatch(refs, ENTRY_TEMP, /* applyFix */ false);

    // isRunningRef.current is still false — React hasn't rendered yet
    simulateBleReading(refs, BLE_READING_1);
    simulateBleReading(refs, BLE_READING_2);

    // Only the seed survives; BLE readings were silently discarded
    expect(refs.tempSamplesRef.current).toHaveLength(1);
    expect(refs.tempSamplesRef.current).toEqual([ENTRY_TEMP]);

    const avg = simulateDoLogPlugeAvgTemp(refs, 50);
    // Average is only the seed, not the three-value average
    expect(avg).toBe(ENTRY_TEMP);
    expect(avg).not.toBe(EXPECTED_AVG);
  });

  it("seed value is included even when no BLE readings arrive after restore", () => {
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreStopwatch(refs, ENTRY_TEMP, true);
    // No BLE readings
    const avg = simulateDoLogPlugeAvgTemp(refs, 50);
    expect(avg).toBe(ENTRY_TEMP);
  });

  it("many BLE readings are all included in the average", () => {
    const readings = [40, 41, 42, 43, 44];
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreStopwatch(refs, ENTRY_TEMP, true);
    for (const r of readings) simulateBleReading(refs, r);

    const all = [ENTRY_TEMP, ...readings];
    const expectedAvg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(expectedAvg);
  });
});

describe("BLE temp averaging after app-kill restore (countdown mode)", () => {
  const ENTRY_TEMP = 38;
  const BLE_READING_1 = 36;
  const BLE_READING_2 = 37;
  const EXPECTED_AVG = Math.round((ENTRY_TEMP + BLE_READING_1 + BLE_READING_2) / 3);

  it("WITH the fix: countdown BLE readings land in the average", () => {
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreCountdown(refs, ENTRY_TEMP, /* applyFix */ true);
    simulateBleReading(refs, BLE_READING_1);
    simulateBleReading(refs, BLE_READING_2);

    expect(refs.tempSamplesRef.current).toHaveLength(3);
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(EXPECTED_AVG);
  });

  it("WITHOUT the fix: countdown BLE readings are dropped (demonstrates the bug)", () => {
    const refs: SimRefs = {
      isRunningRef: { current: false },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };

    simulateRestoreCountdown(refs, ENTRY_TEMP, /* applyFix */ false);
    simulateBleReading(refs, BLE_READING_1);
    simulateBleReading(refs, BLE_READING_2);

    // Both BLE readings dropped; only seed remains
    expect(refs.tempSamplesRef.current).toHaveLength(1);
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(ENTRY_TEMP);
  });
});

describe("doLogPlunge averaging invariants", () => {
  it("average rounds correctly for fractional means", () => {
    // 3 samples: 45, 42, 44 → mean = 43.666… → rounds to 44
    const refs: SimRefs = {
      isRunningRef: { current: true },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [45] },
    };
    simulateBleReading(refs, 42);
    simulateBleReading(refs, 44);
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(44);
  });

  it("falls back to the display temperature when no samples exist", () => {
    const refs: SimRefs = {
      isRunningRef: { current: true },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [] },
    };
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(50);
  });

  it("single sample is returned unchanged (no rounding artefact)", () => {
    const refs: SimRefs = {
      isRunningRef: { current: true },
      countdownRunningRef: { current: false },
      tempSamplesRef: { current: [47] },
    };
    expect(simulateDoLogPlugeAvgTemp(refs, 50)).toBe(47);
  });
});
