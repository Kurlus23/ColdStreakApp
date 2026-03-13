import { useState, useCallback } from "react";

export type Difficulty = "cold" | "ice-bath" | "extreme" | "arctic";

export interface PassportLocation {
  id: string;
  name: string;
  country: string;
  state: string;
  flag: string;
  difficulty: Difficulty;
  description: string;
  tempRange: string;
  safetyNote: string;
  seasonal?: boolean;
  lat: number;
  lng: number;
}

export const DIFFICULTY_META: Record<Difficulty, { emoji: string; label: string; color: string; tempLabel: string }> = {
  "cold":     { emoji: "🥶",    label: "Cold",     color: "text-blue-300",   tempLabel: "~60°F" },
  "ice-bath": { emoji: "🧊",    label: "Ice Bath",  color: "text-cyan-400",   tempLabel: "~50°F" },
  "extreme":  { emoji: "❄️",    label: "Extreme",   color: "text-blue-400",   tempLabel: "~40°F" },
  "arctic":   { emoji: "🧊🧊", label: "Arctic",    color: "text-indigo-300", tempLabel: "~35°F" },
};

export const PASSPORT_LOCATIONS: PassportLocation[] = [
  // ── 🥶 Cold (~60°F+) ─────────────────────────────────────────────────────
  {
    id: "barton-springs-tx",
    name: "Barton Springs Pool",
    country: "USA", state: "Texas",
    flag: "🥶", difficulty: "cold",
    description: "3-acre spring-fed pool in Zilker Park, Austin. Crystal-clear 68–70°F water year-round — one of the best beginner plunges in the country.",
    tempRange: "68–70°F year-round",
    safetyNote: "Lifeguards on duty seasonally. Open year-round. Beginner-friendly.",
    lat: 30.2588, lng: -97.7717,
  },
  {
    id: "madison-blue-fl",
    name: "Madison Blue Spring",
    country: "USA", state: "Florida",
    flag: "🥶", difficulty: "cold",
    description: "First-magnitude spring discharging gin-clear 72°F water in North Florida. Beautiful visibility and easy, calm conditions.",
    tempRange: "72°F year-round",
    safetyNote: "State park with full facilities. Lifeguards. Year-round. Beginner-friendly.",
    lat: 30.4741, lng: -83.2421,
  },
  {
    id: "juniper-springs-fl",
    name: "Juniper Springs",
    country: "USA", state: "Florida",
    flag: "🥶", difficulty: "cold",
    description: "One of the oldest swimming areas on the East Coast inside Ocala National Forest. Consistently clear and calm.",
    tempRange: "68–72°F year-round",
    safetyNote: "Full facilities, year-round access. Family-friendly. Calm water.",
    lat: 29.1839, lng: -81.7130,
  },
  {
    id: "devils-den-fl",
    name: "Devil's Den",
    country: "USA", state: "Florida",
    flag: "🥶", difficulty: "cold",
    description: "Ancient underground spring cavern in Williston — stunning blue water with constant 70°F temperature all year.",
    tempRange: "70°F year-round",
    safetyNote: "Supervised facility. Year-round. Shallow area for beginners available.",
    lat: 29.4769, lng: -82.5435,
  },
  {
    id: "walden-pond-ma",
    name: "Walden Pond",
    country: "USA", state: "Massachusetts",
    flag: "🥶", difficulty: "cold",
    description: "The legendary glacial kettle pond made famous by Thoreau. Beloved year-round swimming hole with a long cold plunge tradition.",
    tempRange: "65–72°F (summer), 33–40°F (winter)",
    safetyNote: "State reservation with lifeguards in summer. Busy on weekends. No diving.",
    seasonal: true,
    lat: 42.4378, lng: -71.3418,
  },
  {
    id: "mirror-lake-ny",
    name: "Mirror Lake",
    country: "USA", state: "New York",
    flag: "🥶", difficulty: "cold",
    description: "Pristine glacial lake in the heart of Lake Placid village. Famous for the annual Mirror Lake Plunge each January.",
    tempRange: "65–72°F (summer), 32–40°F (winter)",
    safetyNote: "Public access from downtown Lake Placid. Supervised events in winter. Calm water.",
    lat: 44.2795, lng: -73.9823,
  },
  {
    id: "blue-hole-nm",
    name: "Santa Rosa Blue Hole",
    country: "USA", state: "New Mexico",
    flag: "🥶", difficulty: "cold",
    description: "80-foot-deep artesian well on Route 66 — impossibly clear and always 61°F. A desert oasis beloved by divers and plungers alike.",
    tempRange: "61°F year-round",
    safetyNote: "Calm water, easy access. Year-round. Popular scuba training site.",
    lat: 34.9403, lng: -104.6720,
  },
  {
    id: "havasu-falls-az",
    name: "Havasu Falls",
    country: "USA", state: "Arizona",
    flag: "🥶", difficulty: "cold",
    description: "One of the most photographed waterfalls on Earth — a 100-foot cascade of turquoise water on Havasupai tribal land in the Grand Canyon.",
    tempRange: "~70°F (spring-fed)",
    safetyNote: "Permit required well in advance. 10-mile hike in. Flash flood risk. Book permits up to a year early.",
    lat: 36.2551, lng: -112.6976,
  },

  // ── 🧊 Ice Bath (~50°F) ──────────────────────────────────────────────────
  {
    id: "sliding-rock-nc",
    name: "Sliding Rock",
    country: "USA", state: "North Carolina",
    flag: "🧊", difficulty: "ice-bath",
    description: "Natural 60-foot waterslide in Pisgah National Forest with 11,000 gallons per minute of 50–60°F mountain water.",
    tempRange: "50–60°F",
    safetyNote: "Lifeguards Memorial Day–Labor Day only. Best May–September.",
    seasonal: true,
    lat: 35.2218, lng: -82.8356,
  },
  {
    id: "midnight-hole-tn",
    name: "Midnight Hole",
    country: "USA", state: "Tennessee",
    flag: "🧊", difficulty: "ice-bath",
    description: "A deep, shadowed plunge pool on Big Creek in Great Smoky Mountains NP. Cold mountain water and an emerald-green hue.",
    tempRange: "50–62°F",
    safetyNote: "Hike required (~1 mile). No lifeguards. Check water levels before visiting.",
    lat: 35.7492, lng: -83.1036,
  },
  {
    id: "the-sinks-tn",
    name: "The Sinks",
    country: "USA", state: "Tennessee",
    flag: "🧊", difficulty: "ice-bath",
    description: "Where the Little River suddenly disappears underground before reappearing as a cold, swirling pool in the Smokies.",
    tempRange: "50–60°F",
    safetyNote: "Strong currents possible. No lifeguards. Enter with caution — water is deceptive.",
    lat: 35.6298, lng: -83.5098,
  },
  {
    id: "warren-falls-vt",
    name: "Warren Falls",
    country: "USA", state: "Vermont",
    flag: "🧊", difficulty: "ice-bath",
    description: "Vermont's most popular swimming hole — a series of cascades and deep pools on the Mad River with cold Green Mountain water.",
    tempRange: "52–62°F",
    safetyNote: "Slippery rocks. No lifeguards. Best June–September. Can get crowded on weekends.",
    seasonal: true,
    lat: 44.1162, lng: -72.8445,
  },
  {
    id: "bingham-falls-vt",
    name: "Bingham Falls",
    country: "USA", state: "Vermont",
    flag: "🧊", difficulty: "ice-bath",
    description: "A hidden 40-foot gorge waterfall near Stowe with frigid pools. One of Vermont's most dramatic cold swimming spots.",
    tempRange: "48–58°F",
    safetyNote: "Short hike required. Wet rocks are extremely slippery. No jumping from ledges.",
    seasonal: true,
    lat: 44.5245, lng: -72.7779,
  },
  {
    id: "slide-rock-az",
    name: "Slide Rock State Park",
    country: "USA", state: "Arizona",
    flag: "🧊", difficulty: "ice-bath",
    description: "A natural 80-foot red rock waterslide carved by Oak Creek in Sedona — one of Arizona's most beloved outdoor swimming spots.",
    tempRange: "50–65°F",
    safetyNote: "Rocks are extremely slippery. No jumping. Crowded on summer weekends. Pay parking required.",
    seasonal: true,
    lat: 34.9626, lng: -111.7533,
  },
  {
    id: "devils-punchbowl-ca",
    name: "Devil's Punchbowl",
    country: "USA", state: "California",
    flag: "🧊", difficulty: "ice-bath",
    description: "A dramatic geological formation in the San Gabriel Mountains — a deep natural bowl carved by earthquake faults with cold, shadowed pools.",
    tempRange: "45–58°F",
    safetyNote: "Steep terrain. No lifeguards. Flash flood risk in the canyon bottom. Check weather before visiting.",
    lat: 34.3888, lng: -117.6981,
  },

  // ── ❄️ Extreme (~40°F) ───────────────────────────────────────────────────
  {
    id: "lake-tahoe-ca",
    name: "Lake Tahoe",
    country: "USA", state: "California",
    flag: "❄️", difficulty: "extreme",
    description: "One of North America's most stunning alpine lakes at 6,225 ft elevation. Startlingly clear and cold — a serious test even in summer.",
    tempRange: "41–55°F (summer surface), 39°F (winter)",
    safetyNote: "Cold shock risk is real at depth. Stay near shore. Altitude may affect stamina.",
    lat: 39.0968, lng: -120.0324,
  },
  {
    id: "jenny-lake-wy",
    name: "Jenny Lake",
    country: "USA", state: "Wyoming",
    flag: "❄️", difficulty: "extreme",
    description: "Glacially carved lake at the foot of the Teton Range. Breathtaking scenery and bone-chilling snowmelt water.",
    tempRange: "40–52°F (summer)",
    safetyNote: "Cold shock hazard. Strong swimmers only. No lifeguards. Altitude ~6,783 ft.",
    lat: 43.7580, lng: -110.7277,
  },
  {
    id: "lake-mcdonald-mt",
    name: "Lake McDonald",
    country: "USA", state: "Montana",
    flag: "❄️", difficulty: "extreme",
    description: "Glacier National Park's largest lake — glacier-fed, strikingly clear, and lined with colorful stones. Cold water guaranteed.",
    tempRange: "38–50°F (summer)",
    safetyNote: "No lifeguards. Cold shock possible. Hypothermia risk for extended swims.",
    lat: 48.5763, lng: -113.9088,
  },
  {
    id: "lake-crescent-wa",
    name: "Lake Crescent",
    country: "USA", state: "Washington",
    flag: "❄️", difficulty: "extreme",
    description: "Deep glacial lake in Olympic National Park with legendary clarity — you can see 60 feet down. Permanently cold from depth.",
    tempRange: "40–52°F (summer surface)",
    safetyNote: "Deep and cold — hypothermia risk. Strong swimmers only. No lifeguards.",
    lat: 48.0598, lng: -123.7963,
  },
  {
    id: "franklin-falls-wa",
    name: "Franklin Falls",
    country: "USA", state: "Washington",
    flag: "❄️", difficulty: "extreme",
    description: "Washington's most visited waterfall — a 70-foot cascade with a frigid plunge basin fed by Cascades snowmelt.",
    tempRange: "40–48°F",
    safetyNote: "Easy 1-mile hike. Waterfall basin is powerful — stay back from the base.",
    lat: 47.5173, lng: -121.5153,
  },
  {
    id: "crater-lake-or",
    name: "Crater Lake",
    country: "USA", state: "Oregon",
    flag: "❄️", difficulty: "extreme",
    description: "The deepest lake in the US, formed inside a collapsed volcano. Impossibly blue and extremely cold — an iconic American bucket-list plunge.",
    tempRange: "38–55°F (summer surface)",
    safetyNote: "Access via Cleetwood Cove Trail only (steep). No lifeguards. Cold shock hazard. Very high altitude (6,178 ft).",
    lat: 42.9446, lng: -122.1090,
  },

  // ── 🧊🧊 Arctic (~35°F) ──────────────────────────────────────────────────
  {
    id: "tamolitch-pool-or",
    name: "Tamolitch Blue Pool",
    country: "USA", state: "Oregon",
    flag: "🧊🧊", difficulty: "arctic",
    description: "Oregon's most surreal natural pool — the McKenzie River reappears from underground in a perfect blue bowl. Glacial cold, jaw-dropping beauty.",
    tempRange: "34–38°F year-round",
    safetyNote: "4-mile round trip hike required. Water is near-freezing — serious cold shock and hypothermia risk. Expert level only.",
    lat: 44.2485, lng: -121.9874,
  },
  {
    id: "lake-superior-mn",
    name: "Lake Superior",
    country: "USA", state: "Minnesota",
    flag: "🧊🧊", difficulty: "arctic",
    description: "The largest of the Great Lakes — its sheer size keeps it cold year-round. A beloved winter plunge tradition in Duluth and along the North Shore.",
    tempRange: "34–55°F (varies by season and location)",
    safetyNote: "Rip currents and waves possible. Never swim alone. Water is cold enough for hypothermia even in summer.",
    lat: 47.7325, lng: -90.3318,
  },
  {
    id: "emerald-pools-ca",
    name: "Emerald Pools",
    country: "USA", state: "California",
    flag: "🧊🧊", difficulty: "arctic",
    description: "The emerald-colored pools along the Mist Trail in Yosemite Valley — fed by snowmelt off Half Dome. Stunning and brutally cold.",
    tempRange: "36–45°F",
    safetyNote: "Access requires Mist Trail hike. Water is fast-moving — stay in calm pools only. Drowning risk near falls.",
    lat: 37.7331, lng: -119.5441,
  },
];

