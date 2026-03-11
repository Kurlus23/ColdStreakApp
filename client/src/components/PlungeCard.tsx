import { format } from "date-fns";
import { Snowflake, Clock, Trash2, Heart, MapPin, Share2, Flame, Download } from "lucide-react";
import { type Plunge } from "@shared/schema";
import { PASSPORT_LOCATIONS } from "@/lib/passport";
import { useDeletePlunge } from "@/hooks/use-plunges";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getPhoto, deletePhoto } from "@/lib/photoStore";

function estimateCalories(durationSeconds: number, tempF: number, weightLbs: number): number {
  const durationMin = durationSeconds / 60;
  const tempC = (tempF - 32) * 5 / 9;
  const deltaT = Math.max(0, 37 - tempC);
  const weightKg = weightLbs / 2.205;
  return Math.max(0, durationMin * deltaT * weightKg * 0.0077);
}

interface PlungeCardProps {
  plunge: Plunge;
  bodyWeightLbs?: number;
  username?: string;
  streak?: number;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export function buildShareText({
  username,
  temperature,
  duration,
  streak,
  locationName,
}: {
  username?: string;
  temperature: number;
  duration: number;
  streak?: number;
  locationName?: string | null;
}): string {
  const name = username?.trim() || "I";
  const verb = name === "I" ? "just completed" : "just completed";
  const lines: string[] = [
    `${name} ${verb} a ${temperature}°F plunge! 🧊`,
    `⏱️ Duration: ${formatTime(duration)}`,
  ];
  if (streak && streak > 0) lines.push(`🔥 Streak: ${streak} day${streak === 1 ? "" : "s"}`);
  if (locationName) lines.push(`📍 ${locationName}`);
  lines.push(`\nTracked with ColdStreak`);
  return lines.join("\n");
}

export function PlungeCard({ plunge, bodyWeightLbs = 154, username, streak }: PlungeCardProps) {
  const deletePlunge = useDeletePlunge();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const calories = Math.round(estimateCalories(plunge.duration, plunge.temperature, bodyWeightLbs));

  useEffect(() => {
    getPhoto(plunge.id).then((p) => setLocalPhoto(p)).catch(() => {});
  }, [plunge.id]);

  const photoSrc = localPhoto ?? plunge.photoData ?? null;

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    deletePhoto(plunge.id).catch(() => {});
    deletePlunge.mutate(plunge.id);
  };

  const handleSaveToDevice = () => {
    if (!photoSrc) return;
    const a = document.createElement("a");
    a.href = photoSrc;
    a.download = `coldstreak-${plunge.id}.jpg`;
    a.click();
  };

  const handleShare = async () => {
    const text = buildShareText({
      username,
      temperature: plunge.temperature,
      duration: plunge.duration,
      streak,
      locationName: plunge.locationName,
    });

    if (navigator.share) {
      if (photoSrc) {
        try {
          const file = await dataUrlToFile(photoSrc, `coldstreak-plunge.jpg`);
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return;
          }
        } catch (e: any) {
          if (e?.name === "AbortError") return;
        }
      }
      try {
        await navigator.share({ title: "ColdStreak Plunge", text });
        return;
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          toast({ title: "Share failed", variant: "destructive" });
        }
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!", description: "Paste to share with friends." });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const hasVitals = plunge.hrAvg || plunge.spo2Avg;
  const passportLocation = plunge.locationId
    ? PASSPORT_LOCATIONS.find((l) => l.id === plunge.locationId)
    : null;

  return (
    <>
      {/* Expanded photo overlay */}
      {photoExpanded && photoSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPhotoExpanded(false)}
          data-testid="overlay-photo-expanded"
        >
          <img
            src={photoSrc}
            alt="Plunge photo"
            className="max-w-full max-h-full rounded-2xl object-contain"
          />
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white text-lg font-bold"
            onClick={() => setPhotoExpanded(false)}
          >✕</button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              data-testid={`button-save-to-device-${plunge.id}`}
              onClick={(e) => { e.stopPropagation(); handleSaveToDevice(); }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
            >
              <Download className="w-4 h-4" /> Save
            </button>
            <button
              data-testid={`button-share-photo-${plunge.id}`}
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="flex items-center gap-2 bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/40 text-cyan-200 text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
      )}

      <div
        data-testid={`card-plunge-${plunge.id}`}
        className="group relative overflow-hidden bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-all duration-300"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          {/* Left: photo thumbnail (if any) + icon + time + date */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {photoSrc ? (
              <button
                data-testid={`button-photo-${plunge.id}`}
                onClick={() => setPhotoExpanded(true)}
                className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-slate-600/50 hover:border-cyan-400/60 transition-all active:scale-95"
              >
                <img src={photoSrc} alt="Plunge" className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="shrink-0 bg-slate-900/80 p-3 rounded-xl shadow-inner border border-slate-700/50 text-cyan-400 group-hover:text-cyan-300 transition-colors group-hover:scale-110 duration-300">
                <Snowflake className="w-6 h-6" strokeWidth={2} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white font-semibold text-lg">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                {formatTime(plunge.duration)}
              </div>
              <div className="text-sm text-slate-400 mt-0.5">
                {format(new Date(plunge.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </div>

          {/* Right: temp + score + share + delete */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="flex items-start justify-end gap-1">
                <span className="text-2xl font-bold text-white">{plunge.temperature}</span>
                <span className="text-cyan-400 font-bold mt-1">°F</span>
              </div>
              <div className="text-sm bg-slate-900/60 px-3 py-1 rounded-lg border border-cyan-500/30 mt-1">
                <span className="text-cyan-300 font-semibold">Score: </span>
                <span className="text-white font-bold">{Number(plunge.score).toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-orange-400/90 mt-1 justify-end">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>~{calories} kcal</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <button
                data-testid={`button-share-plunge-${plunge.id}`}
                onClick={handleShare}
                title="Share this plunge"
                className="p-2 rounded-xl text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-200 active:scale-95"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                data-testid={`button-delete-plunge-${plunge.id}`}
                onClick={handleDelete}
                disabled={deletePlunge.isPending}
                title={confirming ? "Click again to confirm delete" : "Delete plunge"}
                className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-40 active:scale-95 ${
                  confirming
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Vitals row */}
        {hasVitals && (
          <div className="relative z-10 mt-3 flex items-center gap-4 bg-slate-900/50 border border-slate-700/40 rounded-xl px-4 py-2">
            {plunge.hrAvg && (
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span className="text-white text-sm font-semibold">{plunge.hrAvg}</span>
                <span className="text-slate-400 text-xs">bpm</span>
              </div>
            )}
            {plunge.hrAvg && plunge.spo2Avg && <div className="w-px h-3 bg-slate-600" />}
            {plunge.spo2Avg && (
              <div className="flex items-center gap-1.5">
                <span className="text-blue-400 text-xs font-bold">O₂</span>
                <span className="text-white text-sm font-semibold">{plunge.spo2Avg}%</span>
              </div>
            )}
          </div>
        )}

        {/* Location row */}
        {plunge.locationName && (
          <div
            data-testid={`location-${plunge.id}`}
            className="relative z-10 mt-2 flex items-center gap-2 text-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {passportLocation && (
              <span className="text-base leading-none">{passportLocation.flag}</span>
            )}
            <span className="text-cyan-300 font-medium truncate">{plunge.locationName}</span>
            {passportLocation && (
              <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                Passport
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
