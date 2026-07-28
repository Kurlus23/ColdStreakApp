/**
 * CoachFAB — floating AI coach button + slide-up chat panel.
 *
 * • Fixed in the bottom-right corner, above the navigation bar.
 * • Badge indicator when there are unseen feature announcements.
 * • On open, injects unseen announcements as coach messages then marks them seen.
 * • Chat history is persisted to localStorage (last 20 messages), keyed per user.
 * • Calls POST /api/coach/chat with message + history; falls back gracefully on error.
 *
 * Suggested quick-question chips are shown when the conversation is empty.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  getUnseenAnnouncements,
  markAllAnnouncementsSeen,
  type Announcement,
} from "@/lib/coachAnnouncements";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** True for transient error/fallback messages that should not be persisted. */
  isError?: boolean;
}

interface Props {
  /** JWT token for the API call. */
  authToken: string | null;
  /** Current screen the user is viewing (e.g. "history", "friends"). */
  screen?: string;
}

// ── Chat history persistence ──────────────────────────────────────────────────

const MAX_HISTORY = 20;

/** Derive a stable per-user localStorage key from the JWT token.
 *  Decodes the payload to extract the user ID; falls back to a hash of the
 *  token prefix so shared devices don't bleed history between accounts.
 */
function getStorageKey(token: string | null): string {
  if (!token) return "coach-chat-history";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.userId ?? payload.sub ?? payload.id;
    if (userId) return `coach-chat-history:${userId}`;
  } catch {
    // malformed JWT — fall through to prefix-based key
  }
  // Use first 16 chars of the token as a cheap discriminator
  return `coach-chat-history:${token.slice(0, 16)}`;
}

function loadHistory(token: string | null): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(token));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
  } catch {
    // ignore parse errors
  }
  return [];
}

function saveHistory(token: string | null, messages: ChatMessage[]): void {
  try {
    const persistent = messages.filter((m) => !m.isError);
    const trimmed = persistent.slice(-MAX_HISTORY);
    localStorage.setItem(getStorageKey(token), JSON.stringify(trimmed));
  } catch {
    // ignore storage errors (private mode, quota exceeded, etc.)
  }
}

function clearHistory(token: string | null): void {
  try {
    localStorage.removeItem(getStorageKey(token));
  } catch {
    // ignore
  }
}

// ── Quick-question chips ──────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  "How does the benefits bar work?",
  "What is Cold Adaptation?",
  "How do I build a streak?",
  "What temperature should I aim for?",
  "How does the Sweet Spot work?",
  "What does the plunge score measure?",
];

// ── API helper ────────────────────────────────────────────────────────────────