// State badges — emoji per state that has passport locations
export const STATE_EMOJI: Record<string, string> = {
  "Texas":             "🤠",
  "Florida":           "🌴",
  "Massachusetts":     "🦞",
  "New York":          "🗽",
  "New Mexico":        "☀️",
  "North Carolina":    "🏖️",
  "Tennessee":         "🎵",
  "Vermont":           "🍁",

  "Wyoming":           "🦅",
  "Montana":           "🦌",
  "Washington":        "🌧️",
  "Oregon":            "🦫",
  "Minnesota":         "🎣",
  "California":        "🌅",
  "Arizona":           "🌵",
};

// Tier mastery — completing all spots in a tier earns this award (used by Explore/passport location UI)
export const TIER_MASTER_META: Record<Difficulty, { title: string; award: string }> = {
  "cold":     { title: "Cold Seeker",   award: "All Cold spots completed" },
  "ice-bath": { title: "Ice Bather",    award: "All Ice Bath spots completed" },
  "extreme":  { title: "Extremist",     award: "All Extreme spots completed" },
  "arctic":   { title: "Arctic Wolf",   award: "All Arctic spots completed" },
};

// Days-plunged milestone badges — earned by reaching a total unique days plunged count
export interface DaysTier {
  id: string;
  label: string;
  emoji: string;
  days: number; // days required (365 means 365+)
}

