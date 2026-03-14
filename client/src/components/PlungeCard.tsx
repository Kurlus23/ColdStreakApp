import { format } from "date-fns";
import { Clock, Trash2, Heart, MapPin, Share2, Flame, Download, Pencil, Check, X, Thermometer } from "lucide-react";
import { type Plunge, type UserLocation } from "@shared/schema";
import { PASSPORT_LOCATIONS } from "@/lib/passport";
import { useDeletePlunge, useUpdatePlunge } from "@/hooks/use-plunges";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getPhoto, deletePhoto } from "@/lib/photoStore";
import { buildShareImage } from "@/lib/shareImage";
import { InterstitialAd } from "@/components/AdUnit";

function estimateCalories(durationSeconds: number, tempF: number, weightLbs: number): number {
  const durationMin = durationSeconds / 60;
  const tempC = (tempF - 32) * 5 / 9;
  const deltaT = Math.max(0, 37 - tempC);
  const weightKg = weightLbs / 2.205;
  return Math.max(0, durationMin * deltaT * weightKg * 0.0077);
}

function calcScore(durationSeconds: number, tempF: number): number {
  const minutes = durationSeconds / 60;
  let coldFactor = 1;
  if (tempF <= 55) coldFactor = 1.2;
  if (tempF <= 50) coldFactor = 1.5;
  if (tempF <= 45) coldFactor = 1.9;
  if (tempF <= 40) coldFactor = 2.5;
  if (tempF <= 35) coldFactor = 3.2;
  return Math.round(Math.sqrt(minutes) * coldFactor * 10) / 10;
}

interface PlungeCardProps {
  plunge: Plunge;
  bodyWeightLbs?: number;
  username?: string;
  streak?: number;
  homeLabel?: string;
  communityLocs?: UserLocation[];
  isPro?: boolean;
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
  lines.push(`\nTracked with ColdStreak → https://coldstreakapp.com`);
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

export function PlungeCard({ plunge, bodyWeightLbs = 154, username, streak, homeLabel, communityLocs = [], isPro = false }: PlungeCardProps) {
  const deletePlunge = useDeletePlunge();
  const updatePlunge = useUpdatePlunge();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editSel, setEditSel] = useState<string>("");
  const [editCustom, setEditCustom] = useState("");
  const [editMins, setEditMins] = useState(0);
  const [editSecs, setEditSecs] = useState(0);
  const [editTemp, setEditTemp] = useState(50);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Ad gate: pending action fires after user dismisses interstitial
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const withAdGate = (action: () => Promise<void>) => {
    if (isPro) { action(); return; }
    setPendingAction(() => action);
  };

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

  const downloadBlob = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const filename = `coldstreak-${plunge.id}.jpg`;
    const file = new File([blob], filename, { type: "image/jpeg" });

