import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type ColdTakeResponse = { takes: string[]; date: string };

export function ColdTakeOverlay({ isActive }: { isActive: boolean }) {
  const { data } = useQuery<ColdTakeResponse>({
    queryKey: ["/api/cold-take"],
    enabled: isActive,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setVisible(false);
      setIndex(0);
      return;
    }
    const showTimer = setTimeout(() => setVisible(true), 12000);
    const rotateTimer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => i + 1);
        setVisible(true);
      }, 400);
    }, 45000);
    return () => {
      clearTimeout(showTimer);
      clearInterval(rotateTimer);
    };
  }, [isActive]);

  if (!data?.takes?.length) return null;
  const take = data.takes[index % data.takes.length];

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