export const DAYS_TIERS: DaysTier[] = [
  { id: "first-frost",   label: "First Frost",   emoji: "🌬️",  days: 7   },
  { id: "cold-habit",    label: "Cold Habit",    emoji: "💎",  days: 21  },
  { id: "frost-seeker",  label: "Frost Seeker",  emoji: "🧭",  days: 45  },
  { id: "penguin",       label: "Penguin",       emoji: "🐧",  days: 75  },
  { id: "polar-bear",    label: "Polar Bear",    emoji: "🐻‍❄️", days: 120 },
  { id: "blue-yeti",     label: "Abominable Snowman", emoji: "🐾",  days: 180 },
  { id: "ice-baron",     label: "Ice Baron",     emoji: "👑",  days: 270 },
  { id: "shiva",         label: "Shiva",         emoji: "🔱",  days: 365 },
];

// Temperature-based tier badges — earned by logging a plunge in each temp range
export interface TempTier {
  id: string;
  label: string;
  emoji: string;
  minTemp: number;
  maxTemp: number;
  description: string;
}

export const TEMP_TIERS: TempTier[] = [
  {
    id: "initiate",
    label: "Initiate",
    emoji: "🌊",
    minTemp: 50,
    maxTemp: 60,
    description: "Log a plunge at 60–50°F",
  },
  {
    id: "cold-blooded",
    label: "Cold Blooded",
    emoji: "❄️",
    minTemp: 40,
    maxTemp: 49,
    description: "Log a plunge at 49–40°F",
  },
  {
    id: "frosty",
    label: "Frosty",
    emoji: "⛄",
    minTemp: 33,
    maxTemp: 39,
    description: "Log a plunge at 39–33°F",
  },
  {
    id: "ice-breaker",
    label: "Ice Breaker",
    emoji: "🧊",
    minTemp: 0,
    maxTemp: 32,
    description: "Log a plunge at 32°F or below",
  },
];

