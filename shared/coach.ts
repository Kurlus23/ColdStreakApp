export interface CoachResponse {
  reply: string;
  navigate?: string | null;
}

const FALLBACK_REPLY = "Sorry, I couldn't generate a response — please try again.";

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    // A truncated provider response may not have a valid closing quote.
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

function parseResponseObject(value: string): CoachResponse | null {
  const cleaned = stripCodeFence(value);
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed !== "object" || parsed === null) continue;
      const record = parsed as Record<string, unknown>;
      if (typeof record.reply !== "string") continue;
      return {
        reply: record.reply,
        navigate: typeof record.navigate === "string" ? record.navigate : null,
      };
    } catch {
      // Try the tolerant extractor below for incomplete JSON.
    }
  }

  // Preserve the useful reply when the model stopped before closing its JSON.
  const replyMatch = cleaned.match(
    /["']reply["']\s*:\s*"((?:\\[\s\S]|[^"\\])*)"?/i,
  );
  if (!replyMatch) return null;
  return { reply: decodeJsonString(replyMatch[1]), navigate: null };
}

function looksLikeResponseObject(value: string): boolean {
  const cleaned = stripCodeFence(value);
  return /^\{[\s\S]*["']reply["']\s*:/i.test(cleaned);
}

/**
 * Gemini is instructed to return JSON, but some models occasionally add a
 * markdown fence, return an incomplete envelope, or nest the envelope inside
 * the reply string. Normalize all of those shapes before they reach the UI.
 */
export function normalizeCoachReply(value: unknown): CoachResponse {
  let current =
    typeof value === "string"
      ? value
      : typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).reply === "string"
        ? (value as Record<string, string>).reply
        : "";
  let navigate: string | null | undefined =
    typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).navigate === "string"
      ? (value as Record<string, string>).navigate
      : null;

  for (let depth = 0; depth < 3; depth++) {
    const parsed = parseResponseObject(current);
    if (!parsed) break;
    navigate = parsed.navigate ?? navigate;
    current = parsed.reply;
    if (!looksLikeResponseObject(current)) {
      return { reply: stripCodeFence(current) || FALLBACK_REPLY, navigate };
    }
  }

  return { reply: stripCodeFence(current) || FALLBACK_REPLY, navigate };
}