async function sendMessage(
  token: string,
  message: string,
  history: ChatMessage[],
  screen?: string,
): Promise<string> {
  const res = await fetch("/api/coach/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      history,
      ...(screen ? { context: { screen } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

// ── Component ─────────────────────────────────────────────────────────────────

const FAB_SIZE = 52;
const DRAG_THRESHOLD = 6; // px — below this = tap, above = drag
const POS_KEY = "coach-fab-position";

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function clampPos(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth  - FAB_SIZE - 8;
  const maxY = window.innerHeight - FAB_SIZE - 8;
  return { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) };
}

function defaultPos(): { x: number; y: number } {
  const safeTop = 56; // approx status-bar + a bit
  return { x: 16, y: safeTop };
}

export function CoachFAB({ authToken, screen }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(authToken));
  const [loadedForToken, setLoadedForToken] = useState<string | null>(authToken);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [hasUnread, setHasUnread] = useState(() => getUnseenAnnouncements().length > 0);
  const [panelVisible, setPanelVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? defaultPos());
  const drag = useRef<{
    active: boolean;
    startX: number; startY: number;   // pointer start
    originX: number; originY: number; // button start
    moved: boolean;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d?.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const next = clampPos(d.originX + dx, d.originY + dy);
    setPos(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.moved) {
      // Snap final clamped position and persist
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const next = clampPos(d.originX + dx, d.originY + dy);
      setPos(next);
      try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    // If not moved enough → treat as tap (click fires naturally)
  }, []);

  // When authToken changes (e.g. null → real JWT after auth hydration, or
  // account switch), load the correct history for the new user.  Both setters
  // batch into one re-render so the save effect below never sees a mismatch.
  useEffect(() => {
    if (authToken === loadedForToken) return;
    setLoadedForToken(authToken);
    setMessages(loadHistory(authToken));
  }, [authToken, loadedForToken]);

  // Animate panel in/out
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => setPanelVisible(true), 20);
      return () => clearTimeout(id);
    } else {
      setPanelVisible(false);
    }
  }, [open]);

  // Persist messages to localStorage, but only once the correct user's history
  // is loaded (i.e. loadedForToken matches authToken).  This prevents carrying
  // over stale messages into a different user's key during token transitions.
  useEffect(() => {
    if (loadedForToken !== authToken) return;
    saveHistory(authToken, messages);
  }, [authToken, loadedForToken, messages]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearChat = useCallback(() => {
    clearHistory(authToken);
    setMessages([]);
  }, [authToken]);

  const openPanel = useCallback(() => {
    setOpen(true);

    // Inject unseen announcements as initial coach messages
    const unseen = getUnseenAnnouncements();
    if (unseen.length > 0) {
      const announcementMessages: ChatMessage[] = unseen.map((a: Announcement) => ({
        role: "assistant" as const,
        content: `**${a.title}**\n\n${a.message}`,
      }));
      setMessages((prev) =>
        prev.length === 0 ? announcementMessages : [...prev, ...announcementMessages],
      );
      markAllAnnouncementsSeen();
      setHasUnread(false);
    }

    // Focus input after animation
    setTimeout(() => inputRef.current?.focus(), 380);
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    setTimeout(() => setOpen(false), 280);
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !authToken) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const reply = await sendMessage(authToken, trimmed, messages.concat(userMsg), screen);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't reach the server right now. Try again in a moment.",
            isError: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, authToken, messages, screen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit(input);
      }
    },
    [input, submit],
  );

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => { if (!drag.current?.moved) openPanel(); }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Open coach"
        data-testid="coach-fab"
        className="fixed z-40 rounded-full shadow-lg flex items-center justify-center touch-none select-none"
        style={{
          left: pos.x,
          top: pos.y,
          width: FAB_SIZE,
          height: FAB_SIZE,
          boxShadow: "0 4px 20px rgba(14,165,233,0.45)",
          cursor: "grab",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
      >
        <img
          src="/icons/icon-192.png"
          alt="ColdStreak Coach"
          className="w-full h-full rounded-full object-cover pointer-events-none"
          draggable={false}
          style={{ WebkitTouchCallout: "none", userSelect: "none" }}
        />
        {hasUnread && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a1628]" />
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            style={{
              opacity: panelVisible ? 1 : 0,
              transition: "opacity 0.25s ease",
            }}
            onClick={closePanel}
          />

          {/* Panel */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-blue-800/60 bg-[#0a1628]"
            style={{
              height: "72dvh",
              transform: panelVisible ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s cubic-bezier(.32,0,.67,0)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-blue-800/60" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-blue-900/60 shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ background: "linear-gradient(135deg,#0ea5e9,#0369a1)" }}
                >
                  ❄️
                </div>
                <div>
                  <p className="text-white text-sm font-bold leading-tight">ColdStreak Coach</p>
                  <p className="text-cyan-500 text-[10px] leading-tight">Powered by AI · Always here</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors px-2 py-1 rounded-lg hover:bg-blue-900/60"
                    aria-label="Clear chat history"
                  >
                    Clear chat
                  </button>
                )}
                <button
                  onClick={closePanel}
                  className="w-7 h-7 rounded-full bg-blue-900/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isEmpty && (
                <div className="space-y-3">
                  {/* Welcome */}
                  <div className="flex gap-2 items-start">
                    <div className="w-6 h-6 rounded-full bg-cyan-900/60 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ❄️
                    </div>
                    <div className="bg-blue-900/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                      <p className="text-blue-100 text-sm leading-relaxed">
                        Hey! I'm your ColdStreak Coach. Ask me anything about the app, your stats,
                        or cold plunge science.
                      </p>
                    </div>
                  </div>

                  {/* Quick questions */}
                  <div className="pl-8">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-2">
                      Quick questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => submit(q)}
                          className="text-xs text-cyan-300 border border-cyan-800/60 bg-cyan-950/40 rounded-full px-3 py-1 hover:bg-cyan-900/40 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-cyan-900/60 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ❄️
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-cyan-700/60 text-white rounded-tr-sm"
                        : "bg-blue-900/40 text-blue-100 rounded-tl-sm"
                    }`}
                    dangerouslySetInnerHTML={{
                      // Convert **bold** markdown to <strong> tags safely
                      __html: msg.content
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </div>
              ))}

              {loading && (
                <div className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full bg-cyan-900/60 flex items-center justify-center text-xs shrink-0">
                    ❄️
                  </div>
                  <div className="bg-blue-900/40 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                          style={{
                            animation: "coach-dot-bounce 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pt-2 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <div className="flex gap-2 items-end bg-blue-900/40 rounded-2xl border border-blue-800/50 px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything…"
                  rows={1}
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 resize-none outline-none leading-relaxed"
                  style={{ maxHeight: 80 }}
                />
                <button
                  onClick={() => submit(input)}
                  disabled={!input.trim() || loading || !authToken}
                  className="w-8 h-8 rounded-xl bg-cyan-600 disabled:opacity-30 flex items-center justify-center shrink-0 transition-opacity"
                  aria-label="Send"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 7L13 1L9 7L13 13L1 7Z" fill="white" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dot-bounce animation */}
      <style>{`
        @keyframes coach-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
