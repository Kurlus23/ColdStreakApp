import { describe, expect, it } from "vitest";
import { getMissedStreakDate } from "@/lib/streakFreeze";

const date = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);
const plunge = (year: number, month: number, day: number) => ({ createdAt: date(year, month, day) });

describe("getMissedStreakDate", () => {
  const now = date(2026, 8, 27);

  it("returns yesterday when the prior day was credited and yesterday was missed", () => {
    expect(getMissedStreakDate([plunge(2026, 8, 25)], [], now)).toBe("2026-08-26");
  });

  it("does not prompt when yesterday already has a plunge", () => {
    expect(getMissedStreakDate([plunge(2026, 8, 25), plunge(2026, 8, 26)], [], now)).toBeNull();
  });

  it("does not prompt when yesterday was already frozen", () => {
    expect(getMissedStreakDate([plunge(2026, 8, 25)], ["2026-08-26"], now)).toBeNull();
  });

  it("does not prompt a brand-new user or someone with a longer gap", () => {
    expect(getMissedStreakDate([], [], now)).toBeNull();
    expect(getMissedStreakDate([plunge(2026, 8, 24)], [], now)).toBeNull();
  });
});