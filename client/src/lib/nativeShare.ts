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
}: {
  title: string;
  text: string;
  photoBlob?: Blob | null;
  photoFilename?: string;
}): Promise<"shared" | "cancelled" | "error"> {
  try {
    if (photoBlob) {
      const uri = await writeTempImage(photoBlob, photoFilename);
      if (uri) {
        await Share.share({ title, files: [uri], dialogTitle: title });
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
