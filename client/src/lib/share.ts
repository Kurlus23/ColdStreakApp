import { isNative, nativeShare } from "./nativeShare";

export type ShareKind = "plunge" | "profile" | "badge_profile" | "event";
export type ShareChannel = "native" | "webshare" | "clipboard" | "file" | "unknown";

// Fire-and-forget telemetry — never blocks the share UX.
export function logShareEvent(kind: ShareKind, opts?: { targetId?: string | number; channel?: ShareChannel }): void {
  try {
    const cid = (() => { try { return localStorage.getItem("coldstreak-client-id") || undefined; } catch { return undefined; } })();
    const token = (() => { try { return localStorage.getItem("coldstreak-auth-token") || undefined; } catch { return undefined; } })();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cid) headers["X-Client-Id"] = cid;
    if (token) headers["Authorization"] = `Bearer ${token}`;
    void fetch("/api/share-events", {
      method: "POST",
      headers,
      keepalive: true,
      body: JSON.stringify({
        kind,
        targetId: opts?.targetId !== undefined ? String(opts.targetId) : undefined,
        channel: opts?.channel,
      }),
    }).catch(() => { /* ignore — never block share */ });
  } catch { /* ignore */ }
}

export async function shareContent({
  title,
  text,
  url,
  trackAs,
  trackId,
}: {
  title: string;
  text?: string;
  url?: string;
  trackAs?: ShareKind;        // when set, logs a share event with this kind
  trackId?: string | number;  // optional target id (plunge id, event slug, username)
}): Promise<void> {
  let channel: ShareChannel = "unknown";
  try {
    if (isNative()) {
      await nativeShare({ title, text, url });
      channel = "native";
      return;
    }

    if (navigator.share) {
      try {
        console.log("SHARE MESSAGE:", text, "URL:", url);
        await navigator.share({
          ...(text ? { text } : {}),
          ...(url ? { url } : {}),
        });
        channel = "webshare";
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") { channel = "unknown"; return; }
      }
    }

    try {
      const payload = [text, url].filter(Boolean).join("\n");
      await navigator.clipboard.writeText(payload);
      channel = "clipboard";
    } catch { /* ignore */ }
  } finally {
    if (trackAs && channel !== "unknown") logShareEvent(trackAs, { targetId: trackId, channel });
  }
}
