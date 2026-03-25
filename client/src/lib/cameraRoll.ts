/**
 * cameraRoll.ts
 *
 * Saves plunge photos to the device camera roll and embeds plunge metadata
 * in the JPEG EXIF ImageDescription field so history can be recovered from
 * the photo library if the app's local data is ever lost.
 *
 * Tag format stored in ImageDescription:
 *   "COLDSTREAK:<base64-encoded-JSON>"
 */
import { Capacitor } from "@capacitor/core";
import piexif from "piexifjs";

const TAG_PREFIX = "COLDSTREAK:";

export interface PlungePhotoMeta {
  v: 1;
  id: number;
  duration: number;
  temp: number;
  score?: number;
  date: string;
  userId?: number;
  locationName?: string;
  locationId?: string;
  streak?: number;
}

// ── EXIF helpers ─────────────────────────────────────────────────────────────

/** Injects plunge metadata into a JPEG data-URL's EXIF and returns the new data-URL. */
function embedMeta(jpegDataUrl: string, meta: PlungePhotoMeta): string {
  try {
    const payload = TAG_PREFIX + btoa(JSON.stringify(meta));
    const exifDict: piexif.ExifDict = {
      "0th": {
        [piexif.ImageIFD.ImageDescription]: payload,
        [piexif.ImageIFD.Software]: "ColdStreak",
      },
      Exif: {},
      GPS: {},
      Interop: {},
      "1st": {},
    };
    const exifStr = piexif.dump(exifDict);
    return piexif.insert(exifStr, jpegDataUrl);
  } catch {
    // If EXIF injection fails (e.g. PNG), return original
    return jpegDataUrl;
  }
}

/** Reads plunge metadata from a JPEG data-URL. Returns null if not a tagged photo. */
export function readPlungeMetaFromPhoto(jpegDataUrl: string): PlungePhotoMeta | null {
  try {
    const exifObj = piexif.load(jpegDataUrl);
    const desc: string | undefined = exifObj?.["0th"]?.[piexif.ImageIFD.ImageDescription];
    if (!desc || !desc.startsWith(TAG_PREFIX)) return null;
    const json = atob(desc.slice(TAG_PREFIX.length));
    return JSON.parse(json) as PlungePhotoMeta;
  } catch {
    return null;
  }
}

// ── Camera-roll save ─────────────────────────────────────────────────────────

async function getColdStreakAlbumId(): Promise<string | undefined> {
  try {
    const { Media } = await import("@capacitor-community/media");
    const { albums } = await Media.getAlbums();
    const existing = albums.find((a) => a.name === "ColdStreak");
    if (existing) return existing.identifier;
    await Media.createAlbum({ name: "ColdStreak" });
    const { albums: updated } = await Media.getAlbums();
    return updated.find((a) => a.name === "ColdStreak")?.identifier;
  } catch {
    return undefined;
  }
}

/**
 * Embeds plunge metadata into the photo's EXIF and saves it to the device
 * camera roll under a "ColdStreak" album. Silent no-op on web.
 */
export async function tagAndSaveToRoll(
  jpegDataUrl: string,
  meta: PlungePhotoMeta,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Media } = await import("@capacitor-community/media");
    const tagged = embedMeta(jpegDataUrl, meta);
    const albumIdentifier = await getColdStreakAlbumId();
    await Media.savePhoto({ path: tagged, albumIdentifier });
  } catch (e) {
    // Non-fatal — app continues even if camera roll save fails
    console.warn("[cameraRoll] save failed:", e);
  }
}
