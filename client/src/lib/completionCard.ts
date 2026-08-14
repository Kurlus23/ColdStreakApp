/**
 * Helpers for the post-plunge completion card.
 *
 * Extracted so the Brain Freeze visibility logic can be imported
 * by tests and will fail if the real logic regresses.
 */

export interface CompletionCardData {
  score: string;
  duration: number;
  temperature: number;
  timerUsed: boolean;
  tempMin?: number;
  tempMax?: number;
  brainFreezeScore?: number;
}

/**
 * Returns the brainFreezeScore field to spread into the completion card data
 * and createPlunge payload.  Returns an empty object when Brain Freeze is
 * disabled or no questions were answered (score === 0).
 *
 * Used in two places in Home.tsx:
 *  1. The createPlunge.mutate payload (so the score is persisted to the DB).
 *  2. The promptPlungeRef assignment (so the completion card can show the row).
 */
export function buildBrainFreezeField(
  brainFreezeEnabled: boolean,
  score: number,
): { brainFreezeScore?: number } {
  if (brainFreezeEnabled && score > 0) {
    return { brainFreezeScore: score };
  }
  return {};
}

/**
 * Render guard for the Brain Freeze row on the completion card.
 *
 * Mirrors the JSX condition at line ~8391 of Home.tsx:
 *   promptPlungeRef.current?.brainFreezeScore != null &&
 *   promptPlungeRef.current.brainFreezeScore > 0
 *
 * Returns true only when a positive Brain Freeze score was recorded.
 */
export function shouldShowBrainFreezeRow(
  data: CompletionCardData | null | undefined,
): boolean {
  return data?.brainFreezeScore != null && data.brainFreezeScore > 0;
}

/**
 * Label text shown inside the Brain Freeze row.
 *
 * Mirrors the JSX text at line ~8395 of Home.tsx:
 *   `${promptPlungeRef.current.brainFreezeScore} correct`
 */
export function brainFreezeRowLabel(
  data: CompletionCardData | null | undefined,
): string | null {
  const score = data?.brainFreezeScore;
  if (score == null || score <= 0) return null;
  return `${score} correct`;
}
