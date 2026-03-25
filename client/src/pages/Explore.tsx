import { useState, useCallback, useEffect, useRef } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MapPin, Compass, Search, X, ChevronDown, Lock,
  Trophy, Flame, Navigation, Star, Plus, Send, Info, ShieldAlert, Building2, CheckCircle2, BadgeCheck, Phone, ExternalLink, Pencil, LocateFixed, Trash2, Eye, EyeOff,
  CalendarDays, Users, Copy, Check, Snowflake, Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProStatus } from "@/hooks/use-pro-status";
import { useAuth } from "@/hooks/use-auth";
import { PASSPORT_LOCATIONS, usePassportBadges, distanceMiles, DIFFICULTY_META, type Difficulty } from "@/lib/passport";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserLocation, Event, EventParticipant } from "@shared/schema";

type EventWithCount = Event & { participantCount: number };

type BizLocation = Omit<UserLocation, "contactEmail"> & { isOwner: boolean; isAdmin: boolean };

const NOMINATIONS_KEY = "coldstreak-nominations";

function openDirections(lat: number | string, lng: number | string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank", "noopener,noreferrer");
}

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

const MODALITY_OPTIONS = [
  { label: "Cold Plunge", emoji: "🧊" },
  { label: "Ice Bath", emoji: "❄️" },
  { label: "Sauna", emoji: "🔥" },
  { label: "Infrared Sauna", emoji: "☀️" },
  { label: "Steam Room", emoji: "💨" },
  { label: "Contrast Therapy", emoji: "♨️" },
  { label: "Cryotherapy", emoji: "🧊" },
  { label: "Float Tank", emoji: "🌊" },
  { label: "Red Light Therapy", emoji: "💡" },
  { label: "Hot Tub", emoji: "🛁" },
  { label: "Breathwork", emoji: "🧘" },
  { label: "Cold Shower", emoji: "🚿" },
];

export type GearCategory = "plunges" | "diy" | "devices" | "apparel";

export interface GearItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  link: string;
  linkLabel: string;
  category: GearCategory;
}

