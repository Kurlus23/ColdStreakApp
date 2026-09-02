import { describe, expect, it } from "vitest";
import { COACH_HISTORY_TTL_MS, isCoachHistoryExpired } from "../CoachFAB";

describe("Coach temporary history expiry", () => {
  const savedAt = 1_000_000;

  it("keeps history available inside the one-hour window", () => {
    expect(isCoachHistoryExpired(savedAt, savedAt + COACH_HISTORY_TTL_MS - 1)).toBe(false);
  });

  it("expires history at one hour", () => {
    expect(isCoachHistoryExpired(savedAt, savedAt + COACH_HISTORY_TTL_MS)).toBe(true);
  });

  it("treats invalid timestamps as expired", () => {
    expect(isCoachHistoryExpired(Number.NaN, savedAt)).toBe(true);
  });
});