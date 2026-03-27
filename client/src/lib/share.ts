import { isNative, nativeShare } from "./nativeShare";

export async function shareContent({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}): Promise<void> {
  const combined = `${text}\n${url}`;

  if (isNative()) {
    await nativeShare({ title, text: combined });
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ text: combined });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(combined);
  } catch { /* ignore */ }
}