/** Returns state names where every passport location in that state has been earned. */
export function computeStateBadges(earnedIds: Set<string>): string[] {
  const byState: Record<string, string[]> = {};
  for (const loc of PASSPORT_LOCATIONS) {
    (byState[loc.state] ??= []).push(loc.id);
  }
  return Object.entries(byState)
    .filter(([, ids]) => ids.every((id) => earnedIds.has(id)))
    .map(([state]) => state);
}

/** Returns difficulty tiers where every passport location in that tier has been earned. */
export function computeTierBadges(earnedIds: Set<string>): Difficulty[] {
  const byTier: Record<Difficulty, string[]> = {
    "cold": [], "ice-bath": [], "extreme": [], "arctic": [],
  };
  for (const loc of PASSPORT_LOCATIONS) byTier[loc.difficulty].push(loc.id);
  return (Object.keys(byTier) as Difficulty[]).filter(
    (tier) => byTier[tier].length > 0 && byTier[tier].every((id) => earnedIds.has(id))
  );
}

const STORAGE_KEY = "coldstreak-badges";

export function usePassportBadges() {
  const [badges, setBadges] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const awardBadge = useCallback((locationId: string) => {
    setBadges((prev) => {
      if (prev.has(locationId)) return prev;
      const next = new Set(prev);
      next.add(locationId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const hasBadge = useCallback(
    (locationId: string) => badges.has(locationId),
    [badges]
  );

  return { badges, awardBadge, hasBadge };
}

// Haversine distance in miles
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
