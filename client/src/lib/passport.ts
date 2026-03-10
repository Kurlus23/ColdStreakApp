import { useState, useCallback } from "react";

export interface PassportLocation {
  id: string;
  name: string;
  country: string;
  state?: string;
  flag: string;
  description: string;
  tempRange: string;
  safetyNote: string;
  seasonal?: boolean;
  lat: number;
  lng: number;
}

export const PASSPORT_LOCATIONS: PassportLocation[] = [
  // ── International ──────────────────────────────────────────────────────────
  {
    id: "silfra-iceland",
    name: "Silfra Fissure",
    country: "Iceland",
    flag: "🇮🇸",
    description: "Snorkel between two tectonic plates in glacier-filtered water.",
    tempRange: "2–4°C / 36–39°F",
    safetyNote: "Wetsuit required. Guided tours only. Not suitable for beginners.",
    lat: 64.2563, lng: -20.6868,
  },
  {
    id: "sky-lagoon-iceland",
    name: "Sky Lagoon",
    country: "Iceland",
    flag: "🇮🇸",
    description: "Glacier cold plunge pool with dramatic Atlantic Ocean views.",
    tempRange: "~5°C / 41°F",
    safetyNote: "Staffed facility with full amenities. Beginner-friendly.",
    lat: 63.8929, lng: -22.3968,
  },
  {
    id: "oslo-fjord-norway",
    name: "Oslo Fjord Saunas",
    country: "Norway",
    flag: "🇳🇴",
    description: "Jump from floating saunas into the Oslo Fjord — a Nordic tradition.",
    tempRange: "2–10°C / 36–50°F (seasonal)",
    safetyNote: "Staffed facilities. Cold shock risk in winter — enter slowly.",
    lat: 59.9139, lng: 10.7522,
  },
  {
    id: "varanger-norway",
    name: "Varanger Arctic Ice Hole",
    country: "Norway",
    flag: "🇳🇴",
    description: "Ice hole cut daily in a frozen mountain lake with Northern Lights views.",
    tempRange: "~0°C / 32°F",
    safetyNote: "Guided experience only. Extreme cold — not for beginners.",
    lat: 70.3730, lng: 28.9600,
  },
  {
    id: "verzasca-switzerland",
    name: "Verzasca River",
    country: "Switzerland",
    flag: "🇨🇭",
    description: "Crystal-clear alpine gorge pools carved through emerald granite.",
    tempRange: "8–14°C / 46–57°F",
    safetyNote: "Current can be strong. Swim in calm pools only, not the main channel.",
    lat: 46.2630, lng: 8.8040,
  },
  {
    id: "bondi-icebergs-australia",
    name: "Bondi Icebergs Pool",
    country: "Australia",
    flag: "🇦🇺",
    description: "Iconic ocean pool on Bondi Beach — waves crash over the edge in winter.",
    tempRange: "14–18°C / 57–65°F",
    safetyNote: "Lifeguards on duty. Beginner-friendly. Open year-round.",
    lat: -33.8947, lng: 151.2760,
  },
  {
    id: "baikal-russia",
    name: "Lake Baikal",
    country: "Russia",
    flag: "🇷🇺",
    description: "World's deepest lake — a sacred winter plunge tradition in Siberia.",
    tempRange: "0–2°C / 32–36°F",
    safetyNote: "Extreme cold. Only attempt with experienced local guides.",
    lat: 53.5587, lng: 108.165,
  },

  // ── USA – Safe Year-Round Locations ────────────────────────────────────────
  {
    id: "barton-springs-tx",
    name: "Barton Springs Pool",
    country: "USA",
    state: "Texas",
    flag: "🇺🇸",
    description: "3-acre spring-fed pool in Zilker Park, Austin — crystal clear, constant temp.",
    tempRange: "20–21°C / 68–70°F",
    safetyNote: "Lifeguards on duty seasonally. Open year-round. Beginner-friendly.",
    lat: 30.2588, lng: -97.7717,
  },
  {
    id: "blue-hole-nm",
    name: "Santa Rosa Blue Hole",
    country: "USA",
    state: "New Mexico",
    flag: "🇺🇸",
    description: "80-foot-deep artesian well on Route 66 — impossibly clear and always cold.",
    tempRange: "16°C / 61–62°F",
    safetyNote: "Calm water, easy access. Year-round. Popular scuba training site.",
    lat: 34.9403, lng: -104.6720,
  },
  {
    id: "madison-blue-fl",
    name: "Madison Blue Spring",
    country: "USA",
    state: "Florida",
    flag: "🇺🇸",
    description: "First-magnitude spring discharging gin-clear 72°F water in North Florida.",
    tempRange: "22°C / 72°F",
    safetyNote: "State park with full facilities. Lifeguards. Year-round. Beginner-friendly.",
    lat: 30.4741, lng: -83.2421,
  },
  {
    id: "juniper-springs-fl",
    name: "Juniper Springs",
    country: "USA",
    state: "Florida",
    flag: "🇺🇸",
    description: "One of the oldest swimming areas on the East Coast — Ocala National Forest.",
    tempRange: "20°C / 68°F",
    safetyNote: "Full facilities, year-round access. Family-friendly. Calm water.",
    lat: 29.1839, lng: -81.7130,
  },
  {
    id: "devils-den-fl",
    name: "Devil's Den",
    country: "USA",
    state: "Florida",
    flag: "🇺🇸",
    description: "Ancient underground spring cave — constant cool temps and stunning blue water.",
    tempRange: "21°C / 70°F",
    safetyNote: "Supervised facility, year-round. Shallow area for beginners available.",
    lat: 29.4769, lng: -82.5435,
  },
  {
    id: "sliding-rock-nc",
    name: "Sliding Rock",
    country: "USA",
    state: "North Carolina",
    flag: "🇺🇸",
    description: "Natural waterslide in Pisgah National Forest — 11,000 gallons/minute.",
    tempRange: "10–15°C / 50–60°F",
    safetyNote: "Lifeguards Memorial Day–Labor Day only. Best May–September.",
    seasonal: true,
    lat: 35.2218, lng: -82.8356,
  },
];

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