export const GEAR_ITEMS: GearItem[] = [
  // ── PLUNGES ──────────────────────────────────────────
  {
    id: "icepod-tub",
    name: "The Ice Pod — Round Cold Plunge Tub",
    description: "Compact round cold plunge tub from The Pod Company — thick insulated walls with a lid included. Fits tight spaces and pairs with any chiller.",
    image: "/gear-icepod-tub.png",
    link: "https://amzn.to/4uRRm9w",
    linkLabel: "View on Amazon",
    category: "plunges",
  },
  {
    id: "pod-tub",
    name: "The Pod Company 110 Gallon Tub",
    description: "110-gallon insulated tub that fits up to 6'7\" — pairs perfectly with The Pod Chiller for a complete setup.",
    image: "/gear-pod-tub.png",
    link: "https://amzn.to/3P6V9iS",
    linkLabel: "View on Amazon",
    category: "plunges",
  },
  {
    id: "pod-long",
    name: "The Pod Company Long Pod — 126 Gallon",
    description: "Extra-long 126-gallon tub for taller plungers up to 6'9\" — wide rectangular shape for full-body immersion.",
    image: "/gear-pod-long.png",
    link: "https://amzn.to/4d8OKOb",
    linkLabel: "View on Amazon",
    category: "plunges",
  },
  {
    id: "primaal-icebath",
    name: "Primaal Health Smart Ice Bath",
    description: "All-in-one smart cold plunge — app-controlled chiller, insulated tub, and lid included. Schedule from your phone.",
    image: "/gear-primaal-icebath.png",
    link: "https://amzn.to/4slE17u",
    linkLabel: "View on Amazon",
    category: "plunges",
  },
  {
    id: "as-coldplunge",
    name: "AS ColdPlunge Tub + Chiller Bundle",
    description: "All-in-one cold plunge bundle — insulated oval tub with a built-in chiller that cools to 42°F, includes a lid and filtration. No ice needed.",
    image: "/gear-as-coldplunge.png",
    link: "https://amzn.to/3Py1nZc",
    linkLabel: "View on Amazon",
    category: "plunges",
  },
  // ── DIY ──────────────────────────────────────────────
  {
    id: "danner-950",
    name: "Danner Aqua-Mag 950 GPH Pump",
    description: "Magnetic drive submersible pump — popular choice for circulating and chilling cold plunge tub water.",
    image: "/gear-danner-950.jpg",
    link: "https://amzn.to/413FdAx",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "baoshishan-chiller",
    name: "Baoshishan Water Chiller",
    description: "Compact water chiller with built-in digital temp display — keeps your plunge at a consistent temperature without ice.",
    image: "/gear-baoshishan-chiller.jpg",
    link: "https://amzn.to/40vlTfm",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "pod-chiller",
    name: "The Pod Chiller (0.33HP)",
    description: "Purpose-built cold plunge chiller with built-in filtration — cools to 42°F and designed specifically for cold plunge tubs.",
    image: "/gear-pod-chiller.png",
    link: "https://amzn.to/4dlxt4c",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "inkbird-wifi",
    name: "Inkbird WiFi Temperature Controller",
    description: "WiFi dual-outlet temp controller with probe — automate your chiller or heater to hold your exact target temp.",
    image: "/gear-inkbird-wifi.jpg",
    link: "https://amzn.to/4ruCoTK",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "lamudo-ozone",
    name: "Lamudo Ozone Generator",
    description: "Chemical-free water sanitizer with inline T-fitting for easy pump integration — 100mg/h ozone keeps water fresh.",
    image: "/gear-lamudo-ozone.png",
    link: "https://amzn.to/4saIXMJ",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "ambohr-ozone",
    name: "Ambohr Ozone Generator",
    description: "Keep your cold plunge water clean without harsh chemicals. Plugs directly into your pump line — 100mg/h ozone output.",
    image: "/gear-ambohr-ozone.png",
    link: "https://amzn.to/3PkkR3k",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "filter-cartridges",
    name: "Pleated Filter Cartridges (4-Pack)",
    description: "Universal 10\" pleated sediment filter cartridges — keep your cold plunge water clear by trapping debris before it reaches your pump or chiller.",
    image: "/gear-filter-cartridges.png",
    link: "https://amzn.to/4lSmuSe",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "yolink-leak-detector",
    name: "YoLink Leak Sensor Kit (4-Pack + Hub)",
    description: "Long-range YoLink water leak sensors with hub — 4 sensors cover your whole cold plunge area with app alerts and up to 1000ft wireless range.",
    image: "/gear-yolink-leak-detector.png",
    link: "https://amzn.to/3Q0igvG",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  {
    id: "leak-detector",
    name: "WiFi Leak Detector Kit (3-Pack + Hub)",
    description: "Smart water leak sensors with WiFi hub — place around your cold plunge setup to get instant phone alerts if your tub or chiller lines ever spring a leak.",
    image: "/gear-leak-detector.png",
    link: "https://amzn.to/47jF2Vw",
    linkLabel: "View on Amazon",
    category: "diy",
  },
  // ── DEVICES ──────────────────────────────────────────
  {
    id: "oura-ring",
    name: "Oura Ring 4",
    description: "Track HRV, sleep, and recovery to see how cold plunges impact your body. Waterproof and wearable 24/7.",
    image: "/gear-oura-ring.png",
    link: "https://amzn.to/4sHxJip",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "inkbird-floating",
    name: "Inkbird Floating Wireless Thermometer",
    description: "Float-in-place wireless thermometer with an indoor base station display — see your cold plunge water temp at a glance from across the room.",
    image: "/gear-inkbird-floating-thermometer.png",
    link: "https://amzn.to/4rT5zAg",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "yolink-floating",
    name: "YoLink Floating WiFi Thermometer",
    description: "Drop-in floating WiFi thermometer that sits directly in your cold plunge — monitor water temp remotely via the YoLink app with long-range signal.",
    image: "/gear-yolink-floating-thermometer.png",
    link: "https://amzn.to/4uOc9L2",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "yolink-thermometer",
    name: "YoLink WiFi Water Thermometer",
    description: "Long-range WiFi temp sensor with a waterproof probe — monitor your cold plunge temperature from anywhere in the house via the YoLink app.",
    image: "/gear-yolink-thermometer.png",
    link: "https://amzn.to/48au1Gb",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "garmin-fenix",
    name: "Garmin Fenix 8",
    description: "HRV status, cold stress response, and body battery tracking — waterproof to 10ATM for in-plunge use.",
    image: "/gear-garmin-fenix8.png",
    link: "https://amzn.to/4uOxxjc",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "apple-watch-ultra",
    name: "Apple Watch Ultra 2",
    description: "100m water resistance, continuous heart rate, blood oxygen, and temperature sensing — the flagship smartwatch for serious plungers.",
    image: "/gear-apple-watch-ultra.jpg",
    link: "https://amzn.to/4tdV77H",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "amazfit-trex3",
    name: "Amazfit T-Rex 3",
    description: "Military-grade rugged smartwatch with HRV tracking, 10ATM water resistance, and 3-week battery life — built for serious outdoor training.",
    image: "/gear-amazfit-trex3.png",
    link: "https://amzn.to/3PGyoT2",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  {
    id: "apple-watch-series10",
    name: "Apple Watch Series 10",
    description: "Thin, lightweight Apple Watch with continuous heart rate, blood oxygen, and crash detection — 50m water resistance for plunge tracking.",
    image: "/gear-apple-watch-series10.png",
    link: "https://amzn.to/3Q05vRR",
    linkLabel: "View on Amazon",
    category: "devices",
  },
  // ── APPAREL ──────────────────────────────────────────
  {
    id: "neo-gloves",
    name: "Neoprene Gloves (3mm)",
    description: "3mm neoprene water sports gloves with anti-slip grip and velcro wrist strap — protect your hands from the cold so you can extend your plunge time.",
    image: "/gear-neo-gloves.png",
    link: "https://amzn.to/4uW7GGo",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "neo-socks-capas",
    name: "CAPAS Sand-Proof Water Socks",
    description: "Neoprene ankle socks with a heavy-duty non-slip sole — sand-proof design keeps debris out during outdoor cold plunges and beach swims.",
    image: "/gear-neo-socks-capas.png",
    link: "https://amzn.to/4bxBCAR",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "neo-socks-blue",
    name: "Neoprene Water Socks — Blue Camo (3mm)",
    description: "Bold blue camo 3mm neoprene socks with a non-slip sole — thermal foot protection with style for cold plunges and open-water swims.",
    image: "/gear-neo-socks-blue.png",
    link: "https://amzn.to/4sxUplF",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "neo-socks-black",
    name: "Neoprene Water Socks — Black (3mm)",
    description: "Sleek all-black 3mm neoprene socks with a non-slip sole — thermal protection for your feet during cold plunges.",
    image: "/gear-neo-socks-black.png",
    link: "https://amzn.to/4s09rzv",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "neo-socks",
    name: "Neoprene Water Socks (3mm)",
    description: "3mm neoprene water socks for cold plunging — keep your feet warm so the cold doesn't cut your session short.",
    image: "/gear-neo-socks.png",
    link: "https://amzn.to/4tsUqHN",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "warmup-robe",
    name: "Hooded Fleece Warm-Up Robe",
    description: "Post-plunge recovery robe — ultra-soft hooded fleece to wrap up immediately after your plunge and rewarm comfortably.",
    image: "/gear-fleece-robe.png",
    link: "https://amzn.to/41s21tT",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "mens-hooded-robe2",
    name: "Men's Plush Hooded Robe",
    description: "Mid-length men's plush fleece robe with a generous hood and waist belt — quick to throw on after stepping out of the cold.",
    image: "/gear-mens-hooded-robe2.png",
    link: "https://amzn.to/4by3mFF",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "mens-fleece-robe",
    name: "Men's Hooded Fleece Robe",
    description: "Full-length men's fleece robe with a hood and deep pockets — ideal for post-plunge recovery and staying warm after cold immersion.",
    image: "/gear-mens-fleece-robe.png",
    link: "https://amzn.to/47opUGf",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "sherpa-shawl-robe",
    name: "Sherpa Shawl-Collar Robe",
    description: "Luxuriously thick shawl-collar sherpa robe — stay toasty after your plunge with deep pockets and a belt to lock in warmth.",
    image: "/gear-sherpa-shawl-robe.png",
    link: "https://amzn.to/4bLH5mx",
    linkLabel: "View on Amazon",
    category: "apparel",
  },
  {
    id: "plaid-sherpa-robe",
    name: "Plaid Sherpa-Lined Robe",
    description: "Cozy plaid flannel robe with a warm sherpa lining — perfect for wrapping up after a cold plunge and staying warm while you recover.",
    image: "/gear-plaid-sherpa-robe.png",
    link: "https://amzn.to/4bwqMuW",
    linkLabel: "View on Amazon",
    category: "apparel",
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
  const auth = useAuth();
  const { badges, awardBadge, hasBadge } = usePassportBadges();

  // ── Top-level tab ──
  const [exploreTab, setExploreTab] = useState<"locations" | "events">("locations");

  // ── Events state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evtName, setEvtName] = useState("");
  const [evtDescription, setEvtDescription] = useState("");
  const [evtDate, setEvtDate] = useState("");
  const [evtLocationName, setEvtLocationName] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [joinedEventIds, setJoinedEventIds] = useState<Set<number>>(new Set());
  const [evtPlungeGps, setEvtPlungeGps] = useState<GeoPos | null>(null);
  const [evtAccessGps, setEvtAccessGps] = useState<GeoPos | null>(null);
  const [evtPlungeGpsLoading, setEvtPlungeGpsLoading] = useState(false);
  const [evtAccessGpsLoading, setEvtAccessGpsLoading] = useState(false);

  const { data: eventsData = [], isLoading: eventsLoading } = useQuery<EventWithCount[]>({
    queryKey: ["/api/events"],
    queryFn: () => fetch("/api/events").then((r) => r.json()),
    enabled: exploreTab === "events",
  });

  const createEventMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/events", {
      name: evtName.trim(),
      description: evtDescription.trim() || undefined,
      eventDate: evtDate,
      locationName: evtLocationName.trim() || undefined,
      ...(evtPlungeGps ? { plungeLat: evtPlungeGps.lat, plungeLng: evtPlungeGps.lng } : {}),
      ...(evtAccessGps ? { accessLat: evtAccessGps.lat, accessLng: evtAccessGps.lng } : {}),
    }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowCreateModal(false);
      setEvtName(""); setEvtDescription(""); setEvtDate(""); setEvtLocationName("");
      setEvtPlungeGps(null); setEvtAccessGps(null);
      toast({ title: "Event created! 🧊", description: "Share the link with your fellow plungers." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const joinEventMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/events/${id}/join`, {
      username: auth.user?.displayName || auth.user?.email?.split("@")[0] || "Anon",
    }).then((r) => r.json()),
    onSuccess: (_data, id) => {
      setJoinedEventIds((prev) => new Set([...prev, id]));
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "You're in! ❄️" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const leaveEventMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/events/${id}/join`).then((r) => r.json()),
    onSuccess: (_data, id) => {
      setJoinedEventIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Left event" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function grabEventGps(target: "plunge" | "access") {
    if (target === "plunge") setEvtPlungeGpsLoading(true); else setEvtAccessGpsLoading(true);
    try {
      const coords = Capacitor.isNativePlatform()
        ? (await Geolocation.getCurrentPosition({ enableHighAccuracy: true })).coords
        : await new Promise<GeolocationCoordinates>((res, rej) =>
            navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, { enableHighAccuracy: true, timeout: 10000 })
          );
      const pos: GeoPos = { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) };
      if (target === "plunge") setEvtPlungeGps(pos); else setEvtAccessGps(pos);
      toast({ title: target === "access" ? "🅿 Parking point pinned ✓" : "📍 Plunge spot pinned ✓" });
    } catch { toast({ title: "GPS unavailable", variant: "destructive" }); }
    if (target === "plunge") setEvtPlungeGpsLoading(false); else setEvtAccessGpsLoading(false);
  }

  function handleCopyEventLink(code: string) {
    const url = `${window.location.origin}/event/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedCode(code);
    toast({ title: "Link copied!", description: url });
    setTimeout(() => setCopiedCode(null), 2500);
  }

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
  const [passportOpen, setPassportOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(true);

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
    name: "", country: "USA", state: "", city: "", description: "", difficulty: "", isBusiness: false, websiteUrl: "",
  });
  const [formGeoPos, setFormGeoPos] = useState<GeoPos | null>(null);
  const [formGeoLoading, setFormGeoLoading] = useState(false);

  const COUNTRY_MAP: Record<string, string> = {
    "united states": "USA", "us": "USA", "usa": "USA",
    "iceland": "Iceland", "norway": "Norway", "switzerland": "Switzerland",
    "australia": "Australia", "russia": "Russia", "canada": "Canada",
    "united kingdom": "UK", "germany": "Germany", "japan": "Japan",
  };

  async function getPosition(): Promise<{ lat: number; lng: number }> {
    if (Capacitor.isNativePlatform()) {
      await Geolocation.requestPermissions();
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("GPS not available")); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  const requestFormGeo = useCallback(async () => {
    setFormGeoLoading(true);
    try {
      const { lat, lng } = await getPosition();
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
    } catch (err: any) {
      setFormGeoLoading(false);
      toast({ title: "Location denied", description: "Please allow location access in your device settings.", variant: "destructive" });
    }
  }, [toast]);

  // ── GPS ──
  const requestGeo = useCallback(async (miles: number) => {
    setGeoLoading(true);
    try {
      const { lat, lng } = await getPosition();
      setGeoPos({ lat, lng });
      setGeoLoading(false);
      toast({ title: "Location found", description: `Sorting by distance within ${miles} miles.` });
    } catch {
      setGeoLoading(false);
      toast({ title: "Location denied", description: "Please allow location access in your device settings.", variant: "destructive" });
    }
  }, [toast]);

  const handleRadiusChange = useCallback((miles: number) => {
    setRadiusMiles(miles);
    localStorage.setItem(RADIUS_KEY, String(miles));
    if (miles > 0 && !geoPos) requestGeo(miles);
  }, [geoPos, requestGeo]);

  // ── Community locations query ──
  const { data: communityLocs = [] } = useQuery<BizLocation[]>({
    queryKey: ["/api/community-locations"],
  });

  // ── Submit community location ──
  const submitMutation = useMutation({
    mutationFn: async (data: typeof form & { submittedBy: string; latitude?: number; longitude?: number }) =>
      apiRequest("POST", "/api/community-locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setShowForm(false);
      setForm({ name: "", country: "USA", state: "", city: "", description: "", difficulty: "", isBusiness: false, websiteUrl: "" });
      setFormGeoPos(null);
      toast({ title: "Location submitted!", description: "Thanks — your spot is now visible to the community." });
    },
    onError: () => toast({ title: "Submit failed", variant: "destructive" }),
  });

  const nominateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/community-locations/${id}/nominate`).then((r) => r.json()),
    onSuccess: (_, id) => {
      const next = new Set(nominated);
      next.add(id);
      setNominated(next);
      saveNominated(next);
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      toast({ title: "Vote counted!" });
    },
  });

  const [verifyDialogLocId, setVerifyDialogLocId] = useState<number | null>(null);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [deleteDialogLocId, setDeleteDialogLocId] = useState<number | null>(null);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [ownerDeleteConfirmId, setOwnerDeleteConfirmId] = useState<number | null>(null);
  const [editLocId, setEditLocId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", city: "", state: "", country: "", latitude: "", longitude: "", accessLat: "", accessLng: "" });
  const [editAccessGpsLoading, setEditAccessGpsLoading] = useState(false);
  const [editMainGpsLoading, setEditMainGpsLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const editLocMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/community-locations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setEditLocId(null);
      toast({ title: "Location updated!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const ownerDeleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/community-locations/${id}`, {}).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setEditLocId(null);
      setOwnerDeleteConfirmId(null);
      toast({ title: "Location removed", description: "Your location has been deleted." });
    },
    onError: () => toast({ title: "Could not delete location", variant: "destructive" }),
  });

  const adminVisibilityMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      apiRequest("PATCH", `/api/admin/locations/${id}/visibility`, { hidden }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
    },
    onError: () => toast({ title: "Admin action failed", variant: "destructive" }),
  });

  const openEdit = (loc: BizLocation) => {
    setEditForm({
      name: loc.name ?? "",
      description: loc.description ?? "",
      city: loc.city ?? "",
      state: loc.state ?? "",
      country: loc.country ?? "",
      latitude: loc.latitude ?? "",
      longitude: loc.longitude ?? "",
      accessLat: loc.accessLat ?? "",
      accessLng: loc.accessLng ?? "",
    });
    setEditLocId(loc.id);
  };

  const grabGps = async (target: "main" | "access") => {
    if (target === "main") setEditMainGpsLoading(true); else setEditAccessGpsLoading(true);
    try {
      const pos = Capacitor.isNativePlatform()
        ? (await Geolocation.getCurrentPosition({ enableHighAccuracy: true })).coords
        : await new Promise<GeolocationCoordinates>((res, rej) => {
            navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, { enableHighAccuracy: true, timeout: 10000 });
          });
      const lat = pos.latitude.toFixed(6);
      const lng = pos.longitude.toFixed(6);
      if (target === "main") setEditForm((f) => ({ ...f, latitude: lat, longitude: lng }));
      else setEditForm((f) => ({ ...f, accessLat: lat, accessLng: lng }));
      toast({ title: target === "access" ? "Access point pinned ✓" : "Main pin updated ✓" });
    } catch { toast({ title: "GPS unavailable", variant: "destructive" }); }
    if (target === "main") setEditMainGpsLoading(false); else setEditAccessGpsLoading(false);
  };
  const [businessOpen, setBusinessOpen] = useState(true);
  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [businessProfileId, setBusinessProfileId] = useState<number | null>(null);
  const [bizTier, setBizTier] = useState<"free" | "verified">("free");
  const [bizGeoPos, setBizGeoPos] = useState<GeoPos | null>(null);
  const [bizForm, setBizForm] = useState({
    name: "", fullAddress: "", city: "", state: "", country: "USA",
    description: "", phone: "", websiteUrl: "", yelpUrl: "", facebookUrl: "", bookingUrl: "", contactEmail: "",
  });
  const [bizModalities, setBizModalities] = useState<string[]>([]);

  const resetBizForm = () => {
    setBizForm({ name: "", fullAddress: "", city: "", state: "", country: "USA", description: "", phone: "", websiteUrl: "", yelpUrl: "", facebookUrl: "", bookingUrl: "", contactEmail: "" });
    setBizModalities([]);
    setBizTier("free");
    setBizGeoPos(null);
  };

  const toggleModality = (label: string) => {
    setBizModalities((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    );
  };

  const businessCheckoutMutation = useMutation({
    mutationFn: ({ locationId, email }: { locationId: number; email: string }) =>
      apiRequest("POST", "/api/stripe/business-checkout", {
        locationId,
        email,
        successUrl: window.location.origin + "/",
        cancelUrl: window.location.origin + "/",
      }).then((r) => r.json()),
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("Email does not match") || msg.includes("403")) {
        toast({ title: "Email not recognized", description: "Enter the contact email you used when submitting this listing.", variant: "destructive" });
      } else {
        toast({ title: "Checkout failed", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: ({ locationId, email }: { locationId: number; email: string }) =>
      apiRequest("DELETE", `/api/community-locations/${locationId}`, { email }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setDeleteDialogLocId(null);
      setDeleteEmail("");
      toast({ title: "Listing removed", description: "Your listing has been deleted." });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("Email does not match") || msg.includes("403")) {
        toast({ title: "Email not recognized", description: "Enter the contact email used when submitting this listing.", variant: "destructive" });
      } else {
        toast({ title: "Could not delete listing", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const submitBusinessMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/community-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit");
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (loc) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      if (bizTier === "verified") {
        businessCheckoutMutation.mutate({ locationId: loc.id, email: bizForm.contactEmail });
      } else {
        setShowBusinessForm(false);
        resetBizForm();
        toast({ title: "Business listed!", description: "Your business is now visible in the directory." });
      }
    },
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  const handleBusinessSubmit = () => {
    if (!bizForm.name.trim()) { toast({ title: "Business name required", variant: "destructive" }); return; }
    if (!bizForm.city.trim()) { toast({ title: "City required", variant: "destructive" }); return; }
    if (!bizForm.state.trim()) { toast({ title: "State required", variant: "destructive" }); return; }
    if (!bizForm.contactEmail.trim()) { toast({ title: "Contact email required", variant: "destructive" }); return; }
    submitBusinessMutation.mutate({
      name: bizForm.name.trim(),
      country: bizForm.country,
      city: bizForm.city.trim(),
      state: bizForm.state.trim(),
      description: bizForm.description.trim() || undefined,
      phone: bizForm.phone.trim() || undefined,
      websiteUrl: bizForm.websiteUrl.trim() || undefined,
      yelpUrl: bizForm.yelpUrl.trim() || undefined,
      facebookUrl: bizForm.facebookUrl.trim() || undefined,
      bookingUrl: bizForm.bookingUrl.trim() || undefined,
      contactEmail: bizForm.contactEmail.trim(),
      fullAddress: bizForm.fullAddress.trim() || undefined,
      modalities: bizModalities.length > 0 ? bizModalities : undefined,
      isBusiness: true,
      submittedBy: username,
      ...(bizGeoPos ? { latitude: bizGeoPos.lat, longitude: bizGeoPos.lng } : {}),
    });
  };

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

  // ── Business locations ──
  const allBusinessLocs = communityLocs.filter((l) => l.isBusiness);
  // Default radius for businesses: 100 miles when GPS is available; otherwise any distance
  const bizEffectiveRadius = radiusMiles > 0 ? radiusMiles : (effectiveGeoPos ? 100 : 0);
  function withinBizRange(lat: number, lng: number): boolean {
    if (!bizEffectiveRadius || !effectiveGeoPos) return true;
    return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, lat, lng) <= bizEffectiveRadius;
  }
  const businessFiltered = allBusinessLocs.filter((loc) => {
    if (!matchesText([loc.name, loc.country, loc.state, loc.city, loc.description])) return false;
    const lat = loc.latitude ? Number(loc.latitude) : null;
    const lng = loc.longitude ? Number(loc.longitude) : null;
    if (lat !== null && lng !== null) {
      if (!withinBizRange(lat, lng)) return false;
    }
    // Businesses without GPS coordinates always show (address-only listings)
    return true;
  });
  const verifiedBusinesses = businessFiltered
    .filter((l) => l.businessVerified)
    .sort((a, b) => {
      if (effectiveGeoPos) {
        const aLat = a.latitude ? Number(a.latitude) : null;
        const aLng = a.longitude ? Number(a.longitude) : null;
        const bLat = b.latitude ? Number(b.latitude) : null;
        const bLng = b.longitude ? Number(b.longitude) : null;
        if (aLat && aLng && bLat && bLng)
          return distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, aLat, aLng) - distanceMiles(effectiveGeoPos.lat, effectiveGeoPos.lng, bLat, bLng);
      }
      return a.name.localeCompare(b.name);
    });
  const freeBusinesses = businessFiltered
    .filter((l) => !l.businessVerified)
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Filtered, sorted & limited Community locations ──
  const communityFiltered = communityLocs
    .filter((loc) => {
      if (loc.isBusiness) return false;
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
      isBusiness: form.isBusiness || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
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

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-blue-900/50 border border-blue-700/40 rounded-2xl p-1">
        <button
          data-testid="tab-explore-locations"
          onClick={() => setExploreTab("locations")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
            exploreTab === "locations"
              ? "bg-cyan-500 text-white shadow shadow-cyan-500/30"
              : "text-blue-400 hover:text-white"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" /> Locations
        </button>
        <button
          data-testid="tab-explore-events"
          onClick={() => setExploreTab("events")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
            exploreTab === "events"
              ? "bg-cyan-500 text-white shadow shadow-cyan-500/30"
              : "text-blue-400 hover:text-white"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" /> Events
        </button>
      </div>

      {exploreTab === "locations" && (<>

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

      {/* ── Cold Plunge Businesses ── */}
      <div className="bg-gradient-to-br from-amber-950/30 to-blue-950/80 border border-amber-700/30 rounded-2xl overflow-hidden">
        <button
          data-testid="button-toggle-businesses"
          onClick={() => setBusinessOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-yellow-500/20 border border-yellow-500/40">
            <Building2 className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-white font-bold text-sm">Cold Plunge Businesses</div>
            <div className="text-blue-400 text-[11px]">
              {effectiveGeoPos
                ? `Within ${bizEffectiveRadius} mi · sorted by distance`
                : "Local facilities & spas — open to all users"}
            </div>
          </div>
          <span className="text-xs text-amber-400 font-semibold mr-1">
            {allBusinessLocs.length === 0 ? "Be first!" : `${businessFiltered.length} shown`}
          </span>
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${businessOpen ? "rotate-180" : ""}`} />
        </button>

        {businessOpen && (
          <div className="px-3 pb-3 space-y-2">
            <button
              data-testid="button-list-business"
              onClick={() => setShowBusinessForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              List Your Business — Free
            </button>

            {allBusinessLocs.length === 0 ? (
              <div className="text-center py-5 text-blue-400 text-sm">No businesses listed yet — be the first!</div>
            ) : businessFiltered.length === 0 ? (
              <div className="text-center py-5 text-blue-400 text-sm">
                {effectiveGeoPos
                  ? `No businesses within ${bizEffectiveRadius} miles. Try searching by city or zip, or widen the distance filter.`
                  : "No businesses match your search."}
              </div>
            ) : (
              <div className="space-y-2">
                {verifiedBusinesses.map((biz) => {
                  const lat = biz.latitude ? Number(biz.latitude) : null;
                  const lng = biz.longitude ? Number(biz.longitude) : null;
                  const dist = lat !== null && lng !== null ? distLabel(lat, lng) : null;
                  return (
                    <button
                      key={biz.id}
                      data-testid={`card-business-verified-${biz.id}`}
                      onClick={() => setBusinessProfileId(biz.id)}
                      className="w-full text-left rounded-xl p-3 bg-yellow-900/15 border border-yellow-500/40 hover:border-yellow-400/60 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span className="text-white font-semibold text-sm flex-1 truncate">{biz.name}</span>
                        {dist && <span className="text-[11px] text-cyan-400 font-semibold shrink-0">{dist}</span>}
                        <span className="text-[9px] bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">Verified</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 ml-6 flex-wrap">
                        <span className="text-blue-400 text-[11px]">{[biz.city, biz.state].filter(Boolean).join(", ")}</span>
                        {biz.description && <span className="text-blue-500 text-[11px] truncate">· {biz.description}</span>}
                      </div>
                    </button>
                  );
                })}
                {freeBusinesses.map((biz) => (
                  <button
                    key={biz.id}
                    data-testid={`card-business-free-${biz.id}`}
                    onClick={() => setBusinessProfileId(biz.id)}
                    className="w-full text-left rounded-xl p-3 bg-blue-900/30 border border-blue-700/30 hover:border-blue-500/50 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-blue-100 font-medium text-sm flex-1 truncate">{biz.name}</span>
                      <span className="text-[9px] bg-blue-800/60 border border-blue-600/50 text-blue-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Unverified</span>
                    </div>
                    <div className="text-blue-500 text-[11px] mt-0.5 ml-5">{[biz.city, biz.state].filter(Boolean).join(", ")}</div>
                    <div className="text-amber-600/70 text-[10px] mt-1 ml-5">⚠ This business has not been verified by ColdStreak</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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

        {communityOpen && !isPro && (
          <div className="px-3 pb-3 space-y-2">
            {/* Frosted real community cards */}
            <div className="relative">
              <div className="space-y-2 blur-[3px] opacity-50 pointer-events-none select-none" aria-hidden="true">
                {(() => {
                  const nonBiz = communityLocs.filter(l => !l.isBusiness);
                  const preview = (communityFiltered.length > 0 ? communityFiltered : nonBiz).slice(0, 3);
                  return preview.map((loc) => {
                    const lat = loc.latitude ? Number(loc.latitude) : null;
                    const lng = loc.longitude ? Number(loc.longitude) : null;
                    const dist = lat && lng ? distLabel(lat, lng) : null;
                    return (
                      <div key={loc.id} className="bg-blue-900/60 border border-blue-700/40 rounded-xl px-3 py-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/30 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold truncate">{loc.name}</p>
                          <p className="text-blue-400 text-[11px]">{[loc.city, loc.state].filter(Boolean).join(", ")}</p>
                        </div>
                        {dist && <span className="text-cyan-400 text-[11px] font-semibold shrink-0">{dist}</span>}
                      </div>
                    );
                  });
                })()}
                {/* Pad with skeletons if no real spots exist yet */}
                {communityLocs.filter(l => !l.isBusiness).length === 0 && [1,2,3].map((i) => (
                  <div key={i} className="bg-blue-900/60 border border-blue-700/40 rounded-xl px-3 py-2.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-700/40 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-blue-400/40 rounded-full w-3/4" />
                      <div className="h-2 bg-blue-600/30 rounded-full w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Fade to CTA */}
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-blue-950/80 to-transparent pointer-events-none" />
            </div>
            {/* CTA */}
            <button
              data-testid="button-upgrade-community"
              onClick={onUpgrade}
              className="w-full bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/50 rounded-xl p-3.5 text-left space-y-2.5 shadow-md active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-xs leading-tight">Discover community cold spots</p>
                  <p className="text-blue-400 text-[11px]">User-submitted locations near you</p>
                </div>
                <span className="ml-auto text-yellow-400 font-bold text-xs shrink-0">from $9.99</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { icon: "📍", text: "Spots near you" },
                  { icon: "🏆", text: "Local leaderboards" },
                  { icon: "➕", text: "Submit your own" },
                  { icon: "🗳️", text: "Vote for favorites" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 bg-indigo-900/30 rounded-lg px-2 py-1.5">
                    <span className="text-[12px]">{icon}</span>
                    <span className="text-blue-200 text-[11px] font-medium">{text}</span>
                  </div>
                ))}
              </div>
              <div className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold text-xs text-center">
                Unlock Pro →
              </div>
            </button>
          </div>
        )}
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
                <button
                  data-testid="button-form-toggle-business"
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isBusiness: !f.isBusiness }))}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    form.isBusiness
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-blue-900/40 border-blue-700/40 text-blue-400"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  {form.isBusiness ? "Business / Commercial ✓" : "Mark as a business or commercial location"}
                </button>
                {form.isBusiness && (
                  <input
                    data-testid="input-form-business-website"
                    type="url"
                    placeholder="Website URL (optional)"
                    value={form.websiteUrl}
                    onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                    className="w-full bg-blue-900/60 border border-amber-500/30 text-white text-xs rounded-xl px-3 py-2 focus:outline-none placeholder-blue-500 focus:border-amber-400"
                  />
                )}
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
                    onClick={() => { setShowForm(false); setFormGeoPos(null); setForm({ name: "", country: "USA", state: "", city: "", description: "", difficulty: "", isBusiness: false, websiteUrl: "" }); }}
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
                  const dirLat = loc.accessLat ? Number(loc.accessLat) : lat;
                  const dirLng = loc.accessLng ? Number(loc.accessLng) : lng;
                  const hasAccessPoint = !!(loc.accessLat && loc.accessLng);
                  const dist = lat !== null && lng !== null ? distLabel(lat, lng) : null;
                  return (
                    <div
                      key={loc.id}
                      data-testid={`card-community-${loc.id}`}
                      className={`rounded-xl p-3 ${
                        loc.businessVerified
                          ? "bg-yellow-900/10 border border-yellow-500/40"
                          : loc.isBusiness
                          ? "bg-amber-900/10 border border-amber-600/25"
                          : "bg-blue-900/40 border border-blue-700/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {loc.isBusiness && <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${loc.businessVerified ? "text-yellow-400" : "text-amber-400"}`} />}
                            <span className="text-white text-sm font-semibold truncate">{loc.name}</span>
                            {loc.businessVerified ? (
                              <span
                                data-testid={`badge-verified-business-${loc.id}`}
                                className="inline-flex items-center gap-1 text-[9px] bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                              >
                                <BadgeCheck className="w-2.5 h-2.5" />Verified Business
                              </span>
                            ) : loc.isBusiness ? (
                              <span className="text-[9px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Business</span>
                            ) : null}
                            {isReview && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                            {dirLat !== null && dirLng !== null && (
                              <button
                                data-testid={`button-directions-community-${loc.id}`}
                                onClick={() => openDirections(dirLat, dirLng)}
                                title={hasAccessPoint ? "Get directions to access/parking point" : "Get directions"}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all active:scale-95 flex-shrink-0"
                              >
                                <Navigation className="w-3 h-3" />
                              </button>
                            )}
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
                          {loc.isBusiness && loc.websiteUrl && (
                            <a
                              href={loc.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`link-website-${loc.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold mt-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              🌐 Visit website
                            </a>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {dist && <span className="text-[11px] text-cyan-400 font-semibold">{dist}</span>}
                          {loc.isOwner ? (
                            <button
                              data-testid={`button-edit-loc-${loc.id}`}
                              onClick={() => openEdit(loc)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-800/40 border border-cyan-600/40 text-cyan-300 hover:bg-cyan-700/50 transition-all active:scale-95"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          ) : (
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
                          )}
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
                          {loc.isBusiness && !loc.businessVerified && (
                            <button
                              data-testid={`button-verify-business-${loc.id}`}
                              onClick={() => setVerifyDialogLocId(loc.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all active:scale-95"
                            >
                              <BadgeCheck className="w-3 h-3" />
                              Verify
                            </button>
                          )}
                        </div>
                      </div>
                      {loc.isAdmin && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-500/20">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                            🛡 Admin
                          </span>
                          {loc.isHidden ? (
                            <button
                              data-testid={`button-admin-show-${loc.id}`}
                              onClick={(e) => { e.stopPropagation(); adminVisibilityMutation.mutate({ id: loc.id, hidden: false }); }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all"
                            >
                              <Eye className="w-3 h-3" /> Restore
                            </button>
                          ) : (
                            <button
                              data-testid={`button-admin-hide-${loc.id}`}
                              onClick={(e) => { e.stopPropagation(); adminVisibilityMutation.mutate({ id: loc.id, hidden: true }); }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all"
                            >
                              <EyeOff className="w-3 h-3" /> Hide
                            </button>
                          )}
                          <button
                            data-testid={`button-admin-delete-${loc.id}`}
                            onClick={(e) => { e.stopPropagation(); setDeleteDialogLocId(loc.id); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                          {loc.isHidden && (
                            <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-500/30 px-1.5 py-0.5 rounded-full">HIDDEN</span>
                          )}
                        </div>
                      )}
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
          onClick={() => setPassportOpen((v) => !v)}
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
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform duration-300 ${passportOpen ? "rotate-180" : ""}`} />
        </button>

        {passportOpen && !isPro && (
          <div className="px-3 pb-3 space-y-2">
            {/* Frosted real passport cards */}
            <div className="relative">
              <div className="space-y-2 blur-[3px] opacity-50 pointer-events-none select-none" aria-hidden="true">
                {(passportFiltered.length > 0 ? passportFiltered : PASSPORT_LOCATIONS).slice(0, 3).map((loc) => {
                  const diff = DIFFICULTY_META[loc.difficulty as Difficulty];
                  const dist = distLabel(loc.lat, loc.lng);
                  return (
                    <div key={loc.id} className="bg-blue-900/50 border border-cyan-700/30 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-base">
                        {diff?.emoji ?? "❄️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{loc.name}</p>
                        <p className="text-blue-400 text-[11px]">{[loc.state, loc.country].filter(Boolean).join(", ")}</p>
                      </div>
                      {dist && <span className="text-cyan-400 text-[11px] font-semibold shrink-0">{dist}</span>}
                    </div>
                  );
                })}
              </div>
              {/* Fade to CTA */}
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-blue-950/80 to-transparent pointer-events-none" />
            </div>
            {/* CTA */}
            <button
              data-testid="button-upgrade-passport"
              onClick={onUpgrade}
              className="w-full bg-gradient-to-br from-slate-900 to-cyan-950 border border-cyan-500/40 rounded-xl p-3.5 text-left space-y-2.5 shadow-md active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-xs leading-tight">50+ curated cold plunge destinations</p>
                  <p className="text-blue-400 text-[11px]">Bucket-list spots around the world</p>
                </div>
                <span className="ml-auto text-yellow-400 font-bold text-xs shrink-0">from $9.99</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { icon: "⭐", text: "Passport badges" },
                  { icon: "🗺️", text: "Bucket-list spots" },
                  { icon: "📏", text: "Distance sorting" },
                  { icon: "🏅", text: "Earn achievements" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 bg-cyan-900/20 rounded-lg px-2 py-1.5">
                    <span className="text-[12px]">{icon}</span>
                    <span className="text-blue-200 text-[11px] font-medium">{text}</span>
                  </div>
                ))}
              </div>
              <div className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xs text-center">
                Unlock Pro →
              </div>
            </button>
          </div>
        )}
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
                      <div className="flex items-center gap-3 p-3">
                        <div
                          onClick={() => setLocationIdDetail(isOpen ? null : loc.id)}
                          className="flex-1 flex items-center gap-3 cursor-pointer text-left min-w-0"
                        >
                          <div className="text-2xl shrink-0">{loc.flag}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-semibold truncate ${earned ? "text-cyan-200" : "text-white"}`}>{loc.name}</span>
                              {earned && <span className="text-xs text-cyan-400 font-bold">✓</span>}
                            </div>
                            <div className={`text-[11px] font-semibold ${DIFFICULTY_META[loc.difficulty].color}`}>
                              {DIFFICULTY_META[loc.difficulty].label}
                              {loc.state ? ` · ${loc.state}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            {dist && <div className="text-[11px] text-cyan-400 font-semibold">{dist}</div>}
                            <div className="text-[10px] text-blue-500">{loc.tempRange}</div>
                            {loc.seasonal && <div className="text-[10px] text-amber-400">Seasonal</div>}
                          </div>
                          <button
                            data-testid={`button-directions-passport-${loc.id}`}
                            onClick={() => openDirections(loc.lat, loc.lng)}
                            title="Get directions"
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all active:scale-95 shrink-0"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
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

      </div>
      </>)}

      {exploreTab === "events" && (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-blue-300 text-xs">Community cold plunge gatherings</p>
            {auth.user ? (
              <button
                data-testid="button-create-event"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            ) : (
              <p className="text-blue-500 text-xs">Log in to create events</p>
            )}
          </div>

          {/* Event list */}
          {eventsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Snowflake className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : eventsData.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Calendar className="w-10 h-10 text-blue-600 mx-auto" />
              <p className="text-blue-400 text-sm font-semibold">No upcoming events</p>
              <p className="text-blue-600 text-xs">Be the first to organize a cold plunge!</p>
            </div>
          ) : (
            eventsData.map((evt) => {
              const isJoined = joinedEventIds.has(evt.id);
              return (
                <div key={evt.id} className="bg-blue-900/50 border border-blue-700/40 rounded-2xl p-4 space-y-3">
                  <div>
                    <h3 className="text-white font-bold text-sm">{evt.name}</h3>
                    {evt.description && <p className="text-blue-300 text-xs mt-0.5 line-clamp-2">{evt.description}</p>}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                      <CalendarDays className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      {new Date(evt.eventDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    {evt.locationName && (
                      <div className="flex items-center gap-2 text-blue-400 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        {evt.locationName}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                      <Users className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      {evt.participantCount} attending
                    </div>
                  </div>
                  {/* Directions buttons */}
                  {(evt.plungeLat || evt.accessLat) && (
                    <div className="flex gap-2">
                      {evt.plungeLat && evt.plungeLng && (
                        <button
                          data-testid={`button-directions-plunge-${evt.id}`}
                          onClick={() => openDirections(evt.plungeLat!, evt.plungeLng!)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold hover:bg-cyan-500/25 transition-all active:scale-95"
                        >
                          <Navigation className="w-3 h-3" /> Plunge Spot
                        </button>
                      )}
                      {evt.accessLat && evt.accessLng && (
                        <button
                          data-testid={`button-directions-parking-${evt.id}`}
                          onClick={() => openDirections(evt.accessLat!, evt.accessLng!)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-700/30 border border-blue-600/40 text-blue-300 text-[11px] font-semibold hover:bg-blue-700/50 transition-all active:scale-95"
                        >
                          <Navigation className="w-3 h-3" /> 🅿 Parking
                        </button>
                      )}
                    </div>
                  )}
                  {evt.createdByUsername && (
                    <p className="text-blue-600 text-[11px]">by {evt.createdByUsername}</p>
                  )}
                  <div className="flex gap-2">
                    {auth.user ? (
                      isJoined ? (
                        <button
                          data-testid={`button-leave-event-${evt.id}`}
                          onClick={() => leaveEventMut.mutate(evt.id)}
                          disabled={leaveEventMut.isPending}
                          className="flex-1 py-2 rounded-xl border border-blue-600/60 text-blue-300 text-xs font-semibold hover:border-blue-400 transition-all active:scale-95 disabled:opacity-40"
                        >
                          {leaveEventMut.isPending ? "Leaving…" : "✓ Attending"}
                        </button>
                      ) : (
                        <button
                          data-testid={`button-join-event-${evt.id}`}
                          onClick={() => joinEventMut.mutate(evt.id)}
                          disabled={joinEventMut.isPending}
                          className="flex-1 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all active:scale-95 disabled:opacity-40"
                        >
                          {joinEventMut.isPending ? "Joining…" : "❄️ Join"}
                        </button>
                      )
                    ) : null}
                    <button
                      data-testid={`button-share-event-${evt.id}`}
                      onClick={() => handleCopyEventLink(evt.shareCode)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-700/50 text-blue-400 text-xs font-semibold hover:border-blue-500 hover:text-blue-300 transition-all active:scale-95"
                    >
                      {copiedCode === evt.shareCode ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode === evt.shareCode ? "Copied" : "Share"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
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
            <p>
              <span className="text-white font-semibold">No Trespassing:</span> Always verify you have legal access to a location before visiting. Many natural bodies of water are on private property. Respect all posted signs and local laws. ColdStreak does not verify the legal accessibility of any community-submitted location.
            </p>
            <p className="text-slate-500 text-[11px]">
              ColdStreak is not liable for any injury, loss, damages, or legal consequences arising from use of community-submitted locations.
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

    {/* ── Edit Community Location Modal ── */}
    {editLocId !== null && (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditLocId(null)}>
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-base flex items-center gap-2"><Pencil className="w-4 h-4 text-cyan-400" /> Edit Location</h2>
            <button onClick={() => setEditLocId(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/60 text-slate-400 hover:text-white transition-colors">✕</button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Name</label>
              <input data-testid="input-edit-loc-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400" />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Description</label>
              <textarea data-testid="input-edit-loc-description" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">City</label>
                <input value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">State</label>
                <input value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400" />
              </div>
            </div>

            {/* Main location pin */}
            <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50 space-y-2">
              <p className="text-slate-300 text-xs font-semibold">📍 Main Location Pin</p>
              <p className="text-slate-500 text-[11px]">Where the water is. Used for the map marker.</p>
              {editForm.latitude && editForm.longitude && (
                <p className="text-cyan-400 text-[11px] font-mono">{editForm.latitude}, {editForm.longitude}</p>
              )}
              <button data-testid="button-edit-main-gps" onClick={() => grabGps("main")} disabled={editMainGpsLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50">
                <LocateFixed className="w-3.5 h-3.5" />
                {editMainGpsLoading ? "Getting GPS…" : "Update with current GPS"}
              </button>
            </div>

            {/* Access / parking point */}
            <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50 space-y-2">
              <p className="text-slate-300 text-xs font-semibold">🅿 Access / Parking Point</p>
              <p className="text-slate-500 text-[11px]">Where directions lead — trailhead, parking lot, or gate. Separate from the water location.</p>
              {editForm.accessLat && editForm.accessLng ? (
                <div className="flex items-center gap-2">
                  <p className="text-green-400 text-[11px] font-mono flex-1">{editForm.accessLat}, {editForm.accessLng}</p>
                  <button onClick={() => setEditForm((f) => ({ ...f, accessLat: "", accessLng: "" }))}
                    className="text-[11px] text-slate-500 hover:text-red-400 transition-colors">Clear</button>
                </div>
              ) : (
                <p className="text-slate-600 text-[11px]">Not set — directions go to main pin.</p>
              )}
              <button data-testid="button-edit-access-gps" onClick={() => grabGps("access")} disabled={editAccessGpsLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50">
                <LocateFixed className="w-3.5 h-3.5" />
                {editAccessGpsLoading ? "Getting GPS…" : (editForm.accessLat ? "Update access point GPS" : "Pin access point with GPS")}
              </button>
            </div>
          </div>

          <button
            data-testid="button-save-edit-loc"
            disabled={editLocMutation.isPending || !editForm.name.trim()}
            onClick={() => {
              if (!editLocId) return;
              const payload: Record<string, unknown> = {
                name: editForm.name.trim(),
                description: editForm.description.trim() || undefined,
                city: editForm.city.trim() || undefined,
                state: editForm.state.trim() || undefined,
                country: editForm.country.trim() || undefined,
              };
              if (editForm.latitude) payload.latitude = Number(editForm.latitude);
              if (editForm.longitude) payload.longitude = Number(editForm.longitude);
              if (editForm.accessLat && editForm.accessLng) {
                payload.accessLat = Number(editForm.accessLat);
                payload.accessLng = Number(editForm.accessLng);
              } else if (!editForm.accessLat) {
                payload.accessLat = null;
                payload.accessLng = null;
              }
              editLocMutation.mutate({ id: editLocId, data: payload });
            }}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-blue-950 font-bold text-sm transition-all active:scale-95"
          >
            {editLocMutation.isPending ? "Saving…" : "Save Changes"}
          </button>

          <button
            data-testid="button-owner-delete-loc"
            onClick={() => setOwnerDeleteConfirmId(editLocId)}
            className="w-full py-2.5 rounded-xl border border-red-600/40 bg-red-950/30 text-red-400 hover:bg-red-900/40 hover:text-red-300 font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove this location
          </button>
        </div>
      </div>
    )}

    {/* ── Owner delete confirmation ── */}
    {ownerDeleteConfirmId !== null && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-red-700/40 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/40 shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Remove Location</p>
              <p className="text-slate-400 text-[11px]">This cannot be undone</p>
            </div>
            <button onClick={() => setOwnerDeleteConfirmId(null)} className="ml-auto text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              Are you sure you want to permanently remove this location from the community map? Everyone who has saved or visited it will lose access to it.
            </p>
          </div>
          <div className="px-5 pb-5 flex flex-col gap-2">
            <button
              data-testid="button-confirm-owner-delete"
              onClick={() => { if (ownerDeleteConfirmId) ownerDeleteMutation.mutate(ownerDeleteConfirmId); }}
              disabled={ownerDeleteMutation.isPending}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
            >
              {ownerDeleteMutation.isPending ? "Removing…" : "Yes, remove it"}
            </button>
            <button onClick={() => setOwnerDeleteConfirmId(null)} className="w-full py-2 text-slate-500 text-xs hover:text-slate-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Verified Business Profile Modal ── */}
    {businessProfileId !== null && (() => {
      const biz = communityLocs.find((l) => l.id === businessProfileId);
      if (!biz) return null;
      const lat = biz.latitude ? Number(biz.latitude) : null;
      const lng = biz.longitude ? Number(biz.longitude) : null;
      const verified = biz.businessVerified;
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setBusinessProfileId(null)}
        >
          <div
            className={`w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border ${verified ? "border-yellow-600/40" : "border-blue-700/40"} rounded-3xl shadow-2xl overflow-y-auto max-h-[85vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${verified ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-blue-800/40 border border-blue-700/40"}`}>
                <Building2 className={`w-5 h-5 ${verified ? "text-yellow-400" : "text-blue-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-white font-bold text-base truncate">{biz.name}</h2>
                  {verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                      <BadgeCheck className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="text-[9px] bg-blue-800/60 border border-blue-600/50 text-blue-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">Unverified</span>
                  )}
                </div>
                <p className="text-blue-400 text-xs mt-0.5">
                  {verified
                    ? [biz.fullAddress, biz.city, biz.state].filter(Boolean).join(", ")
                    : [biz.city, biz.state].filter(Boolean).join(", ")}
                </p>
              </div>
              <button
                data-testid="button-close-biz-profile"
                onClick={() => setBusinessProfileId(null)}
                className="text-slate-500 hover:text-white transition-colors shrink-0 ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verified: full content */}
            {verified && (
              <div className="px-5 py-4 space-y-3 pb-2">
                {biz.description && (
                  <p className="text-slate-300 text-sm leading-relaxed">{biz.description}</p>
                )}
                {biz.modalities && biz.modalities.length > 0 && (
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5">Modalities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {biz.modalities.map((mod) => {
                        const option = MODALITY_OPTIONS.find((o) => o.label === mod);
                        return (
                          <span key={mod} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">
                            {option?.emoji} {mod}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {lat !== null && lng !== null && (
                    <button
                      data-testid="button-biz-directions"
                      onClick={() => openDirections(lat, lng)}
                      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/20 transition-all active:scale-[0.98]"
                    >
                      <Navigation className="w-4 h-4 shrink-0" /> Get Directions
                    </button>
                  )}
                  {biz.phone && (
                    <a href={`tel:${biz.phone}`} data-testid="link-biz-phone"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-blue-800/40 border border-blue-700/40 text-blue-200 text-sm hover:border-blue-500/60 transition-all">
                      <Phone className="w-4 h-4 text-blue-400 shrink-0" />{biz.phone}
                    </a>
                  )}
                  {biz.websiteUrl && (
                    <a href={biz.websiteUrl} target="_blank" rel="noopener noreferrer" data-testid="link-biz-website"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-blue-800/40 border border-blue-700/40 text-blue-200 text-sm hover:border-blue-500/60 transition-all">
                      <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" /> Website
                    </a>
                  )}
                  {biz.yelpUrl && (
                    <a href={biz.yelpUrl} target="_blank" rel="noopener noreferrer" data-testid="link-biz-yelp"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-red-900/20 border border-red-700/30 text-red-200 text-sm hover:border-red-500/40 transition-all">
                      <ExternalLink className="w-4 h-4 text-red-400 shrink-0" /> Yelp Reviews
                    </a>
                  )}
                  {biz.facebookUrl && (
                    <a href={biz.facebookUrl} target="_blank" rel="noopener noreferrer" data-testid="link-biz-facebook"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-blue-900/30 border border-blue-600/30 text-blue-200 text-sm hover:border-blue-500/40 transition-all">
                      <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" /> Facebook
                    </a>
                  )}
                  {biz.bookingUrl && (
                    <a href={biz.bookingUrl} target="_blank" rel="noopener noreferrer" data-testid="link-biz-booking"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-green-900/20 border border-green-700/30 text-green-200 text-sm font-semibold hover:border-green-500/40 transition-all">
                      <ExternalLink className="w-4 h-4 text-green-400 shrink-0" /> Book Appointment
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Unverified: frosted preview + CTA */}
            {!verified && (
              <div className="px-5 py-4 space-y-3 pb-2">
                <div className="relative">
                  {/* Frosted placeholder rows */}
                  <div className="space-y-2 blur-[3px] opacity-40 pointer-events-none select-none" aria-hidden="true">
                    <div className="h-10 rounded-xl bg-slate-700/60 border border-slate-600/40 w-full" />
                    <div className="flex flex-wrap gap-1.5">
                      {["Cold Plunge", "Sauna", "Float Tank"].map((m) => (
                        <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px]">{m}</span>
                      ))}
                    </div>
                    <div className="h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 w-full" />
                    <div className="h-10 rounded-xl bg-blue-800/40 border border-blue-700/40 w-full" />
                    <div className="h-10 rounded-xl bg-blue-800/40 border border-blue-700/40 w-3/4" />
                    <div className="h-10 rounded-xl bg-green-900/20 border border-green-700/30 w-full" />
                  </div>
                  {/* Gradient fade */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
                </div>
                {/* CTA — only visible to the listing owner */}
                {biz.isOwner && (
                  <button
                    data-testid={`button-upgrade-from-profile-${biz.id}`}
                    onClick={() => { setBusinessProfileId(null); setVerifyDialogLocId(biz.id); }}
                    className="w-full bg-gradient-to-br from-slate-900 to-blue-950 border border-yellow-600/50 rounded-xl p-3 flex items-center gap-3 active:scale-[0.99] transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                      <BadgeCheck className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-bold text-xs">Get Verified — 1st month free</p>
                      <p className="text-blue-400 text-[11px]">Show your full profile, links & booking</p>
                    </div>
                    <span className="text-yellow-400 text-xs font-bold shrink-0">Verify →</span>
                  </button>
                )}
              </div>
            )}

            {/* Footer: remove listing — only visible to the listing owner */}
            {biz.isOwner && (
              <div className="px-5 pb-6 border-t border-slate-800 pt-4 mt-2">
                <button
                  data-testid={`button-delete-biz-profile-${businessProfileId}`}
                  onClick={() => { setDeleteDialogLocId(businessProfileId); setDeleteEmail(""); setBusinessProfileId(null); }}
                  className="w-full py-2 text-red-500/60 hover:text-red-400 text-xs transition-colors"
                >
                  Remove this listing
                </button>
              </div>
            )}
          </div>
        </div>
      );
    })()}

    {/* ── Business Submission Form ── */}
    {showBusinessForm && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => { if (!submitBusinessMutation.isPending) { setShowBusinessForm(false); resetBizForm(); } }}
      >
        <div
          className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-yellow-600/30 rounded-t-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/40 shrink-0">
              <Building2 className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">List Your Business</p>
              <p className="text-slate-400 text-[11px]">Cold plunge facility, spa, or wellness center</p>
            </div>
            <button
              data-testid="button-close-biz-form"
              onClick={() => { setShowBusinessForm(false); resetBizForm(); }}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3 pb-8">
            {/* Tier selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="button-biz-tier-free"
                onClick={() => setBizTier("free")}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold text-left transition-all ${bizTier === "free" ? "bg-blue-700/40 border-blue-500/60 text-white" : "bg-blue-900/30 border-blue-700/30 text-blue-400 hover:border-blue-600/50"}`}
              >
                <div className="font-bold text-sm">Free</div>
                <div className="text-[10px] opacity-70 mt-0.5">Name + city shown</div>
              </button>
              <button
                data-testid="button-biz-tier-verified"
                onClick={() => setBizTier("verified")}
                className={`py-3 px-3 rounded-xl border text-xs font-semibold text-left transition-all ${bizTier === "verified" ? "bg-yellow-900/30 border-yellow-500/50 text-yellow-200" : "bg-blue-900/30 border-blue-700/30 text-blue-400 hover:border-yellow-700/40"}`}
              >
                <div className="flex items-center gap-1 font-bold text-sm">
                  <BadgeCheck className="w-3.5 h-3.5 text-yellow-400" /> Verified
                </div>
                <div className="text-[10px] opacity-70 mt-0.5">$29.99/mo · 1st month free</div>
              </button>
            </div>

            {bizTier === "verified" && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-3 space-y-1.5">
                <p className="text-yellow-300 text-xs font-semibold">Verified includes:</p>
                {["Gold badge + top placement in directory", "Full public profile with links & contact info", "Google Maps directions button", "Website, Yelp, Facebook & booking links", "1st month free — then $29.99/mo, cancel anytime"].map((b) => (
                  <div key={b} className="flex items-start gap-1.5 text-[11px] text-yellow-200/80">
                    <CheckCircle2 className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" /> {b}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Business Name *</label>
              <input
                data-testid="input-biz-name"
                value={bizForm.name}
                onChange={(e) => setBizForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cold Plunge Studio"
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">City *</label>
                <input
                  data-testid="input-biz-city"
                  value={bizForm.city}
                  onChange={(e) => setBizForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Austin"
                  className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
                />
              </div>
              <div>
                <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">State *</label>
                <input
                  data-testid="input-biz-state"
                  value={bizForm.state}
                  onChange={(e) => setBizForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="TX"
                  className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">
                Full Address{bizTier === "verified" ? " (shown on public profile)" : " (optional)"}
              </label>
              <input
                data-testid="input-biz-address"
                value={bizForm.fullAddress}
                onChange={(e) => setBizForm((f) => ({ ...f, fullAddress: e.target.value }))}
                placeholder="123 Main St"
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
              />
            </div>

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">About Your Business</label>
              <textarea
                data-testid="input-biz-description"
                value={bizForm.description}
                onChange={(e) => setBizForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe your facility, amenities, and cold plunge options…"
                rows={2}
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1.5">Modalities Offered</label>
              <div className="flex flex-wrap gap-2">
                {MODALITY_OPTIONS.map(({ label, emoji }) => {
                  const selected = bizModalities.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      data-testid={`chip-modality-${label.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => toggleModality(label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all active:scale-95 ${
                        selected
                          ? "bg-cyan-500/25 border-cyan-400/60 text-cyan-200"
                          : "bg-blue-900/40 border-blue-700/40 text-blue-400 hover:border-blue-500/60"
                      }`}
                    >
                      <span>{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Phone</label>
              <input
                data-testid="input-biz-phone"
                type="tel"
                value={bizForm.phone}
                onChange={(e) => setBizForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(512) 555-0100"
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
              />
            </div>

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Website</label>
              <input
                data-testid="input-biz-website"
                type="url"
                value={bizForm.websiteUrl}
                onChange={(e) => setBizForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://yourbusiness.com"
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
              />
            </div>

            {bizTier === "verified" && (
              <>
                <div>
                  <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Yelp URL</label>
                  <input
                    data-testid="input-biz-yelp"
                    type="url"
                    value={bizForm.yelpUrl}
                    onChange={(e) => setBizForm((f) => ({ ...f, yelpUrl: e.target.value }))}
                    placeholder="https://yelp.com/biz/your-business"
                    className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
                  />
                </div>
                <div>
                  <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Facebook URL</label>
                  <input
                    data-testid="input-biz-facebook"
                    type="url"
                    value={bizForm.facebookUrl}
                    onChange={(e) => setBizForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                    placeholder="https://facebook.com/your-business"
                    className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
                  />
                </div>
                <div>
                  <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Booking / Appointments URL</label>
                  <input
                    data-testid="input-biz-booking"
                    type="url"
                    value={bizForm.bookingUrl}
                    onChange={(e) => setBizForm((f) => ({ ...f, bookingUrl: e.target.value }))}
                    placeholder="https://book.yourscheduler.com"
                    className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Contact Email * <span className="text-blue-600 normal-case">(private — admin use only, never shown publicly)</span></label>
              <input
                data-testid="input-biz-email"
                type="email"
                value={bizForm.contactEmail}
                onChange={(e) => setBizForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="owner@yourbusiness.com"
                className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
              />
            </div>

            <button
              data-testid="button-biz-use-location"
              type="button"
              onClick={async () => {
                try {
                  const pos = await getPosition();
                  setBizGeoPos(pos);
                  toast({ title: "GPS attached", description: "Location pinned for map directions." });
                } catch {
                  toast({ title: "Location denied", description: "Enable location access to pin your spot.", variant: "destructive" });
                }
              }}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                bizGeoPos
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-blue-800/40 border-blue-700/40 text-blue-400 hover:text-white"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              {bizGeoPos ? "GPS attached ✓ (for map directions)" : "Pin my location (enables directions)"}
            </button>

            <p className="text-blue-600 text-[10px] leading-relaxed">
              By submitting, you confirm the information is accurate and you are authorized to represent this business. Contact email is used for administrative purposes only and is never displayed publicly.
            </p>

            <button
              data-testid="button-submit-business"
              onClick={handleBusinessSubmit}
              disabled={submitBusinessMutation.isPending || businessCheckoutMutation.isPending}
              className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all active:scale-[0.98]"
            >
              {submitBusinessMutation.isPending || businessCheckoutMutation.isPending
                ? "Processing…"
                : bizTier === "verified"
                ? "Continue to Payment →"
                : "List My Business for Free"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Delete Listing Dialog ── */}
    {deleteDialogLocId !== null && (() => {
      const deleteLoc = communityLocs.find((l) => l.id === deleteDialogLocId);
      const isAdminDelete = deleteLoc?.isAdmin ?? false;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-red-700/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/40 shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Remove Listing</p>
                <p className="text-slate-400 text-[11px]">{isAdminDelete ? "Admin action — cannot be undone" : "This cannot be undone"}</p>
              </div>
              <button
                onClick={() => { setDeleteDialogLocId(null); setDeleteEmail(""); }}
                className="ml-auto text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {isAdminDelete ? (
                <p className="text-slate-300 text-xs leading-relaxed">
                  Permanently delete <span className="text-white font-semibold">{deleteLoc?.name}</span>? This removes it for all users and cannot be undone. Consider hiding it temporarily instead.
                </p>
              ) : (
                <>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    To confirm you own this listing, enter the contact email you used when submitting it.
                  </p>
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Contact email</label>
                    <input
                      data-testid="input-delete-email"
                      type="email"
                      value={deleteEmail}
                      onChange={(e) => setDeleteEmail(e.target.value)}
                      placeholder="owner@yourbusiness.com"
                      className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-red-500 placeholder-slate-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                data-testid="button-confirm-delete-listing"
                onClick={() => {
                  if (isAdminDelete) {
                    deleteListingMutation.mutate({ locationId: deleteDialogLocId!, email: "" });
                  } else {
                    if (!deleteEmail.trim()) {
                      toast({ title: "Email required", description: "Enter the contact email used when submitting this listing.", variant: "destructive" });
                      return;
                    }
                    deleteListingMutation.mutate({ locationId: deleteDialogLocId!, email: deleteEmail.trim() });
                  }
                }}
                disabled={deleteListingMutation.isPending || (!isAdminDelete && !deleteEmail.trim())}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
              >
                {deleteListingMutation.isPending ? "Removing…" : "Remove listing"}
              </button>
              <button
                onClick={() => { setDeleteDialogLocId(null); setDeleteEmail(""); }}
                className="w-full py-2 text-slate-500 text-xs hover:text-slate-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {verifyDialogLocId !== null && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
        <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-yellow-600/40 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/40 shrink-0">
              <BadgeCheck className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Verified Business Listing</p>
              <p className="text-green-400 text-[11px] font-semibold">First month free · then $29.99/mo · cancel anytime</p>
            </div>
            <button
              onClick={() => { setVerifyDialogLocId(null); setVerifyEmail(""); }}
              className="ml-auto text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-slate-300 text-xs leading-relaxed">
              Stand out in ColdStreak's business directory and give customers everything they need to find and book you.
            </p>
            <ul className="space-y-2">
              {[
                "Gold ✓ Verified badge — pinned to the top of the directory",
                "Public profile: description, phone, website & social links",
                "Google Maps directions button on your listing",
                "Booking / appointment link shown to every viewer",
                "First month free — no charge for 30 days",
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-[11px] text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">
                Confirm ownership — enter the contact email used when you submitted this listing
              </label>
              <input
                data-testid="input-verify-email"
                type="email"
                value={verifyEmail}
                onChange={(e) => setVerifyEmail(e.target.value)}
                placeholder="owner@yourbusiness.com"
                className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-yellow-500 placeholder-slate-500"
              />
            </div>
          </div>
          <div className="px-5 pb-5 flex flex-col gap-2">
            <button
              data-testid="button-subscribe-business"
              onClick={() => {
                if (!verifyEmail.trim()) {
                  toast({ title: "Email required", description: "Enter the contact email used when submitting this listing.", variant: "destructive" });
                  return;
                }
                const id = verifyDialogLocId!;
                businessCheckoutMutation.mutate({ locationId: id, email: verifyEmail.trim() });
              }}
              disabled={businessCheckoutMutation.isPending || !verifyEmail.trim()}
              className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
            >
              {businessCheckoutMutation.isPending ? "Verifying…" : "Subscribe for $29.99/mo →"}
            </button>
            <button
              onClick={() => { setVerifyDialogLocId(null); setVerifyEmail(""); }}
              className="w-full py-2 text-slate-500 text-xs hover:text-slate-400 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    )}

  {/* ── Create Event Modal ── */}
  {showCreateModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-blue-950 to-slate-950 border border-blue-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-blue-800/50">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Create Event</p>
            <p className="text-blue-400 text-[11px]">Organize a community cold plunge</p>
          </div>
          <button onClick={() => setShowCreateModal(false)} className="ml-auto text-blue-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Event Name *</label>
            <input
              data-testid="input-event-name"
              type="text"
              value={evtName}
              onChange={(e) => setEvtName(e.target.value)}
              placeholder="Saturday Morning Plunge"
              className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
            />
          </div>
          <div>
            <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Date & Time *</label>
            <input
              data-testid="input-event-date"
              type="datetime-local"
              value={evtDate}
              onChange={(e) => setEvtDate(e.target.value)}
              className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Location Name (optional)</label>
            <input
              data-testid="input-event-location"
              type="text"
              value={evtLocationName}
              onChange={(e) => setEvtLocationName(e.target.value)}
              placeholder="Barton Springs Pool, Austin TX"
              className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500"
            />
          </div>

          {/* Plunge Spot GPS */}
          <div className="bg-blue-950/60 border border-blue-700/30 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-white text-xs font-semibold">📍 Plunge Spot</p>
              <p className="text-blue-500 text-[10px]">Pin the exact water entry point</p>
            </div>
            {evtPlungeGps ? (
              <div className="flex items-center gap-2">
                <p className="text-green-400 text-[11px] font-mono flex-1">{evtPlungeGps.lat.toFixed(5)}, {evtPlungeGps.lng.toFixed(5)}</p>
                <button onClick={() => setEvtPlungeGps(null)} className="text-blue-500 hover:text-red-400 text-[10px] transition-colors">✕ Clear</button>
              </div>
            ) : null}
            <button
              data-testid="button-event-plunge-gps"
              type="button"
              onClick={() => grabEventGps("plunge")}
              disabled={evtPlungeGpsLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-800/60 border border-blue-700/40 text-blue-300 text-xs font-semibold hover:border-blue-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {evtPlungeGpsLoading ? "Getting GPS…" : evtPlungeGps ? "Update plunge spot GPS" : "Pin plunge spot with GPS"}
            </button>
          </div>

          {/* Access / Parking GPS */}
          <div className="bg-blue-950/60 border border-blue-700/30 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-white text-xs font-semibold">🅿 Parking / Access Point</p>
              <p className="text-blue-500 text-[10px]">Trailhead, parking lot, or access gate — where directions navigate to</p>
            </div>
            {evtAccessGps ? (
              <div className="flex items-center gap-2">
                <p className="text-green-400 text-[11px] font-mono flex-1">{evtAccessGps.lat.toFixed(5)}, {evtAccessGps.lng.toFixed(5)}</p>
                <button onClick={() => setEvtAccessGps(null)} className="text-blue-500 hover:text-red-400 text-[10px] transition-colors">✕ Clear</button>
              </div>
            ) : null}
            <button
              data-testid="button-event-access-gps"
              type="button"
              onClick={() => grabEventGps("access")}
              disabled={evtAccessGpsLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-800/60 border border-blue-700/40 text-blue-300 text-xs font-semibold hover:border-blue-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {evtAccessGpsLoading ? "Getting GPS…" : evtAccessGps ? "Update access/parking GPS" : "Pin parking / access with GPS"}
            </button>
          </div>

          <div>
            <label className="text-blue-400 text-[11px] uppercase tracking-wide block mb-1">Description (optional)</label>
            <textarea
              data-testid="input-event-description"
              value={evtDescription}
              onChange={(e) => setEvtDescription(e.target.value)}
              placeholder="What to bring, carpool details, any notes…"
              rows={2}
              className="w-full bg-blue-900/60 border border-blue-700/40 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400 placeholder-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            data-testid="button-submit-event"
            onClick={() => { if (!evtName.trim() || !evtDate) { toast({ title: "Name and date required", variant: "destructive" }); return; } createEventMut.mutate(); }}
            disabled={createEventMut.isPending || !evtName.trim() || !evtDate}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {createEventMut.isPending ? "Creating…" : "Create Event ❄️"}
          </button>
          <button
            onClick={() => setShowCreateModal(false)}
            className="w-full py-2 text-blue-500 text-xs hover:text-blue-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}
    </>
  );
}
