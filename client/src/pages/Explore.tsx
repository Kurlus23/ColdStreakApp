import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin, Compass, Search, X, ChevronDown, Lock,
  Trophy, Flame, Navigation, Star, Plus, Send, Info, ShieldAlert, ShoppingCart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProStatus } from "@/hooks/use-pro-status";
import { PASSPORT_LOCATIONS, usePassportBadges, distanceMiles, DIFFICULTY_META, type Difficulty } from "@/lib/passport";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserLocation } from "@shared/schema";

const NOMINATIONS_KEY = "coldstreak-nominations";
const RADIUS_KEY = "coldstreak-explore-radius";
const RADIUS_OPTIONS = [
  { label: "Any distance", value: 0 },
  { label: "10 miles", value: 10 },
  { label: "25 miles", value: 25 },
  { label: "50 miles", value: 50 },
  { label: "100 miles", value: 100 },
];
const COMMUNITY_DISPLAY_LIMIT = 5;

function getNominated(): Set<number> {
  try {
    const s = localStorage.getItem(NOMINATIONS_KEY);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
}
function saveNominated(s: Set<number>) {
  localStorage.setItem(NOMINATIONS_KEY, JSON.stringify([...s]));
}

const DIFFICULTY_FILTERS: Array<{ value: Difficulty | "All"; label: string }> = [
  { value: "All",      label: "All" },
  { value: "cold",     label: DIFFICULTY_META["cold"].emoji },
  { value: "ice-bath", label: DIFFICULTY_META["ice-bath"].emoji },
  { value: "extreme",  label: DIFFICULTY_META["extreme"].emoji },
  { value: "arctic",   label: DIFFICULTY_META["arctic"].emoji },
];

const GEAR_ITEMS = [
  {
    id: "danner-950",
    name: "Danner Supreme Aqua-Mag 950 GPH Pump",
    description: "Magnetic drive submersible pump — popular choice for circulating and chilling cold plunge tub water.",
    price: "$158",
    image: "/gear-danner-950.jpg",
    link: "https://amzn.to/413FdAx",
  },
  {
    id: "inkbird-wifi",
    name: "Inkbird WiFi Temperature Controller",
    description: "WiFi-enabled dual-outlet temperature controller with probe — automate your chiller or heater to hold your exact target temp.",
    price: "$40",
    image: "/gear-inkbird-wifi.jpg",
    link: "https://amzn.to/4ruCoTK",
  },
  {
    id: "baoshishan-chiller",
    name: "Baoshishan Water Chiller",
    description: "Compact water chiller with built-in digital temp display — keeps your cold plunge at a consistent target temperature without ice.",
    price: "$270",
    image: "/gear-baoshishan-chiller.jpg",
    link: "https://amzn.to/40vlTfm",
  },
  {
    id: "pod-chiller",
    name: "The Pod Chiller (Standard 0.33HP)",
    description: "Purpose-built cold plunge chiller with built-in filtration — cools down to 42°F and designed specifically for cold plunge tubs.",
    price: "$399",
    image: "/gear-pod-chiller.png",
    link: "https://amzn.to/4dlxt4c",
  },
  {
    id: "pod-tub",
    name: "The Pod Company 110 Gallon Cold Plunge Tub",
    description: "110-gallon insulated cold plunge tub — fits people up to 6'7\" and pairs perfectly with The Pod Chiller for a complete home setup.",
    price: "$349",
    image: "/gear-pod-tub.png",
    link: "https://amzn.to/3P6V9iS",
  },
  {
    id: "primaal-icebath",
    name: "Primaal Health Smart Ice Bath with Chiller",
    description: "All-in-one smart cold plunge — app-controlled chiller, insulated tub, and lid included. Set temp, timer, and schedule from your phone.",
    price: "$1,099.99",
    image: "/gear-primaal-icebath.png",
    link: "https://amzn.to/4slE17u",
  },
  {
    id: "lamudo-ozone",
    name: "Lamudo Ozone Generator for Cold Plunge Tubs",
    description: "Chemical-free water sanitizer with inline T-fitting for easy pump integration — 100mg/h ozone keeps your cold plunge water fresh.",
    price: "$72.99",
    image: "/gear-lamudo-ozone.png",
    link: "https://amzn.to/4saIXMJ",
  },
  {
    id: "ambohr-ozone",
    name: "Ambohr Ozone Generator for Cold Plunge Tubs",
    description: "Keep your cold plunge water clean and odor-free without harsh chemicals. Plugs directly into your tub's pump line — 100mg/h ozone output.",
    price: "$76.99",
    image: "/gear-ambohr-ozone.png",
    link: "https://amzn.to/3PkkR3k",
  },
  {
    id: "oura-ring",
    name: "Oura Ring 4 — Smart Health Ring",
    description: "Track HRV, sleep, and recovery to see how cold plunges impact your body. Waterproof and wearable 24/7.",
    price: "$499.00",
    image: "/gear-oura-ring.png",
    link: "https://amzn.to/4sHxJip",
  },
  {
    id: "pod-long",
    name: "The Pod Company Long Pod — 126 Gallon",
    description: "Extra-long 126-gallon cold plunge tub for taller plungers up to 6'9\" — wide rectangular shape for full-body immersion.",
    price: "$399",
    image: "/gear-pod-long.png",
    link: "https://amzn.to/4rA3VDA",
  },
];

interface GeoPos { lat: number; lng: number; }

export function Explore({ username, onClose, onUpgrade, onViewLeaderboard }: {
  username: string;
  onClose: () => void;
  onUpgrade: () => void;
  onViewLeaderboard?: (locationId: string, name: string) => void;
}) {
  const { toast } = useToast();
  const { isPro } = useProStatus();
  const { badges, awardBadge, hasBadge } = usePassportBadges();

  // ── Shared filter state ──
  const [geoPos, setGeoPos] = useState<GeoPos | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState<number>(() => {
    const saved = localStorage.getItem(RADIUS_KEY);
    return saved ? Number(saved) : 0;
  });
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "All">("All");
  const [showDifficultyInfo, setShowDifficultyInfo] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [zipGeoPos, setZipGeoPos] = useState<GeoPos | null>(null);
  const [zipLabel, setZipLabel] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const zipDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 3) {
      setZipGeoPos(null);
      setZipLabel(null);
      setZipLoading(false);
      if (zipDebounceRef.current) clearTimeout(zipDebounceRef.current);
      return;
    }
    setZipLoading(true);
    if (zipDebounceRef.current) clearTimeout(zipDebounceRef.current);
    zipDebounceRef.current = setTimeout(async () => {
      try {
        const isZip = /^\d{5}$/.test(trimmed);
        const url = isZip
          ? `https://nominatim.openstreetmap.org/search?postalcode=${trimmed}&country=USA&format=json&limit=1`
          : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = await res.json();
        if (data?.[0]) {
          const { lat, lon, display_name } = data[0];
          setZipGeoPos({ lat: Number(lat), lng: Number(lon) });
          const parts = display_name.split(",").slice(0, 2).join(",").trim();
          setZipLabel(parts);
        } else {
          setZipGeoPos(null);
          setZipLabel(isZip ? "Unknown zip code" : null);
        }
      } catch {
        setZipGeoPos(null);
        setZipLabel(null);
      } finally {
        setZipLoading(false);
      }
    }, 700);
  }, [searchText]);

  // ── Tile open/close state ──
  const [passportOpen, setPassportOpen] = useState(true);
  const [communityOpen, setCommunityOpen] = useState(true);
  const [gearOpen, setGearOpen] = useState(true);

  // ── Community disclaimer ──
  const DISCLAIMER_KEY = "coldstreak-community-disclaimer-ack";
  const [showCommunityDisclaimer, setShowCommunityDisclaimer] = useState(false);
  const acknowledged = typeof window !== "undefined" && !!localStorage.getItem(DISCLAIMER_KEY);

  const handleCommunityToggle = () => {
    if (!isPro) { onUpgrade(); return; }
    if (!acknowledged && !communityOpen) {
      setShowCommunityDisclaimer(true);
    }
    setCommunityOpen((v) => !v);
  };

  const handleAcknowledgeDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_KEY, "1");
    setShowCommunityDisclaimer(false);
  };

  // ── Community submission form ──
  const [showForm, setShowForm] = useState(false);
  const [nominated, setNominated] = useState<Set<number>>(getNominated);
  const [locationIdDetail, setLocationIdDetail] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", country: "USA", state: "", city: "", description: "", difficulty: "",
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
  const requestGeo = useCallback((miles: number) => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not available", description: "Your device doesn't support location.", variant: "destructive" });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
        toast({ title: "Location found", description: `Sorting by distance within ${miles} miles.` });
      },
      (err) => {
        setGeoLoading(false);
        toast({ title: "Location denied", description: err.message, variant: "destructive" });
      }
    );
  }, [toast]);

  const handleRadiusChange = useCallback((miles: number) => {
    setRadiusMiles(miles);
    localStorage.setItem(RADIUS_KEY, String(miles));
    if (miles > 0 && !geoPos) requestGeo(miles);
  }, [geoPos, requestGeo]);

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

  // ── Effective geo: zip geocode overrides GPS when searching by zip ──
  const effectiveGeoPos = zipGeoPos ?? geoPos;

  // ── Filter helpers ──
  function matchesText(tokens: (string | undefined | null)[]): boolean {
    if (!searchText.trim()) return true;
    if (zipGeoPos) return true; // geographic mode — show all, sorted/filtered by distance
    const q = searchText.toLowerCase();
    return tokens.some((t) => t?.toLowerCase().includes(q));
  }

  function withinRange(lat: number, lng: number): boolean {
    if (!radiusMiles || !effectiveGeoPos) return true;
    return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, lat, lng) <= radiusMiles;
  }

  function getDist(lat: number, lng: number): number | null {
    if (!effectiveGeoPos) return null;
    return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, lat, lng);
  }

  function distLabel(lat: number, lng: number): string | null {
    const d = getDist(lat, lng);
    if (d === null) return null;
    return d < 1 ? "< 1 mi" : `${d.toFixed(0)} mi`;
  }

  // ── Filtered & sorted Passport locations ──
  const passportFiltered = PASSPORT_LOCATIONS
    .filter((loc) => {
      if (difficultyFilter !== "All" && loc.difficulty !== difficultyFilter) return false;
      if (!matchesText([loc.name, loc.state, loc.description])) return false;
      if (!withinRange(loc.lat, loc.lng)) return false;
      return true;
    })
    .sort((a, b) => {
      if (!effectiveGeoPos) return 0;
      return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, a.lat, a.lng) - distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, b.lat, b.lng);
    });

  // ── Filtered, sorted & limited Community locations ──
  const communityFiltered = communityLocs
    .filter((loc) => {
      if (!matchesText([loc.name, loc.country, loc.state, loc.city, loc.description])) return false;
      const lat = loc.latitude ? Number(loc.latitude) : null;
      const lng = loc.longitude ? Number(loc.longitude) : null;
      if (lat !== null && lng !== null) {
        if (!withinRange(lat, lng)) return false;
      } else if (radiusMiles > 0) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (!effectiveGeoPos) return b.nominationCount - a.nominationCount;
      const aLat = a.latitude ? Number(a.latitude) : null;
      const aLng = a.longitude ? Number(a.longitude) : null;
      const bLat = b.latitude ? Number(b.latitude) : null;
      const bLng = b.longitude ? Number(b.longitude) : null;
      if (aLat !== null && aLng !== null && bLat !== null && bLng !== null) {
        return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, aLat, aLng) - distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, bLat, bLng);
      }
      if (aLat !== null) return -1;
      if (bLat !== null) return 1;
      return b.nominationCount - a.nominationCount;
    })
    .slice(0, COMMUNITY_DISPLAY_LIMIT);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" }); return;
    }
    submitMutation.mutate({
      ...form,
      difficulty: form.difficulty || undefined,
      submittedBy: username,
      ...(formGeoPos ? { latitude: formGeoPos.lat, longitude: formGeoPos.lng } : {}),
    });
  };

  const passportDetail = locationIdDetail
    ? PASSPORT_LOCATIONS.find((l) => l.id === locationIdDetail) ?? null
    : null;

  return (
    <>
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
        {/* Row 1: Difficulty filter pills + info button */}
        <div className="flex gap-1 flex-wrap items-center">
          {DIFFICULTY_FILTERS.map((f) => (
            <button
              key={f.value}
              data-testid={`button-difficulty-${f.value}`}
              onClick={() => setDifficultyFilter(f.value as Difficulty | "All")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                difficultyFilter === f.value
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                  : "bg-blue-800/60 border border-blue-700/40 text-blue-300 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            data-testid="button-difficulty-info"
            onClick={() => setShowDifficultyInfo(true)}
            className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-blue-800/60 border border-blue-700/40 text-blue-400 hover:text-white hover:border-blue-500 transition-all text-[11px] font-bold"
            title="What do the difficulty levels mean?"
          >ℹ</button>
        </div>

        {/* Difficulty info popup */}
        {showDifficultyInfo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setShowDifficultyInfo(false)}
          >
            <div
              className="bg-blue-950 border border-blue-700/60 rounded-2xl p-5 w-full max-w-xs shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-bold text-sm">Difficulty Scale</span>
                <button
                  onClick={() => setShowDifficultyInfo(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-800/60 text-blue-300 hover:text-white transition-all text-sm font-bold"
                >✕</button>
              </div>
              <div className="space-y-3">
                {(["cold","ice-bath","extreme","arctic"] as Difficulty[]).map((d) => {
                  const meta = DIFFICULTY_META[d];
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <span className="text-2xl w-10 text-center">{meta.emoji}</span>
                      <div>
                        <div className={`font-semibold text-sm ${meta.color}`}>{meta.tempLabel} — {meta.label}</div>
                        <div className="text-blue-400 text-[11px]">{
                          d === "cold"     ? "Cool & refreshing. Great for beginners." :
                          d === "ice-bath" ? "Classic ice bath territory. Breathwork recommended." :
                          d === "extreme"  ? "Serious cold. Cold shock risk. Experienced plungers only." :
                                            "Near-freezing water. Expert level — know your limits."
                        }</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-blue-500 text-[10px] mt-4 text-center">Temperatures are typical seasonal ranges for each spot.</p>
            </div>
          </div>
        )}
        {/* Row 2: Radius + Search */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-none">
            <Navigation className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
            <select
              data-testid="select-explore-radius"
              value={radiusMiles}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className={`bg-blue-800/60 border text-xs rounded-xl pl-7 pr-2.5 py-1.5 focus:outline-none appearance-none transition-colors ${
                radiusMiles > 0
                  ? "border-cyan-500/60 text-cyan-300"
                  : "border-blue-700/40 text-white"
              }`}
            >
              {RADIUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1">
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
        {zipLoading && (
          <div className="text-[11px] text-blue-400 flex items-center gap-1.5 px-1">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" />
            Looking up zip code…
          </div>
        )}
        {zipGeoPos && zipLabel && !zipLoading && (
          <div className="text-[11px] text-cyan-300 flex items-center gap-1 px-1">
            <MapPin className="w-3 h-3 shrink-0" />
            Searching near <span className="font-semibold">{zipLabel}</span>
          </div>
        )}
        {/^\d{5}$/.test(searchText.trim()) && !zipLoading && !zipGeoPos && zipLabel === "Unknown zip code" && (
          <div className="text-[11px] text-red-400 px-1">Zip code not found</div>
        )}
      </div>

      {/* ── Community Spots Tile (Pro) ── */}
      <div className="bg-gradient-to-br from-blue-900/70 to-blue-950/80 border border-blue-700/50 rounded-2xl overflow-hidden">
        <div className="flex items-center">
          <button
            data-testid="button-toggle-community"
            onClick={handleCommunityToggle}
            className="flex-1 flex items-center gap-3 px-4 py-3.5"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40">
              <MapPin className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-bold text-sm">Community Spots</div>
              <div className="text-blue-400 text-[11px]">
                {isPro ? (effectiveGeoPos ? "Sorted by distance from you" : "Sorted by most nominations") : "Pro — discover & submit spots"}
              </div>
            </div>
            {isPro ? (
              <span className="text-xs text-blue-400 font-semibold">
                {effectiveGeoPos ? `Nearest ${communityFiltered.length}` : `Top ${communityFiltered.length}`}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold mr-1">
                <Lock className="w-3 h-3" /> Pro
              </span>
            )}
            <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${communityOpen && isPro ? "rotate-180" : ""}`} />
          </button>
          {isPro && (
            <button
              data-testid="button-community-disclaimer"
              onClick={(e) => { e.stopPropagation(); setShowCommunityDisclaimer(true); }}
              title="Location disclaimer"
              className="p-3 text-indigo-400/60 hover:text-indigo-300 transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>

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
                {/* Difficulty rating */}
                <div>
                  <div className="text-[11px] text-blue-400 mb-1.5 px-0.5">Difficulty (optional)</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {DIFFICULTY_FILTERS.filter((f) => f.value !== "All").map((f) => {
                      const meta = DIFFICULTY_META[f.value as Difficulty];
                      return (
                        <button
                          key={f.value}
                          type="button"
                          data-testid={`button-form-difficulty-${f.value}`}
                          onClick={() => setForm((prev) => ({ ...prev, difficulty: prev.difficulty === f.value ? "" : f.value }))}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                            form.difficulty === f.value
                              ? "bg-cyan-500 text-white shadow shadow-cyan-500/30"
                              : "bg-blue-900/60 border border-blue-700/40 text-blue-300 hover:text-white"
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className={form.difficulty === f.value ? "text-white" : meta.color}>{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                    onClick={() => { setShowForm(false); setFormGeoPos(null); setForm({ name: "", country: "USA", state: "", city: "", description: "", difficulty: "" }); }}
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
                {radiusMiles > 0 && geoPos ? `No community spots within ${radiusMiles} miles.` : "No spots yet — be the first to suggest one!"}
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
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-blue-400">
                              {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                            </span>
                            {loc.difficulty && DIFFICULTY_META[loc.difficulty as Difficulty] && (
                              <span className={`text-[10px] font-bold ${DIFFICULTY_META[loc.difficulty as Difficulty].color}`}>
                                {DIFFICULTY_FILTERS.find((f) => f.value === loc.difficulty)?.label}{" "}
                                {DIFFICULTY_META[loc.difficulty as Difficulty].label}
                              </span>
                            )}
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
                          {onViewLeaderboard && (
                            <button
                              data-testid={`button-leaderboard-${loc.id}`}
                              onClick={() => onViewLeaderboard(`community-${loc.id}`, loc.name)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all active:scale-95"
                            >
                              <Trophy className="w-3 h-3" />
                              Board
                            </button>
                          )}
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

      {/* ── Chill Places Tile (Pro) ── */}
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
            <div className="text-white font-bold text-sm">Chill Places</div>
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
                          <div className={`text-[11px] font-semibold ${DIFFICULTY_META[loc.difficulty].color}`}>
                            {DIFFICULTY_META[loc.difficulty].label}
                            {loc.state ? ` · ${loc.state}` : ""}
                          </div>
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
                          <div className={`w-full py-2 px-3 rounded-xl text-xs text-center ${earned ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "bg-blue-800/60 text-blue-400"}`}>
                            {earned ? "✓ Plunge confirmed here" : "Log a plunge tagged to this location to earn your badge"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Gear Section ── */}
        <div className="rounded-2xl overflow-hidden border border-blue-800/50 bg-blue-950/60">
          <button
            data-testid="button-toggle-gear"
            onClick={() => setGearOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-white font-bold text-sm">Cold Plunge Gear</span>
              <span className="text-[10px] text-blue-400 bg-blue-800/60 px-2 py-0.5 rounded-full">{GEAR_ITEMS.length} item{GEAR_ITEMS.length !== 1 ? "s" : ""}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${gearOpen ? "rotate-180" : ""}`} />
          </button>

          {gearOpen && (
            <div className="px-3 pb-3 space-y-3">
              {GEAR_ITEMS.map((item) => (
                <div key={item.id} className="bg-blue-900/50 rounded-xl overflow-hidden border border-blue-700/40">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-40 object-contain bg-white/5 px-4 pt-3"
                  />
                  <div className="px-3 pb-3 pt-2 space-y-1.5">
                    <div className="text-white font-semibold text-sm leading-snug">{item.name}</div>
                    <div className="text-blue-300 text-[11px] leading-relaxed">{item.description}</div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-cyan-300 font-bold text-sm">{item.price}</span>
                      <a
                        data-testid={`link-gear-${item.id}`}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-white font-bold text-xs px-3 py-1.5 rounded-lg"
                      >
                        View on Amazon
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-blue-600 text-[10px] text-center pb-1">
                As an Amazon Associate, ColdStreak earns from qualifying purchases.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Community Disclaimer Modal ── */}
    {showCommunityDisclaimer && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-700/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Community Location Disclaimer</p>
              <p className="text-slate-400 text-[11px]">Please read before exploring</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              Community Spots are submitted by ColdStreak users and <span className="text-white font-semibold">have not been verified</span> for safety, accuracy, or accessibility by ColdStreak.
            </p>
            <p>
              Cold water immersion carries <span className="text-white font-semibold">serious risks</span> including hypothermia, cold shock, and cardiac events. Conditions at any location — water temperature, currents, accessibility — can change without notice.
            </p>
            <p>
              Always assess conditions yourself before entering any body of water, never plunge alone, and <span className="text-white font-semibold">consult a physician</span> if you have any heart, respiratory, or circulatory conditions.
            </p>
            <p className="text-slate-500 text-[11px]">
              ColdStreak is not liable for any injury, loss, or damages arising from use of community-submitted locations.
            </p>
          </div>

          {/* Action */}
          <div className="px-5 pb-5">
            <button
              data-testid="button-acknowledge-disclaimer"
              onClick={handleAcknowledgeDisclaimer}
              className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition-all active:scale-95"
            >
              I Understand — Show Community Spots
            </button>
            {!localStorage.getItem(DISCLAIMER_KEY) && (
              <button
                data-testid="button-dismiss-disclaimer"
                onClick={() => setShowCommunityDisclaimer(false)}
                className="w-full mt-2 py-2 text-slate-500 text-xs hover:text-slate-400 transition-colors"
              >
                Not now
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
