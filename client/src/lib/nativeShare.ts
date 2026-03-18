import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

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

export async function nativeShare({
  title,
  text,
  photoBlob,
  photoFilename = "coldstreak-plunge.jpg",
  onCaptionCopied,
}: {
  title: string;
  text: string;
  photoBlob?: Blob | null;
  photoFilename?: string;
  onCaptionCopied?: () => void;
}): Promise<"shared" | "cancelled" | "error"> {
  try {
    if (photoBlob) {
      const uri = await writeTempImage(photoBlob, photoFilename);
      if (uri) {
        // Copy caption to clipboard before opening share sheet so the user
        // can paste it in apps like Messenger that drop text on image intents.
        try {
          await navigator.clipboard.writeText(text);
          onCaptionCopied?.();
        } catch { /* clipboard not available — proceed silently */ }
        await Share.share({ title, text, files: [uri], dialogTitle: title });
        return "shared";
      }
    }
    await Share.share({ title, text, dialogTitle: title });
    return "shared";
  } catch (e: any) {
    if (e?.message?.includes("cancel") || e?.errorMessage?.includes("cancel")) {
      return "cancelled";
    }
    return "error";
  }
}
