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
  brainFreezeCorrect?: number;
  brainFreezeTotal?: number;
}

/**
 * Returns the brainFreeze fields to spread into the completion card data
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
  correct?: number,
  total?: number,
): { brainFreezeScore?: number; brainFreezeCorrect?: number; brainFreezeTotal?: number } {
  if (brainFreezeEnabled && score > 0) {
    return {
      brainFreezeScore: score,
      ...(total != null && total > 0 ? { brainFreezeCorrect: correct ?? 0, brainFreezeTotal: total } : {}),
    };
  }
  return {};
}

/**
 * Render guard for the Brain Freeze row on the completion card.
 * Returns true only when a positive Brain Freeze score was recorded.
 */
export function shouldShowBrainFreezeRow(
  data: CompletionCardData | null | undefined,
): boolean {
  return data?.brainFreezeScore != null && data.brainFreezeScore > 0;
}

/**
 * Label text shown inside the Brain Freeze row.
 * Shows "X/Y correct · N pts" when correct/total counts are available,
 * otherwise falls back to points only.
 */
export function brainFreezeRowLabel(
  data: CompletionCardData | null | undefined,
): string | null {
  const score = data?.brainFreezeScore;
  if (score == null || score <= 0) return null;
  const correct = data?.brainFreezeCorrect;
  const total   = data?.brainFreezeTotal;
  if (total != null && total > 0) {
    return `${correct ?? 0}/${total} correct · ${score} pts`;
  }
  return `${score} pts`;
}
