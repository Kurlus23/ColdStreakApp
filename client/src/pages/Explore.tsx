import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin, Compass, Search, X, ChevronDown, Lock,
  Trophy, Flame, Navigation, Star, Plus, Send, Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProStatus } from "@/hooks/use-pro-status";
import { PASSPORT_LOCATIONS, usePassportBadges, distanceMiles } from "@/lib/passport";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserLocation } from "@shared/schema";

const NOMINATIONS_KEY = "coldstreak-nominations";
const NEARBY_MILES = 50;

function getNominated(): Set<number> {
  try {
    const s = localStorage.getItem(NOMINATIONS_KEY);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
}
function saveNominated(s: Set<number>) {
  localStorage.setItem(NOMINATIONS_KEY, JSON.stringify([...s]));
}

const ALL_COUNTRIES = ["All", "Iceland", "Norway", "Switzerland", "Australia", "Russia", "USA"];

interface GeoPos { lat: number; lng: number; }

export function Explore({ username, onClose, onUpgrade }: { username: string; onClose: () => void; onUpgrade: () => void }) {
  const { toast } = useToast();
  const { isPro } = useProStatus();
  const { badges, awardBadge, hasBadge } = usePassportBadges();

  // ── Shared filter state ──
  const [geoPos, setGeoPos] = useState<GeoPos | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [countryFilter, setCountryFilter] = useState("All");
  const [searchText, setSearchText] = useState("");

  // ── Tile open/close state ──
  const [passportOpen, setPassportOpen] = useState(true);
  const [communityOpen, setCommunityOpen] = useState(true);

  // ── Community submission form ──
  const [showForm, setShowForm] = useState(false);
  const [nominated, setNominated] = useState<Set<number>>(getNominated);
  const [locationIdDetail, setLocationIdDetail] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", country: "USA", state: "", city: "", description: "",
  });
  const [formGeoPos, setFormGeoPos] = useState<GeoPos | null>(null);
  const [formGeoLoading, setFormGeoLoading] = useState(false);

  const COUNTRY_MAP: Record<string, string> = {
    "united states": "USA", "us": "USA", "usa": "USA",
    "iceland": "Iceland", "norway": "Norway", "switzerland": "Switzerland",
    "australia": "Australia", "russia": "Russia", "canada": "Canada",
    "united kingdom": "UK", "germany": "Germany", "japan": "Japan",
  };

  const requestFormGeo = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not available", description: "Your device doesn't support location.", variant: "destructive" });
      return;
    }
    setFormGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Resolve GPS immediately — don't block on reverse geocode
        setFormGeoPos({ lat, lng });
        setFormGeoLoading(false);
        toast({ title: "GPS attached", description: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });

        // Reverse geocode in background (best-effort, 5 s timeout)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
          { headers: { "Accept-Language": "en" }, signal: controller.signal }
        )
          .then((r) => r.json())
          .then((data) => {
            clearTimeout(timer);
            const addr = data.address ?? {};
            const city = addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? "";
            const state = addr.state ?? addr.county ?? "";
            const countryRaw = (addr.country ?? "").toLowerCase();
            const country = COUNTRY_MAP[countryRaw] ?? addr.country ?? "";
            setForm((f) => ({
              ...f,
              city: city || f.city,
              state: state || f.state,
              country: country || f.country,
            }));
          })
          .catch(() => clearTimeout(timer));
      },
      (err) => {
        setFormGeoLoading(false);
        toast({ title: "Location denied", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [toast]);

  // ── GPS ──
  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not available", description: "Your device doesn't support location.", variant: "destructive" });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearbyOnly(true);
        setGeoLoading(false);
        toast({ title: "Location found", description: `Showing spots within ${NEARBY_MILES} miles.` });
      },
      (err) => {
        setGeoLoading(false);
        toast({ title: "Location denied", description: err.message, variant: "destructive" });
      }
    );
  }, [toast]);

  const toggleNearby = useCallback(() => {
    if (!geoPos && !nearbyOnly) { requestGeo(); return; }
    setNearbyOnly((v) => !v);
  }, [geoPos, nearbyOnly, requestGeo]);

  // ── Community locations query ──
  const { data: communityLocs = [] } = useQuery<UserLocation[]>({
    queryKey: ["/api/community-locations"],
    queryFn: () => fetch("/api/community-locations").then((r) => r.json()),
  });

  // ── Submit community location ──
  const submitMutation = useMutation({
    mutationFn: async (data: typeof form & { submittedBy: string; latitude?: number; longitude?: number }) =>
      apiRequest("POST", "/api/community-locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setShowForm(false);
      setForm({ name: "", country: "USA", state: "", city: "", description: "" });
      setFormGeoPos(null);
      toast({ title: "Location submitted!", description: "Thanks — your spot is now visible to the community." });
    },
    onError: () => toast({ title: "Submit failed", variant: "destructive" }),
  });

  const nominateMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/community-locations/${id}/nominate`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (_, id) => {
      const next = new Set(nominated);
      next.add(id);
      setNominated(next);
      saveNominated(next);
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      toast({ title: "Vote counted!" });
    },
  });

  // ── Filter helpers ──
  function matchesText(tokens: (string | undefined | null)[]): boolean {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return tokens.some((t) => t?.toLowerCase().includes(q));
  }

  function withinRange(lat: number, lng: number): boolean {
    if (!nearbyOnly || !geoPos) return true;
    return distanceMiles(geoPos.lat, geoPos.lng, lat, lng) <= NEARBY_MILES;
  }

  function distLabel(lat: number, lng: number): string | null {
    if (!geoPos) return null;
    const d = distanceMiles(geoPos.lat, geoPos.lng, lat, lng);
    return d < 1 ? "< 1 mi" : `${d.toFixed(0)} mi`;
  }

  // ── Filtered Passport locations ──
  const passportFiltered = PASSPORT_LOCATIONS.filter((loc) => {
    if (countryFilter !== "All" && loc.country !== countryFilter) return false;
    if (!matchesText([loc.name, loc.country, loc.state, loc.description])) return false;
    if (!withinRange(loc.lat, loc.lng)) return false;
    return true;
  });

  // ── Filtered Community locations ──
  const communityFiltered = communityLocs.filter((loc) => {
    if (countryFilter !== "All" && loc.country !== countryFilter) return false;
    if (!matchesText([loc.name, loc.country, loc.state, loc.city, loc.description])) return false;
    const lat = loc.latitude ? Number(loc.latitude) : null;
    const lng = loc.longitude ? Number(loc.longitude) : null;
    if (lat !== null && lng !== null) {
      if (!withinRange(lat, lng)) return false;
    } else if (nearbyOnly) {
      return false;
    }
    return true;
  }).sort((a, b) => b.nominationCount - a.nominationCount);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" }); return;
    }
    submitMutation.mutate({
      ...form,
      submittedBy: username,
      ...(formGeoPos ? { latitude: formGeoPos.lat, longitude: formGeoPos.lng } : {}),
    });
  };

  const passportDetail = locationIdDetail
    ? PASSPORT_LOCATIONS.find((l) => l.id === locationIdDetail) ?? null
    : null;

  return (
    <div className="px-4 pb-28 pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Explore</h2>
        <button
          data-testid="button-close-explore"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-600/50 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-95 text-lg font-bold"
        >✕</button>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-blue-900/50 border border-blue-700/40 rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Near Me toggle */}
          <button
            data-testid="button-toggle-nearby"
            onClick={toggleNearby}
            disabled={geoLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              nearbyOnly
                ? "bg-cyan-500/30 border-cyan-500/60 text-cyan-300"
                : "bg-blue-800/60 border-blue-700/40 text-blue-300 hover:text-white"
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 ${geoLoading ? "animate-pulse" : ""}`} />
            {geoLoading ? "Locating…" : nearbyOnly ? `Within ${NEARBY_MILES} mi` : "Near Me"}
          </button>
          {nearbyOnly && (
            <button
              data-testid="button-clear-nearby"
              onClick={() => { setNearbyOnly(false); setGeoPos(null); }}
              className="p-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-700/60 transition-all"
            >
              <X className="w-3.5 h-3.5 text-blue-400" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {/* Country filter */}
          <select
            data-testid="select-explore-country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="flex-none bg-blue-800/60 border border-blue-700/40 text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
          >
            {ALL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Text search */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
            <input
              data-testid="input-explore-search"
              type="text"
              placeholder="State, city, zip, or keyword…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-blue-800/60 border border-blue-700/40 text-white text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none placeholder-blue-500"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-blue-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Community Spots Tile (Pro) ── */}
      <div className="bg-gradient-to-br from-blue-900/70 to-blue-950/80 border border-blue-700/50 rounded-2xl overflow-hidden">
        <button
          data-testid="button-toggle-community"
          onClick={() => isPro ? setCommunityOpen((v) => !v) : onUpgrade()}
          className="w-full flex items-center gap-3 px-4 py-3.5"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40">
            <MapPin className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-white font-bold text-sm">Community Spots</div>
            <div className="text-blue-400 text-[11px]">
              {isPro ? "Crowd-sourced cold plunge destinations" : "Pro — discover & submit spots"}
            </div>
          </div>
          {isPro ? (
            <span className="text-xs text-blue-400 font-semibold">{communityFiltered.length} spots</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold mr-1">
              <Lock className="w-3 h-3" /> Pro
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${communityOpen && isPro ? "rotate-180" : ""}`} />
        </button>

        {communityOpen && isPro && (
          <div className="px-3 pb-3 space-y-2">
            {/* Submit button */}
            <button
              data-testid="button-add-location"
              onClick={() => setShowForm((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Suggest a Spot
            </button>

            {/* Submission form */}
            {showForm && (
              <div className="bg-blue-950/80 border border-blue-700/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-semibold text-xs">New Spot</p>
                  <button
                    data-testid="button-form-use-location"
                    type="button"
                    onClick={requestFormGeo}
                    disabled={formGeoLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all active:scale-95 ${
                      formGeoPos
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                        : "bg-blue-800/60 border-blue-700/40 text-blue-300 hover:text-white"
                    }`}
                  >
                    <Navigation className={`w-3 h-3 ${formGeoLoading ? "animate-pulse" : ""}`} />
                    {formGeoLoading ? "Locating…" : formGeoPos ? "GPS attached" : "Use my location"}
                  </button>
                </div>
                {formGeoPos && (
                  <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-2.5 py-1.5">
                    <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="text-cyan-300 text-[11px] font-mono">
                      {formGeoPos.lat.toFixed(5)}, {formGeoPos.lng.toFixed(5)}
                    </span>
                    <button onClick={() => setFormGeoPos(null)} className="ml-auto" data-testid="button-clear-form-geo">
                      <X className="w-3 h-3 text-cyan-500 hover:text-cyan-300" />
                    </button>
                  </div>
                )}
                <input
                  data-testid="input-location-name"
                  type="text"
                  placeholder="Location name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none placeholder-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    data-testid="select-location-country"
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-2 py-2 focus:outline-none"
                  >
                    {["USA","Iceland","Norway","Switzerland","Australia","Russia","Canada","UK","Germany","Japan","Other"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    data-testid="input-location-state"
                    type="text"
                    placeholder="State / Region"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none placeholder-blue-500"
                  />
                </div>
                <input
                  data-testid="input-location-city"
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none placeholder-blue-500"
                />
                <textarea
                  data-testid="input-location-description"
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2 focus:outline-none placeholder-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    data-testid="button-submit-location"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    {submitMutation.isPending ? "Saving…" : "Submit"}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setFormGeoPos(null); }}
                    className="px-3 py-2 rounded-xl bg-blue-800/60 text-blue-400 text-xs hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Community location cards */}
            {communityFiltered.length === 0 ? (
              <div className="text-center py-6 text-blue-400 text-sm">
                {nearbyOnly ? `No community spots within ${NEARBY_MILES} miles.` : "No spots yet — be the first to suggest one!"}
              </div>
            ) : (
              <div className="space-y-2">
                {communityFiltered.map((loc) => {
                  const hasVoted = nominated.has(loc.id);
                  const progress = Math.min((loc.nominationCount / 25) * 100, 100);
                  const isReview = loc.nominationCount >= 25;
                  const lat = loc.latitude ? Number(loc.latitude) : null;
                  const lng = loc.longitude ? Number(loc.longitude) : null;
                  const dist = lat !== null && lng !== null ? distLabel(lat, lng) : null;
                  return (
                    <div
                      key={loc.id}
                      data-testid={`card-community-${loc.id}`}
                      className="bg-blue-900/40 border border-blue-700/30 rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-sm font-semibold truncate">{loc.name}</span>
                            {isReview && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                          </div>
                          <div className="text-[11px] text-blue-400 mt-0.5">
                            {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                          </div>
                          {loc.description && (
                            <p className="text-blue-300 text-[11px] mt-1 leading-relaxed line-clamp-2">{loc.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {dist && <span className="text-[11px] text-cyan-400 font-semibold">{dist}</span>}
                          <button
                            data-testid={`button-vote-${loc.id}`}
                            onClick={() => !hasVoted && nominateMutation.mutate(loc.id)}
                            disabled={hasVoted || nominateMutation.isPending}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                              hasVoted
                                ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 cursor-default"
                                : "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30"
                            }`}
                          >
                            <Trophy className="w-3 h-3" />
                            {hasVoted ? "Voted" : "Vote"}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-blue-500 mb-1">
                          <span>{isReview ? "🔥 Under review" : `${loc.nominationCount} / 25 votes`}</span>
                        </div>
                        <div className="h-1 bg-blue-800/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isReview ? "bg-orange-400" : "bg-indigo-500"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Plunge Passport Tile (Pro) ── */}
      <div className="bg-gradient-to-br from-blue-900/70 to-blue-950/80 border border-blue-700/50 rounded-2xl overflow-hidden">
        <button
          data-testid="button-toggle-passport"
          onClick={() => isPro ? setPassportOpen((v) => !v) : onUpgrade()}
          className="w-full flex items-center gap-3 px-4 py-3.5"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40">
            <Star className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-white font-bold text-sm">Plunge Passport</div>
            <div className="text-blue-400 text-[11px]">
              {isPro ? `${badges.size} / ${PASSPORT_LOCATIONS.length} earned` : "Pro — curated bucket-list spots"}
            </div>
          </div>
          {isPro ? (
            <span className="text-xs text-cyan-400 font-bold">{passportFiltered.length} shown</span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold mr-1">
              <Lock className="w-3 h-3" /> Pro
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${passportOpen && isPro ? "rotate-180" : ""}`} />
        </button>

        {passportOpen && isPro && (
          <div className="px-3 pb-3">
            {passportFiltered.length === 0 ? (
              <div className="text-center py-6 text-blue-400 text-sm">No locations match your filters.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {passportFiltered.map((loc) => {
                  const earned = hasBadge(loc.id);
                  const dist = distLabel(loc.lat, loc.lng);
                  const isOpen = locationIdDetail === loc.id;
                  return (
                    <div
                      key={loc.id}
                      data-testid={`card-passport-${loc.id}`}
                      className={`rounded-xl border transition-all ${earned ? "bg-cyan-500/10 border-cyan-500/40" : "bg-blue-900/40 border-blue-700/40"}`}
                    >
                      <button
                        onClick={() => setLocationIdDetail(isOpen ? null : loc.id)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                      >
                        <div className="text-2xl">{loc.flag}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-semibold truncate ${earned ? "text-cyan-200" : "text-white"}`}>{loc.name}</span>
                            {earned && <span className="text-xs text-cyan-400 font-bold">✓</span>}
                          </div>
                          <div className="text-[11px] text-blue-400">{loc.country}{loc.state ? `, ${loc.state}` : ""}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {dist && <div className="text-[11px] text-cyan-400 font-semibold">{dist}</div>}
                          <div className="text-[10px] text-blue-500">{loc.tempRange}</div>
                          {loc.seasonal && <div className="text-[10px] text-amber-400">Seasonal</div>}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 border-t border-blue-700/30 pt-2 space-y-2">
                          <p className="text-blue-200 text-xs leading-relaxed">{loc.description}</p>
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                            <p className="text-amber-300 text-[11px]">⚠ {loc.safetyNote}</p>
                          </div>
                          <button
                            data-testid={`button-earn-badge-${loc.id}`}
                            onClick={() => { awardBadge(loc.id); setLocationIdDetail(null); toast({ title: `${loc.flag} Badge earned!`, description: loc.name }); }}
                            disabled={earned}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${earned ? "bg-cyan-500/20 text-cyan-400 cursor-default" : "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30"}`}
                          >
                            {earned ? "Badge Earned ✓" : "Mark as Visited"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
