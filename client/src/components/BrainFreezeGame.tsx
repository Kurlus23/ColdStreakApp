import { useState, useEffect, useRef, useCallback } from "react";

interface Question {
  id: number;
  question: string;
  correct: string;
  wrong: string[];
  category: string;
  difficulty: string;
  explanation: string;
}

type Phase = "idle" | "loading" | "showing" | "answered";

interface BrainFreezeGameProps {
  elapsedSeconds: number;
  temperature: number;
  isActive: boolean;
  enabled: boolean;
  onScoreUpdate?: (score: number) => void;
  onStopGame?: () => void;
  onStopPlunge?: () => void;
  onCountdownUpdate?: (seconds: number | null) => void;
  onBrainFreezeStats?: (correct: number, total: number) => void;
}

const FIRST_QUESTION_AT = 30;  // seconds into plunge before first question
const BETWEEN_QUESTIONS = 60;  // seconds between questions (after dismissal)
const QUESTION_TIMEOUT  = 20;  // seconds allowed to answer
const LABELS            = ["A", "B", "C", "D"];

function getSpeedTier(points: number, correct: boolean, timedOut: boolean): string | null {
  if (timedOut || !correct) return null;
  if (points >= 125) return "⚡⚡ Instant";
  if (points >= 110) return "⚡ Fast";
  if (points >= 90)  return "✅ Normal";
  if (points >= 60)  return "🐢 Slow";
  return null;
}

function getColdBonusLabel(waterTempF: number): string | null {
  if (waterTempF < 40) return "🧊 +50% cold bonus";
  if (waterTempF < 50) return "🧊 +30% cold bonus";
  if (waterTempF < 60) return "🧊 +15% cold bonus";
  return null;
}

