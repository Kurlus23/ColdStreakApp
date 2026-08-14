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

type Phase = "loading" | "showing" | "answered" | "done";

interface BrainFreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUESTION_TIMEOUT  = 20;    // seconds to answer
const RESULT_DISPLAY_MS = 4500;  // ms to show correct/wrong before advancing
const MAX_QUESTIONS     = 10;
const LABELS            = ["A", "B", "C", "D"];

function getToken() {
  try { return localStorage.getItem("coldstreak-auth-token"); } catch { return null; }
}

export function BrainFreezeModal({ isOpen, onClose }: BrainFreezeModalProps) {
  const [question, setQuestion]   = useState<Question | null>(null);
  const [phase, setPhase]         = useState<Phase>("loading");
  const [answers, setAnswers]     = useState<string[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [timeLeft, setTimeLeft]   = useState(QUESTION_TIMEOUT);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal]     = useState(0);

  // Refs for values needed inside timeouts (avoid stale closures)
  const phaseRef        = useRef<Phase>("loading");
  const shownAtRef      = useRef(Date.now());
  const questionNumRef  = useRef(0);
  const correctCountRef = useRef(0);  // reliable score for done screen

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const fetchQuestion = useCallback(async () => {
    if (questionNumRef.current >= MAX_QUESTIONS) {
      setPhase("done");
      return;
    }
    const token = getToken();
    if (!token) return;
    setPhase("loading");
    setQuestion(null);
    setSelected(null);
    try {
      const res = await fetch("/api/brain-freeze/question", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const q: Question = await res.json();
      const all = [q.correct, ...q.wrong].sort(() => Math.random() - 0.5);
      shownAtRef.current = Date.now();
      questionNumRef.current += 1;
      setQuestion(q);
      setAnswers(all);
      setTimeLeft(QUESTION_TIMEOUT);
      setPhase("showing");
    } catch {}
  }, []);

  // Fetch first question when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSessionCorrect(0);
    setSessionTotal(0);
    questionNumRef.current = 0;
    correctCountRef.current = 0;
    fetchQuestion();
  }, [isOpen, fetchQuestion]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuestion(null);
      setPhase("loading");
      setSelected(null);
    }
  }, [isOpen]);

  // Countdown when question is showing
  useEffect(() => {
    if (phase !== "showing") return;
    if (timeLeft <= 0) { handleAnswer(null); return; }
    const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
    return () => clearTimeout(t);
  });

  const handleAnswer = useCallback((ans: string | null) => {
    if (phaseRef.current !== "showing" || !question) return;

    const correct = ans !== null && ans === question.correct;
    const elapsedMs = Math.min(Date.now() - shownAtRef.current, QUESTION_TIMEOUT * 1000);

    if (correct) correctCountRef.current += 1;
    setSelected(ans);
    setPhase("answered");
    setSessionTotal((t) => t + 1);
    if (correct) setSessionCorrect((c) => c + 1);

    // Log to server
    const token = getToken();
    if (token) {
      fetch("/api/brain-freeze/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionId:     question.id,
          isCorrect:      correct,
          responseTimeMs: ans === null ? QUESTION_TIMEOUT * 1000 : elapsedMs,
          inPlunge:       false,
        }),
      }).catch(() => {});
    }

    // Always auto-advance after result display — to next question or done screen
    setTimeout(() => {
      if (phaseRef.current === "answered") fetchQuestion();
    }, RESULT_DISPLAY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, fetchQuestion]);

  if (!isOpen) return null;

  const isCorrect = selected !== null && selected === question?.correct;
  const timedOut  = selected === null && phase === "answered";
  const qNum      = questionNumRef.current;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: "rgba(0,8,26,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: "rgba(3,18,52,0.98)",
          border: "1px solid rgba(96,165,250,0.28)",
          boxShadow: "0 0 60px rgba(56,189,248,0.14), 0 28px 72px rgba(0,0,0,0.9)",
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
            <p className="text-blue-400/60 text-[10px] leading-none">
              {phase === "done"
                ? "Session complete"
                : sessionTotal > 0
                  ? `${sessionCorrect} / ${sessionTotal} correct · Q${qNum} of ${MAX_QUESTIONS}`
                  : question
                    ? `${question.category} · ${question.difficulty}`
                    : "Loading…"}
            </p>
          </div>

          {/* Countdown or close */}
          {phase === "showing" ? (
            <span
              className="text-2xl font-black tabular-nums leading-none"
              style={{ color: timeLeft <= 5 ? "#f87171" : "#67e8f9" }}
            >
              {timeLeft}
            </span>
          ) : (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-blue-400 hover:text-white transition-colors"
              style={{ background: "rgba(96,165,250,0.1)" }}
              aria-label="Close"
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

        {/* Done / summary screen */}
        {phase === "done" && (
          <div className="flex flex-col items-center px-6 py-10 gap-4">
            <img
              src="/brain-freeze-icon.png"
              alt=""
              className="w-16 h-16 rounded-2xl object-cover"
              style={{ boxShadow: "0 0 24px rgba(96,165,250,0.5)" }}
            />
            <p className="text-white text-lg font-bold">Session done!</p>
            <p className="text-cyan-300 text-3xl font-black">
              {correctCountRef.current} <span className="text-blue-400/60 text-lg font-semibold">/ {MAX_QUESTIONS}</span>
            </p>
            <p className="text-blue-300/60 text-xs text-center">
              {correctCountRef.current >= 8 ? "🧊 Elite cold-brain performance" :
               correctCountRef.current >= 6 ? "Solid — keep chilling" :
               correctCountRef.current >= 4 ? "Getting sharper with every plunge" :
               "The cold will make you smarter 💪"}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: "rgba(34,211,238,0.18)", border: "1px solid rgba(34,211,238,0.3)" }}
            >
              Done
            </button>
          </div>
        )}

        {/* Loading state */}
        {phase === "loading" && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          </div>
        )}

        {/* Question */}
        {question && phase !== "done" && (
          <>
            <div className="px-4 py-4">
              <p className="text-white text-sm font-semibold leading-snug">
                {question.question}
              </p>
            </div>

            {/* Answer buttons */}
            <div className="px-4 pb-3 space-y-2">
              {answers.map((ans, i) => {
                const isSelected = selected === ans;
                const isRight    = ans === question.correct;
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

            {/* Result banner */}
            {phase === "answered" && (
              <div
                className="mx-4 rounded-2xl px-3 py-2.5"
                style={{
                  background: (isCorrect ? "rgba(16,94,46,0.25)" : timedOut ? "rgba(60,60,60,0.3)" : "rgba(110,18,18,0.25)"),
                  border: `1px solid ${isCorrect ? "rgba(34,197,94,0.3)" : timedOut ? "rgba(96,165,250,0.15)" : "rgba(239,68,68,0.3)"}`,
                }}
              >
                <p className="text-[11px] font-semibold mb-0.5" style={{ color: isCorrect ? "#86efac" : timedOut ? "#94a3b8" : "#fca5a5" }}>
                  {isCorrect ? "Correct! 🧊" : timedOut ? "Time's up" : `Answer: ${question.correct}`}
                </p>
                {question.explanation && (
                  <p className="text-blue-300/70 text-[11px] leading-snug">{question.explanation}</p>
                )}
              </div>
            )}

            {/* Footer — skip button while waiting to advance */}
            {phase === "answered" && (
              <div className="px-4 py-4 flex items-center justify-between">
                <p className="text-blue-500/60 text-[10px]">
                  {qNum >= MAX_QUESTIONS ? "Last question…" : "Next question…"}
                </p>
                <button
                  onClick={fetchQuestion}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 transition-all active:scale-95"
                  style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}
                >
                  {qNum >= MAX_QUESTIONS ? "See results →" : "Skip →"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
