/**
 * coach.routing.test.ts
 *
 * Verifies that the coach routing tables send calorie-burn and Sweet Spot
 * questions to the "achievements" screen (Profile › Stats tab), not "history".
 *
 * These tests are intentionally offline — they validate the static configuration
 * (APP_KNOWLEDGE prompt and SCREEN_LABELS map) without calling the Gemini API.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read the raw source so we can inspect both the prompt and the label map
// without needing to export them.
const src = readFileSync(resolve(__dirname, "../coach.ts"), "utf-8");

// ── Helper to pull the navigate bullet list from APP_KNOWLEDGE ──────────────

function extractNavigateBullets(source: string): string {
  // Grab everything between the "Set "navigate" to the screen name" line
  // and the closing instruction about null.
  const match = source.match(/Set "navigate" to the screen name[\s\S]*?Set "navigate" to null/);
  return match ? match[0] : "";
}

// ── Helper to extract SCREEN_LABELS object source ────────────────────────────

function extractScreenLabels(source: string): Record<string, string> {
  const match = source.match(/const SCREEN_LABELS[^=]*=\s*\{([\s\S]*?)\};/);
  if (!match) return {};
  const body = match[1];
  const result: Record<string, string> = {};
  const lineRe = /(\w+)\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(body)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("coach routing — Stats features → achievements screen", () => {
  const bullets = extractNavigateBullets(src);
  const labels  = extractScreenLabels(src);

  it('APP_KNOWLEDGE maps "achievements" to Stats tab features (calorie burn, sweet spot, etc.)', () => {
    // The bullet for "achievements" must mention the Stats-tab features
    expect(bullets).toMatch(/"achievements"/);
    const achievementLine = bullets
      .split("\n")
      .find((l) => l.includes('"achievements"'));
    expect(achievementLine).toBeTruthy();
    expect(achievementLine!.toLowerCase()).toContain("calorie");
    expect(achievementLine!.toLowerCase()).toContain("sweet spot");
    expect(achievementLine!.toLowerCase()).toContain("stats tab");
  });

  it('APP_KNOWLEDGE does NOT list calorie burn or sweet spot under "history"', () => {
    const historyLine = bullets
      .split("\n")
      .find((l) => l.includes('"history"'));
    if (historyLine) {
      expect(historyLine.toLowerCase()).not.toContain("calorie");
      expect(historyLine.toLowerCase()).not.toContain("sweet spot");
      expect(historyLine.toLowerCase()).not.toContain("cold adaptation");
    }
  });

  it("SCREEN_LABELS has exactly one achievements entry (no duplicate key)", () => {
    // Count raw occurrences of 'achievements:' in the SCREEN_LABELS block
    const labelsBlock = src.match(/const SCREEN_LABELS[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
    const occurrences = (labelsBlock.match(/\bachievements\s*:/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("SCREEN_LABELS achievements entry mentions Stats tab", () => {
    expect(labels.achievements).toBeTruthy();
    expect(labels.achievements.toLowerCase()).toContain("stats tab");
  });

  it("SCREEN_LABELS achievements entry mentions calorie burn", () => {
    expect(labels.achievements.toLowerCase()).toContain("calorie");
  });

  it("SCREEN_LABELS achievements entry mentions sweet spot", () => {
    expect(labels.achievements.toLowerCase()).toContain("sweet spot");
  });

  it("SCREEN_LABELS achievements entry mentions discovery report", () => {
    expect(labels.achievements.toLowerCase()).toContain("discovery report");
  });

  it('APP_KNOWLEDGE tells coach to say "Profile › Stats tab" (not "History") for calorie burn', () => {
    // The feature description for calorie burn should point to Profile › Stats tab
    expect(src).toContain("Profile › Stats tab");
    // Must not say calorie burn is in History
    const calorieLine = src
      .split("\n")
      .find((l) => l.toLowerCase().includes("calorie burn") && l.includes("Found in"));
    expect(calorieLine).toBeTruthy();
    expect(calorieLine!).toContain("Profile › Stats");
    expect(calorieLine!).not.toContain("History");
  });

  it('APP_KNOWLEDGE tells coach to say "Profile › Stats tab" for Sweet Spot', () => {
    const sweetSpotLine = src
      .split("\n")
      .find((l) => l.toLowerCase().includes("sweet spot") && l.includes("Found in"));
    expect(sweetSpotLine).toBeTruthy();
    expect(sweetSpotLine!).toContain("Profile › Stats");
    expect(sweetSpotLine!).not.toContain("History");
  });
});
