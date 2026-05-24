import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { pickColdTake } from "@shared/coldTakes";

type ColdTakeResponse = { seed: number; date: string };

const FIRST_REVEAL_SEC = 12;
const ROTATE_EVERY_SEC = 45;

export function ColdTakeOverlay({
  isActive,
  elapsedSeconds,
  tempF,
  isFirstPlunge,
  streakDays,
}: {
  isActive: boolean;
  elapsedSeconds: number;
  tempF?: number | null;
  isFirstPlunge?: boolean;
  streakDays?: number | null;
}) {
  const { data } = useQuery<ColdTakeResponse>({
    queryKey: ["/api/cold-take"],
    enabled: isActive,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Slot increments every 45s starting at the 12s reveal mark.
  const slot = Math.max(0, Math.floor((elapsedSeconds - FIRST_REVEAL_SEC) / ROTATE_EVERY_SEC));
  const visible = elapsedSeconds >= FIRST_REVEAL_SEC && data != null;

  // Recompute keys — only when something tier-affecting changes.
  const tempTier = tempF == null ? 0 : tempF < 45 ? 1 : tempF > 50 ? 2 : 3;
  const timeTier =
    elapsedSeconds < 30 ? 0 : elapsedSeconds < 120 ? 1 : elapsedSeconds < 300 ? 2 : 3;
  const streakTier = (streakDays ?? 0) >= 30 ? 1 : 0;

  const take = useMemo(() => {
    if (!data) return null;
    return pickColdTake(
      { seconds: elapsedSeconds, tempF: tempF ?? null, isFirstPlunge, streakDays },
      data.seed,
      slot,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.seed, slot, tempTier, timeTier, streakTier, isFirstPlunge]);

  if (!take) return null;

  return (
    <div
      className={`max-w-md px-6 text-center transition-opacity duration-500 ${
        visible ? "opacity-90" : "opacity-0"
      }`}
      data-testid="text-cold-take"
    >
      <div className="text-blue-300/70 text-[10px] uppercase tracking-[0.2em] mb-1.5">
        Cold Take
      </div>
      <div className="text-blue-100 text-base italic font-light leading-snug">
        "{take}"
      </div>
    </div>
  );
}
