import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pickColdTake, pickChallengeColdTake } from "@shared/coldTakes";

type ColdTakeResponse = { seed: number; date: string };

const FIRST_REVEAL_SEC   = 12;
const POST_RECOVERY_MS   = 60_000;  // cold-take cycle time once all milestones are done

export interface MilestoneEvent {
  segId:  string;
  emoji:  string;
  label:  string;
  count:  number; // increments each time a milestone fires to trigger the effect
}

export function ColdTakeOverlay({
  isActive,
  elapsedSeconds,
  tempF,
  isFirstPlunge,
  streakDays,
  milestoneEvent,
  challengerName,
}: {
  isActive:        boolean;
  elapsedSeconds:  number;
  tempF?:          number | null;
  isFirstPlunge?:  boolean;
  streakDays?:     number | null;
  milestoneEvent?: MilestoneEvent | null;
  /** When set, cold takes are drawn from the challenge-mode pool with the opponent's name woven in. */
  challengerName?: string | null;
}) {
  const { data } = useQuery<ColdTakeResponse>({
    queryKey:  ["/api/cold-take"],
    enabled:   isActive,
    staleTime: 60 * 60 * 1000,
    gcTime:    24 * 60 * 60 * 1000,
  });

  // ── Slot state ──────────────────────────────────────────────────────────────
  // slot 0 = first cold take; later slots rotate context without interrupting
  // the timer with a milestone announcement.
  const handledCountRef = useRef(0);

  const [slot, setSlot] = useState(0);

  // Keep the cold-take rotation moving, but do not announce the milestone.
  useEffect(() => {
    if (!milestoneEvent || milestoneEvent.count === handledCountRef.current) return;
    handledCountRef.current = milestoneEvent.count;
    setSlot(s => s + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneEvent?.count]);

  // Post-recovery cycling every 60 s once all milestones are done
  useEffect(() => {
    if (!isActive || slot < 4) return;
    const id = setTimeout(() => setSlot(s => s + 1), POST_RECOVERY_MS);
    return () => clearTimeout(id);
  }, [slot, isActive]);

  // ── Visibility ──────────────────────────────────────────────────────────────
  const visible = elapsedSeconds >= FIRST_REVEAL_SEC && data != null;

  // Memo deps — tier buckets so we don't re-pick on every tick
  const tempTier   = tempF == null ? 0 : tempF < 45 ? 1 : tempF > 50 ? 2 : 3;
  const timeTier   = elapsedSeconds < 30 ? 0 : elapsedSeconds < 120 ? 1 : elapsedSeconds < 300 ? 2 : 3;
  const streakTier = (streakDays ?? 0) >= 30 ? 1 : 0;

  const take = useMemo(() => {
    if (!data) return null;
    // Challenge mode: draw from the rivalry pool
    if (challengerName) {
      const firstName = challengerName.split(" ")[0];
      return pickChallengeColdTake(firstName, data.seed, slot);
    }
    // Slot 0 and post-recovery slots 5+: context-based pick
    return pickColdTake(
      { seconds: elapsedSeconds, tempF: tempF ?? null, isFirstPlunge, streakDays },
      data.seed,
      slot,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.seed, slot, tempTier, timeTier, streakTier, isFirstPlunge]);

  if (!visible) return null;

  // ── Cold take card ──────────────────────────────────────────────────────────
  if (!take) return null;

  return (
    <div
      className="w-full max-w-md mx-auto px-5 py-3 rounded-2xl bg-blue-950/70 backdrop-blur-sm border border-cyan-400/20 shadow-lg shadow-black/30 text-center transition-opacity duration-500 opacity-100"
      data-testid="text-cold-take"
    >
      <div className="text-cyan-300/80 text-[10px] uppercase tracking-[0.25em] mb-1.5 font-semibold">
        ❄ Cold Take
      </div>
      <div className="text-white text-base italic font-light leading-snug">
        "{take}"
      </div>
    </div>
  );
}
