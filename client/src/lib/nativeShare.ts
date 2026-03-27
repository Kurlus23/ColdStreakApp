import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Clipboard } from "@capacitor/clipboard";

export const isNative = () => Capacitor.isNativePlatform();

async function writeTempImage(blob: Blob, filename: string): Promise<string | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    return result.uri;
  } catch {
    return null;
  }
}

async function writeToClipboard(text: string): Promise<boolean> {
  // Try native Capacitor clipboard first (reliable in WebViews)
  try {
    await Clipboard.write({ string: text });
    return true;
  } catch { /* fall through */ }
  // Web clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* not available */ }
  return false;
}

export async function nativeShare({
  title = "ColdStreak Plunge",
  text,
  url,
  photoBlob,
  photoFilename = "coldstreak-plunge.jpg",
  onCaptionCopied,
}: {
  title?: string;
  text?: string;
  url?: string;
  photoBlob?: Blob | null;
  photoFilename?: string;
  onCaptionCopied?: () => void;
}): Promise<"shared" | "cancelled" | "error"> {
  try {
    if (photoBlob) {
      const uri = await writeTempImage(photoBlob, photoFilename);
      if (uri) {
        // Copy caption to clipboard — always notify so user knows to paste it
        await writeToClipboard(text);
        onCaptionCopied?.();
        // dialogTitle only used by Android share sheet, not included in message body
        await Share.share({ text, files: [uri], dialogTitle: title });
        return "shared";
      }
    }
    // Always consolidate into a single `text` field on native iOS —
    // passing `url` as a separate field causes iMessage to render two bubbles
    // (one for the URL text and one for the link preview card)
    const shareText = text && url ? `${text}\n${url}` : (text || url || "");
    await Share.share({ text: shareText });
    return "shared";
  } catch (e: any) {
    if (e?.message?.includes("cancel") || e?.errorMessage?.includes("cancel")) {
      return "cancelled";
    }
    return "error";
  }
}
