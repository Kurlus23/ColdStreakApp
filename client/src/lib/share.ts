import { isNative, nativeShare } from "./nativeShare";

export async function shareContent({
  title,
  text,
}: {
  title: string;
  text: string;
}): Promise<void> {
  if (isNative()) {
    await nativeShare({ title, text });
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch { /* ignore */ }
}
