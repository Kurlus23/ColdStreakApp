import { isNative, nativeShare } from "./nativeShare";

export async function shareContent({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url?: string;
}): Promise<void> {
  if (isNative()) {
    await nativeShare({ title, text, url });
    return;
  }

  if (navigator.share) {
    try {
      console.log("SHARE MESSAGE:", text, "URL:", url);
      await navigator.share({ text, ...(url ? { url } : {}) });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  } catch { /* ignore */ }
}
