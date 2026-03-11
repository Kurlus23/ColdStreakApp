import { format } from "date-fns";
import { Snowflake, Clock, Trash2, Heart, MapPin, Share2, Flame, Download, Pencil, Check, X } from "lucide-react";
import { type Plunge, type UserLocation } from "@shared/schema";
import { PASSPORT_LOCATIONS } from "@/lib/passport";
import { useDeletePlunge, useUpdatePlunge } from "@/hooks/use-plunges";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getPhoto, deletePhoto } from "@/lib/photoStore";
import { buildShareImage } from "@/lib/shareImage";

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
  homeLabel?: string;
  communityLocs?: UserLocation[];
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
  locationId,
}: {
  username?: string;
  temperature: number;
  duration: number;
  streak?: number;
  locationName?: string | null;
  locationId?: string | null;
}): string {
  const name = username?.trim() || "I";
  const verb = name === "I" ? "just completed" : "just completed";
  const lines: string[] = [
    `${name} ${verb} a ${temperature}°F plunge! 🧊`,
    `⏱️ Duration: ${formatTime(duration)}`,
  ];
  if (streak && streak > 0) lines.push(`🔥 Streak: ${streak} day${streak === 1 ? "" : "s"}`);
  if (locationId === "home") lines.push(`📍 Home`);
  else if (locationName) lines.push(`📍 ${locationName}`);
  lines.push(`\nTracked with ColdStreak`);
  return lines.join("\n");
}

function resolveLocationDisplay(locId: string | null | undefined, locName: string | null | undefined, communityLocs: UserLocation[], homeLabel?: string) {
  if (locId === "home") return { label: homeLabel || "Home", icon: "🏠" };
  if (locId?.startsWith("community-")) {
    const id = Number(locId.replace("community-", ""));
    const cl = communityLocs.find((l) => l.id === id);
    return { label: cl?.name ?? locName ?? "", icon: null };
  }
  if (locId) {
    const pl = PASSPORT_LOCATIONS.find((l) => l.id === locId);
    if (pl) return { label: pl.name, icon: pl.flag };
  }
  if (locName) return { label: locName, icon: null };
  return null;
}

export function PlungeCard({ plunge, bodyWeightLbs = 154, username, streak, homeLabel, communityLocs = [] }: PlungeCardProps) {
  const deletePlunge = useDeletePlunge();
  const updatePlunge = useUpdatePlunge();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  // Edit location state
  const [editing, setEditing] = useState(false);
  const [editSel, setEditSel] = useState<string>("");
  const [editCustom, setEditCustom] = useState("");

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

  const handleSaveToDevice = async () => {
    if (!photoSrc) return;
    try {
      const res = await fetch(photoSrc);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coldstreak-${plunge.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ title: "Could not save photo", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const text = buildShareText({
      username,
      temperature: plunge.temperature,
      duration: plunge.duration,
      streak,
      locationName: plunge.locationName,
      locationId: plunge.locationId,
    });

    if (navigator.share) {
      if (photoSrc) {
        try {
          const composited = await buildShareImage({
            photoDataUrl: photoSrc,
            temperature: plunge.temperature,
            duration: plunge.duration,
            streak,
            locationName: plunge.locationName,
            locationId: plunge.locationId,
          });
          const file = await dataUrlToFile(composited, `coldstreak-plunge.jpg`);
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

  const openEdit = () => {
    // Pre-populate selector from current plunge
    if (plunge.locationId === "home") {
      setEditSel("home");
      setEditCustom("");
    } else if (plunge.locationId?.startsWith("community-")) {
      setEditSel(plunge.locationId);
      setEditCustom("");
    } else if (plunge.locationId) {
      setEditSel(plunge.locationId);
      setEditCustom("");
    } else if (plunge.locationName) {
      setEditSel("custom");
      setEditCustom(plunge.locationName);
    } else {
      setEditSel("");
      setEditCustom("");
    }
    setEditing(true);
  };

  const handleSaveLocation = () => {
    let locationId: string | null = null;
    let locationName: string | null = null;

    if (editSel === "home") {
      locationId = "home";
      locationName = homeLabel || "Home";
    } else if (editSel === "custom") {
      locationId = null;
      locationName = editCustom.trim() || null;
    } else if (editSel === "") {
      locationId = null;
      locationName = null;
    } else if (editSel.startsWith("community-")) {
      locationId = editSel;
      const cid = Number(editSel.replace("community-", ""));
      locationName = communityLocs.find((l) => l.id === cid)?.name ?? null;
    } else {
      // Passport location
      locationId = editSel;
      locationName = PASSPORT_LOCATIONS.find((l) => l.id === editSel)?.name ?? null;
    }

    updatePlunge.mutate(
      { id: plunge.id, patch: { locationId, locationName } },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ title: "Location updated" });
        },
        onError: () => {
          toast({ title: "Failed to update location", variant: "destructive" });
        },
      }
    );
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
          {/* Left: photo thumbnail + icon + time + date */}
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

          {/* Right: temp + score + share + edit + delete */}
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
                data-testid={`button-edit-plunge-${plunge.id}`}
                onClick={() => editing ? setEditing(false) : openEdit()}
                title="Edit location"
                className={`p-2 rounded-xl border transition-all duration-200 active:scale-95 ${
                  editing
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                    : "text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 border-transparent hover:border-cyan-500/20"
                }`}
              >
                <Pencil className="w-4 h-4" />
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
        {!editing && (plunge.locationName || plunge.locationId === "home") && (
          <div
            data-testid={`location-${plunge.id}`}
            className="relative z-10 mt-2 flex items-center gap-2 text-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {plunge.locationId === "home" ? (
              <span className="text-base leading-none">🏠</span>
            ) : passportLocation ? (
              <span className="text-base leading-none">{passportLocation.flag}</span>
            ) : null}
            <span className="text-cyan-300 font-medium truncate">
              {plunge.locationId === "home" ? (homeLabel || "Home") : plunge.locationName}
            </span>
            {passportLocation && (
              <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                Passport
              </span>
            )}
          </div>
        )}

        {/* Inline location editor */}
        {editing && (
          <div className="relative z-10 mt-3 bg-slate-900/60 border border-cyan-500/30 rounded-xl p-3 space-y-2">
            <div className="text-cyan-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Edit Location
            </div>

            <select
              data-testid={`select-edit-location-${plunge.id}`}
              value={editSel}
              onChange={(e) => { setEditSel(e.target.value); setEditCustom(""); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 appearance-none"
            >
              <option value="">— No location —</option>
              <option value="home">🏠 Home</option>
              {communityLocs.length > 0 && (
                <>
                  <option disabled>──── Community ────</option>
                  {communityLocs.map((l) => (
                    <option key={`community-${l.id}`} value={`community-${l.id}`}>{l.name}</option>
                  ))}
                </>
              )}
              <option disabled>──── Passport Spots ────</option>
              {PASSPORT_LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>{l.flag} {l.name} · {l.state}</option>
              ))}
              <option value="custom">✏️ Custom…</option>
            </select>

            {editSel === "custom" && (
              <input
                data-testid={`input-edit-location-custom-${plunge.id}`}
                type="text"
                value={editCustom}
                onChange={(e) => setEditCustom(e.target.value)}
                placeholder="Enter location name…"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            )}

            <div className="flex gap-2 pt-1">
              <button
                data-testid={`button-save-location-${plunge.id}`}
                onClick={handleSaveLocation}
                disabled={updatePlunge.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                data-testid={`button-cancel-location-${plunge.id}`}
                onClick={() => setEditing(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700/60 border border-slate-600/50 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