export function BrainFreezeGame({
  elapsedSeconds,
  temperature,
  isActive,
  enabled,
  onScoreUpdate,
  onStopGame,
  onStopPlunge,
  onCountdownUpdate,
  onBrainFreezeStats,
}: BrainFreezeGameProps) {
  const [question, setQuestion]   = useState<Question | null>(null);
  const [phase, setPhase]         = useState<Phase>("idle");
  const [answers, setAnswers]     = useState<string[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft]   = useState(QUESTION_TIMEOUT);
  const [lastPoints, setLastPoints]     = useState<number | null>(null);
  const [lastTempF, setLastTempF]       = useState<number | null>(null);
  const [autoCloseLeft, setAutoCloseLeft] = useState<number | null>(null);

  const scoreRef          = useRef(0);
  const correctCountRef   = useRef(0);
  const totalAnsweredRef  = useRef(0);
  const phaseRef          = useRef<Phase>("idle");
  const fetchingRef       = useRef(false);
  const dismissedAtRef    = useRef<number | null>(null);
  const firstShownRef     = useRef(false);
  const shownAtElapsedRef = useRef(0);
  const questionCountRef  = useRef(0); // tracks questions served; every 3rd is a cold-plunge question

  // Refs for fast-changing props so callbacks don't need them as deps
  const elapsedSecondsRef  = useRef(elapsedSeconds);
  const temperatureRef     = useRef(temperature);
  const timeLeftRef        = useRef(QUESTION_TIMEOUT);
  const onScoreUpdateRef   = useRef(onScoreUpdate);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { temperatureRef.current = temperature; }, [temperature]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);

  // Fire countdown every second so the plunge screen can display "Next question in Xs"
  useEffect(() => {
    if (!enabled || phase === "showing" || phase === "loading") {
      onCountdownUpdate?.(null);
      return;
    }
    // phase === "idle" or "answered" — compute seconds until next question
    if (firstShownRef.current && dismissedAtRef.current !== null) {
      const secsLeft = Math.max(0, dismissedAtRef.current + BETWEEN_QUESTIONS - elapsedSeconds);
      onCountdownUpdate?.(secsLeft);
    } else {
      onCountdownUpdate?.(null);
    }
  }, [enabled, phase, elapsedSeconds, onCountdownUpdate]);

  const getToken = () => {
    try { return localStorage.getItem("coldstreak-auth-token"); } catch { return null; }
  };

  const fetchQuestion = useCallback(async (currentElapsed: number) => {
    if (fetchingRef.current) return;
    const token = getToken();
    if (!token) return;

    fetchingRef.current = true;
    setPhase("loading");

    // Every 3rd question slot (1-indexed) is a cold-plunge question
    questionCountRef.current += 1;
    const coldPlunge = questionCountRef.current % 3 === 0;

    try {
      const res = await fetch(`/api/brain-freeze/question${coldPlunge ? "?coldPlunge=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setPhase("idle"); return; }
      const q: Question = await res.json();

      const all = [q.correct, ...q.wrong].sort(() => Math.random() - 0.5);
      shownAtElapsedRef.current = currentElapsed;
      setQuestion(q);
      setAnswers(all);
      setSelected(null);
      setIsCorrect(null);
      setLastPoints(null);
      setLastTempF(null);
      setTimeLeft(QUESTION_TIMEOUT);
      setPhase("showing");
    } catch {
      setPhase("idle");
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Trigger questions based on elapsed time
  useEffect(() => {
    if (!enabled || !isActive) return;
    const p = phaseRef.current;
    if (p === "loading" || p === "showing" || p === "answered") return;

    if (!firstShownRef.current && elapsedSeconds >= FIRST_QUESTION_AT) {
      firstShownRef.current = true;
      fetchQuestion(elapsedSeconds);
      return;
    }

    if (firstShownRef.current && dismissedAtRef.current !== null &&
        elapsedSeconds >= dismissedAtRef.current + BETWEEN_QUESTIONS) {
      dismissedAtRef.current = null;
      fetchQuestion(elapsedSeconds);
    }
  }, [elapsedSeconds, enabled, isActive, fetchQuestion]);

  // Answer handler — stable: uses refs for timeLeft, temperature, elapsedSeconds
  const handleAnswer = useCallback(async (ans: string | null) => {
    if (phaseRef.current !== "showing" || !question) return;

    const correct   = ans !== null && ans === question.correct;
    const tl        = timeLeftRef.current;
    const responseMs = ans === null
      ? QUESTION_TIMEOUT * 1000
      : Math.min((QUESTION_TIMEOUT - tl) * 1000, QUESTION_TIMEOUT * 1000);

    const snapTempF = Math.round(temperatureRef.current);
    setLastPoints(null);
    setLastTempF(snapTempF);
    setSelected(ans);
    setIsCorrect(correct);
    setPhase("answered");

    // Post answer, get server-computed points (100 base + up to 50 speed bonus)
    let pts = 0;
    const token = getToken();
    if (token) {
      try {
        const res = await fetch("/api/brain-freeze/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            questionId:           question.id,
            isCorrect:            correct,
            responseTimeMs:       responseMs,
            timedOut:             ans === null,
            inPlunge:             true,
            plungeElapsedSeconds: shownAtElapsedRef.current,
            waterTempF:           snapTempF,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          pts = data.points ?? (correct ? 100 : 0);
          setLastPoints(pts);
        }
      } catch {}
    }

    if (pts > 0) {
      scoreRef.current += pts;
      onScoreUpdateRef.current?.(scoreRef.current);
    }
    if (correct) correctCountRef.current += 1;
    totalAnsweredRef.current += 1;
    onBrainFreezeStats?.(correctCountRef.current, totalAnsweredRef.current);
    // No auto-dismiss — user taps "Next →"
  }, [question, onBrainFreezeStats]);

  // Dismiss handler — records when the user closes the card
  const handleDismiss = useCallback(() => {
    dismissedAtRef.current = elapsedSecondsRef.current;
    setPhase("idle");
    setQuestion(null);
  }, []);

  // Stop game — dismisses overlay and turns off Brain Freeze
  const handleStopGame = useCallback(() => {
    dismissedAtRef.current = elapsedSecondsRef.current;
    setPhase("idle");
    setQuestion(null);
    onStopGame?.();
  }, [onStopGame]);

  // Question countdown — auto-submit when time runs out
  useEffect(() => {
    if (phase !== "showing") return;
    if (timeLeft <= 0) { handleAnswer(null); return; }
    const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, handleAnswer]);

  // Auto-close countdown — dismiss the answer card after 10 s if user doesn't tap Next
  const AUTO_CLOSE_SECS = 10;
  useEffect(() => {
    if (phase !== "answered") { setAutoCloseLeft(null); return; }
    setAutoCloseLeft(AUTO_CLOSE_SECS);
  }, [phase]);

  useEffect(() => {
    if (phase !== "answered" || autoCloseLeft === null) return;
    if (autoCloseLeft <= 0) { handleDismiss(); return; }
    const t = setTimeout(() => setAutoCloseLeft((n) => (n ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, autoCloseLeft, handleDismiss]);

  if (!enabled || phase === "idle" || phase === "loading") return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(0,8,26,0.80)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "rgba(3,18,52,0.97)",
          border: "1px solid rgba(96,165,250,0.28)",
          boxShadow: "0 0 48px rgba(56,189,248,0.12), 0 24px 64px rgba(0,0,0,0.85)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-blue-900/50">
          <img
            src="/brain-freeze-icon.png"
            alt=""
            className="w-9 h-9 rounded-xl object-cover shrink-0"
            style={{ boxShadow: "0 0 14px rgba(96,165,250,0.45)" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400 uppercase leading-none mb-0.5">
              Brain Freeze
            </p>
            <p className="text-blue-400/60 text-[10px] leading-none truncate">
              {question?.category} · {question?.difficulty}
            </p>
          </div>

          {/* Countdown or dismiss X */}
          {phase === "showing" ? (
            <span
              className="text-2xl font-black tabular-nums leading-none"
              style={{ color: timeLeft <= 5 ? "#f87171" : "#67e8f9" }}
            >
              {timeLeft}
            </span>
          ) : (
            <button
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full text-blue-400 hover:text-white transition-colors"
              style={{ background: "rgba(96,165,250,0.1)" }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Countdown bar */}
        <div className="h-1 bg-blue-950">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: phase === "showing" ? `${(timeLeft / QUESTION_TIMEOUT) * 100}%` : "0%",
              background: timeLeft <= 5 ? "#f87171" : "#22d3ee",
            }}
          />
        </div>

        {/* Question */}
        <div className="px-4 py-4">
          <p className="text-white text-sm font-semibold leading-snug">
            {question?.question}
          </p>
        </div>

        {/* Answer buttons */}
        <div className="px-4 pb-3 space-y-2">
          {answers.map((ans, i) => {
            const isSelected = selected === ans;
            const isRight    = ans === question?.correct;
            let bgColor      = "rgba(13,35,80,0.7)";
            let borderColor  = "rgba(59,130,246,0.2)";
            let textColor    = "#94a3b8";

            if (phase === "answered") {
              if (isRight) {
                bgColor     = "rgba(16,94,46,0.65)";
                borderColor = "rgba(34,197,94,0.55)";
                textColor   = "#86efac";
              } else if (isSelected) {
                bgColor     = "rgba(110,18,18,0.55)";
                borderColor = "rgba(239,68,68,0.45)";
                textColor   = "#fca5a5";
              }
            }

            return (
              <button
                key={i}
                disabled={phase !== "showing"}
                onClick={() => handleAnswer(ans)}
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all active:scale-[0.97]"
                style={{ background: bgColor, border: `1px solid ${borderColor}` }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                >
                  {LABELS[i]}
                </span>
                <span className="text-xs leading-snug flex-1" style={{ color: textColor }}>
                  {ans}
                </span>
                {phase === "answered" && isRight && (
                  <span className="text-green-400 text-sm shrink-0">✓</span>
                )}
                {phase === "answered" && isSelected && !isRight && (
                  <span className="text-red-400 text-sm shrink-0">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation + Got it button */}
        {phase === "answered" && (
          <>
            <div
              className="mx-4 rounded-2xl px-3 py-2.5"
              style={{
                background: isCorrect ? "rgba(16,94,46,0.2)" : selected === null ? "rgba(60,60,60,0.3)" : "rgba(96,165,250,0.07)",
                border: `1px solid ${isCorrect ? "rgba(34,197,94,0.25)" : selected === null ? "rgba(96,165,250,0.15)" : "rgba(96,165,250,0.14)"}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-[11px] font-semibold" style={{ color: isCorrect ? "#86efac" : selected === null ? "#94a3b8" : "#fca5a5" }}>
                  {isCorrect ? "Correct! 🧊" : selected === null ? "Time's up" : `Answer: ${question?.correct}`}
                </p>
                {lastPoints !== null && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {getSpeedTier(lastPoints, !!isCorrect, selected === null) && (
                      <span className="text-[10px] font-semibold text-blue-300/70">
                        {getSpeedTier(lastPoints, !!isCorrect, selected === null)}
                      </span>
                    )}
                    {selected !== null && lastTempF !== null && getColdBonusLabel(lastTempF) && (
                      <span className="text-[10px] font-semibold text-cyan-300/80">
                        {getColdBonusLabel(lastTempF)}
                      </span>
                    )}
                    <span
                      className="text-[11px] font-black tabular-nums"
                      style={{ color: isCorrect ? "#34d399" : selected === null ? "#64748b" : "#f87171" }}
                    >
                      {selected === null ? "0 pts" : `+${lastPoints} pts`}
                    </span>
                  </div>
                )}
              </div>
              {question?.explanation && (
                <p className="text-blue-300/75 text-[11px] leading-snug">{question.explanation}</p>
              )}
            </div>
            <div className="px-4 pt-3 flex justify-end">
              <button
                onClick={handleDismiss}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-cyan-300 transition-all active:scale-95"
                style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.3)" }}
              >
                Next {autoCloseLeft !== null ? `(${autoCloseLeft}s)` : "→"}
              </button>
            </div>
          </>
        )}

        {/* Stop controls — always visible */}
        <div className="px-4 pb-4 pt-2 flex gap-2">
          <button
            onClick={handleStopGame}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: "rgba(30,41,59,0.7)",
              border: "1px solid rgba(71,85,105,0.4)",
              color: "#94a3b8",
            }}
          >
            Stop game
          </button>
          <button
            onClick={onStopPlunge}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: "rgba(127,29,29,0.55)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fca5a5",
            }}
          >
            Stop plunge
          </button>
        </div>
      </div>
    </div>
  );
}
