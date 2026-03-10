import { useState, useCallback } from "react";

export interface PassportLocation {
  id: string;
  name: string;
  country: string;
  flag: string;
  description: string;
  tempRange: string;
  safetyNote: string;
  seasonal?: boolean;
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
  },
  {
    id: "sky-lagoon-iceland",
    name: "Sky Lagoon",
    country: "Iceland",
    flag: "🇮🇸",
    description: "Glacier cold plunge pool with dramatic Atlantic Ocean views.",
    tempRange: "~5°C / 41°F",
    safetyNote: "Staffed facility with full amenities. Beginner-friendly.",
  },
  {
    id: "oslo-fjord-norway",
    name: "Oslo Fjord Saunas",
    country: "Norway",
    flag: "🇳🇴",
    description: "Jump from floating saunas into the Oslo Fjord — a Nordic tradition.",
    tempRange: "2–10°C / 36–50°F (seasonal)",
    safetyNote: "Staffed facilities. Cold shock risk in winter — enter slowly.",
  },
  {
    id: "varanger-norway",
    name: "Varanger Arctic Ice Hole",
    country: "Norway",
    flag: "🇳🇴",
    description: "Ice hole cut daily in a frozen mountain lake with Northern Lights views.",
    tempRange: "~0°C / 32°F",
    safetyNote: "Guided experience only. Extreme cold — not for beginners.",
  },
  {
    id: "verzasca-switzerland",
    name: "Verzasca River",
    country: "Switzerland",
    flag: "🇨🇭",
    description: "Crystal-clear alpine gorge pools carved through emerald granite.",
    tempRange: "8–14°C / 46–57°F",
    safetyNote: "Current can be strong. Swim in calm pools only, not the main channel.",
  },
  {
    id: "bondi-icebergs-australia",
    name: "Bondi Icebergs Pool",
    country: "Australia",
    flag: "🇦🇺",
    description: "Iconic ocean pool on Bondi Beach — waves crash over the edge in winter.",
    tempRange: "14–18°C / 57–65°F",
    safetyNote: "Lifeguards on duty. Beginner-friendly. Open year-round.",
  },
  {
    id: "baikal-russia",
    name: "Lake Baikal",
    country: "Russia",
    flag: "🇷🇺",
    description: "World's deepest lake — a sacred winter plunge tradition in Siberia.",
    tempRange: "0–2°C / 32–36°F",
    safetyNote: "Extreme cold. Only attempt with experienced local guides.",
  },

  // ── USA – Safe Year-Round Locations ────────────────────────────────────────
  {
    id: "barton-springs-tx",
    name: "Barton Springs Pool",
    country: "USA",
    flag: "🇺🇸",
    description: "3-acre spring-fed pool in Zilker Park, Austin — crystal clear, constant temp.",
    tempRange: "20–21°C / 68–70°F",
    safetyNote: "Lifeguards on duty seasonally. Open year-round. Beginner-friendly.",
  },
  {
    id: "blue-hole-nm",
    name: "Santa Rosa Blue Hole",
    country: "USA",
    flag: "🇺🇸",
    description: "80-foot-deep artesian well on Route 66 — impossibly clear and always cold.",
    tempRange: "16°C / 61–62°F",
    safetyNote: "Calm water, easy access. Year-round. Popular scuba training site.",
  },
  {
    id: "madison-blue-fl",
    name: "Madison Blue Spring",
    country: "USA",
    flag: "🇫🇱",
    description: "First-magnitude spring discharging gin-clear 72°F water in North Florida.",
    tempRange: "22°C / 72°F",
    safetyNote: "State park with full facilities. Lifeguards. Year-round. Beginner-friendly.",
  },
  {
    id: "juniper-springs-fl",
    name: "Juniper Springs",
    country: "USA",
    flag: "🇺🇸",
    description: "One of the oldest swimming areas on the East Coast — Ocala National Forest.",
    tempRange: "20°C / 68°F",
    safetyNote: "Full facilities, year-round access. Family-friendly. Calm water.",
  },
  {
    id: "devils-den-fl",
    name: "Devil's Den",
    country: "USA",
    flag: "🇺🇸",
    description: "Ancient underground spring cave — constant cool temps and stunning blue water.",
    tempRange: "21°C / 70°F",
    safetyNote: "Supervised facility, year-round. Shallow area for beginners available.",
  },
  {
    id: "sliding-rock-nc",
    name: "Sliding Rock",
    country: "USA",
    flag: "🇺🇸",
    description: "Natural waterslide in Pisgah National Forest — 11,000 gallons/minute.",
    tempRange: "10–15°C / 50–60°F",
    safetyNote: "Lifeguards Memorial Day–Labor Day only. Best May–September.",
    seasonal: true,
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