    // On mobile, use native share sheet (has "Save Image" / "Save to Photos")
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ColdStreak" });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return; // user cancelled — don't fall through
      }
    }

    // Desktop fallback: anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveToDevice = async () => {
    if (!photoSrc) return;
    try {
      await downloadBlob(photoSrc);
    } catch {
      toast({ title: "Could not save photo", variant: "destructive" });
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSaveWithOverlay = async () => {
    if (!photoSrc) return;
    setSaving(true);
    try {
      const composited = await buildShareImage({
        photoDataUrl: photoSrc,
        temperature: plunge.temperature,
        duration: plunge.duration,
        streak,
        locationName: plunge.locationName,
        locationId: plunge.locationId,
      });
      await downloadBlob(composited);
    } catch {
      toast({ title: "Could not save photo", variant: "destructive" });
    } finally {
      setSaving(false);
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
    // Duration
    setEditMins(Math.floor(plunge.duration / 60));
    setEditSecs(plunge.duration % 60);
    // Temperature
    setEditTemp(plunge.temperature);
    // Date & time
    const d = new Date(plunge.createdAt);
    setEditDate(d.toISOString().slice(0, 10));
    setEditTime(d.toTimeString().slice(0, 5));
    // Location
    if (plunge.locationId === "home") {
      setEditSel("home"); setEditCustom("");
    } else if (plunge.locationId?.startsWith("community-")) {
      setEditSel(plunge.locationId); setEditCustom("");
    } else if (plunge.locationId) {
      setEditSel(plunge.locationId); setEditCustom("");
    } else if (plunge.locationName) {
      setEditSel("custom"); setEditCustom(plunge.locationName);
    } else {
      setEditSel(""); setEditCustom("");
    }
    setEditing(true);
  };

  const handleSave = () => {
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
      locationId = editSel;
      locationName = PASSPORT_LOCATIONS.find((l) => l.id === editSel)?.name ?? null;
    }

    const duration = Math.max(1, editMins * 60 + editSecs);
    const temperature = Math.min(75, Math.max(32, editTemp));
    const score = String(calcScore(duration, temperature));
    const createdAt = new Date(`${editDate}T${editTime}:00`).toISOString();

    updatePlunge.mutate(
      { id: plunge.id, patch: { locationId, locationName, duration, temperature, score, createdAt } },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ title: "Plunge updated" });
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
              onClick={(e) => { e.stopPropagation(); withAdGate(handleSaveToDevice); }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all active:scale-95"
            >
              <Download className="w-4 h-4" /> Save
            </button>
            <button
              data-testid={`button-share-photo-${plunge.id}`}
              onClick={(e) => { e.stopPropagation(); withAdGate(handleShare); }}
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

        {/* Top row: location (left) + actions (right) */}
        <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
          {/* Location */}
          {!editing && (plunge.locationName || plunge.locationId === "home") ? (
            <div
              data-testid={`location-${plunge.id}`}
              className="flex items-center gap-1.5 text-sm min-w-0"
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
                <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0">
                  Passport
                </span>
              )}
            </div>
          ) : !editing ? (
            <div
              data-testid={`location-${plunge.id}`}
              className="flex items-center gap-1.5 text-sm min-w-0"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="text-slate-500 font-medium">Location Unknown</span>
            </div>
          ) : (
            <div />
          )}

          {/* Action buttons — icon only, right-aligned */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              data-testid={`button-share-plunge-${plunge.id}`}
              onClick={() => withAdGate(handleShare)}
              title="Share"
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {photoSrc && (
              <button
                data-testid={`button-save-overlay-${plunge.id}`}
                onClick={() => withAdGate(handleSaveWithOverlay)}
                disabled={saving}
                title="Save photo with stats"
                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-all active:scale-95 disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <button
              data-testid={`button-edit-plunge-${plunge.id}`}
              onClick={() => editing ? setEditing(false) : openEdit()}
              title="Edit location"
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                editing ? "text-cyan-400 bg-cyan-500/10" : "text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10"
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              data-testid={`button-delete-plunge-${plunge.id}`}
              onClick={handleDelete}
              disabled={deletePlunge.isPending}
              title={confirming ? "Tap again to confirm" : "Delete"}
              className={`p-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40 ${
                confirming ? "text-red-400 bg-red-500/10" : "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main info row */}
        <div className="relative z-10 flex items-center gap-3">
          {/* Text column: duration · date · stats */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-white font-bold text-base">{formatTime(plunge.duration)}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {format(new Date(plunge.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-sm font-semibold text-white">{plunge.temperature}<span className="text-cyan-400 text-xs">°F</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-cyan-300 font-semibold">Score {Number(plunge.score).toFixed(1)}</span>
              <span className="text-slate-600">·</span>
              <span
                title="Estimated thermogenic calorie burn. Varies by individual physiology — not a precise measurement."
                className="flex items-center gap-0.5 text-xs text-orange-400/80 cursor-help"
              >
                <Flame className="w-3 h-3" />~{calories} kcal est.
              </span>
            </div>
          </div>

          {/* Photo thumbnail — right side, only when available */}
          {photoSrc && (
            <button
              data-testid={`button-photo-${plunge.id}`}
              onClick={() => setPhotoExpanded(true)}
              className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-slate-600/50 hover:border-cyan-400/60 transition-all active:scale-95"
            >
              <img src={photoSrc} alt="Plunge" className="w-full h-full object-cover" />
            </button>
          )}
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

        {/* Inline full editor */}
        {editing && (
          <div className="relative z-10 mt-3 bg-slate-900/60 border border-cyan-500/30 rounded-xl p-3 space-y-3">
            <div className="text-cyan-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <Pencil className="w-3 h-3" /> Edit Plunge
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 text-[10px] uppercase tracking-wide block mb-1">Date</label>
                <input
                  data-testid={`input-edit-date-${plunge.id}`}
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-slate-400 text-[10px] uppercase tracking-wide block mb-1">Time</label>
                <input
                  data-testid={`input-edit-time-${plunge.id}`}
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-wide flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  data-testid={`input-edit-mins-${plunge.id}`}
                  type="number" min={0} max={59}
                  value={editMins}
                  onChange={(e) => setEditMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-cyan-400"
                />
                <span className="text-slate-400 text-sm">m</span>
                <input
                  data-testid={`input-edit-secs-${plunge.id}`}
                  type="number" min={0} max={59}
                  value={editSecs}
                  onChange={(e) => setEditSecs(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-cyan-400"
                />
                <span className="text-slate-400 text-sm">s</span>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-wide flex items-center gap-1 mb-1">
                <Thermometer className="w-3 h-3" /> Temperature (°F)
              </label>
              <select
                data-testid={`select-edit-temp-${plunge.id}`}
                value={editTemp}
                onChange={(e) => setEditTemp(Number(e.target.value))}
                className="w-28 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-400 appearance-none"
              >
                {Array.from({ length: 44 }, (_, i) => 32 + i).map((t) => (
                  <option key={t} value={t}>{t}°F</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-wide flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3" /> Location
              </label>
              <select
                data-testid={`select-edit-location-${plunge.id}`}
                value={editSel}
                onChange={(e) => { setEditSel(e.target.value); setEditCustom(""); }}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 appearance-none"
              >
                <option value="">— No location —</option>
                <option value="home">🏠 {homeLabel || "Home"}</option>
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
                  className="mt-2 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                data-testid={`button-save-plunge-${plunge.id}`}
                onClick={handleSave}
                disabled={updatePlunge.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                data-testid={`button-cancel-edit-${plunge.id}`}
                onClick={() => setEditing(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700/60 border border-slate-600/50 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ad gate interstitial — shows before Share / Save for free users */}
      {pendingAction && (
        <InterstitialAd
          adIndex={plunge.id % 3}
          onDismiss={() => {
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
        />
      )}
    </>
  );
}
