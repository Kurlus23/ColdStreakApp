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
}: {
  isActive: boolean;
  elapsedSeconds: number;
  tempF?: number | null;
}) {
  const { data } = useQuery<ColdTakeResponse>({
    queryKey: ["/api/cold-take"],
    enabled: isActive,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  // Derive everything from elapsedSeconds — no timers, no state, no leaks.
  // Slot increments every 45s starting at the 12s reveal mark.
  const slot = Math.max(0, Math.floor((elapsedSeconds - FIRST_REVEAL_SEC) / ROTATE_EVERY_SEC));
  const visible = elapsedSeconds >= FIRST_REVEAL_SEC && data != null;

  // Bucket recomputation: only re-pick when the slot, temp tier, or
  // time tier (30s/120s/300s) actually changes.
  const tempTier = tempF == null ? 0 : tempF < 40 ? 1 : tempF > 50 ? 2 : 3;
  const timeTier =
    elapsedSeconds < 30 ? 0 : elapsedSeconds < 120 ? 1 : elapsedSeconds < 300 ? 2 : 3;

  const take = useMemo(() => {
    if (!data) return null;
    return pickColdTake(elapsedSeconds, tempF ?? null, data.seed, slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.seed, slot, tempTier, timeTier]);

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
