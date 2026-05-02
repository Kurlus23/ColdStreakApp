import { useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Eye, Snowflake, MapPin, Phone, Globe, Calendar, Navigation,
  ExternalLink, Trophy, Clock, Loader2, BadgeCheck, ArrowLeft, Share2,
} from "lucide-react";
import { SiYelp, SiFacebook } from "react-icons/si";
import type { BusinessHours, DayKey } from "@shared/schema";
import { DAY_KEYS } from "@shared/schema";

interface PublicBiz {
  id: number;
  slug: string | null;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  fullAddress: string | null;
  description: string | null;
  modalities: string[] | null;
  websiteUrl: string | null;
  phone: string | null;
  yelpUrl: string | null;
  facebookUrl: string | null;
  bookingUrl: string | null;
  latitude: string | null;
  longitude: string | null;
  hours: BusinessHours | null;
  timezone: string | null;
  viewCount: number;
  leaderboard: Array<{ username: string; bestScore: number; plungeCount: number; lastPlungeAt: string }>;
}

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

// JS getDay() → mon=1, sun=0. Map to our DayKey.
function todayKey(): DayKey {
  const d = new Date().getDay();
  return (["sun","mon","tue","wed","thu","fri","sat"] as DayKey[])[d];
}

// Compute hour/minute/weekday in a target IANA timezone (or viewer's local TZ
// when timezone is null). Uses Intl.DateTimeFormat — supported in all modern
// browsers and on iOS WebKit / Capacitor.
function nowInTimezone(timezone: string | null): { minutesOfDay: number; weekdayIdx: number } {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false };
  if (timezone) opts.timeZone = timezone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(new Date());
  } catch {
    // Invalid timezone string → fall back to viewer's local time.
    parts = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date());
  }
  let h = 0, m = 0, weekday = "Sun";
  for (const p of parts) {
    if (p.type === "hour") h = parseInt(p.value, 10) % 24;
    else if (p.type === "minute") m = parseInt(p.value, 10);
    else if (p.type === "weekday") weekday = p.value;
  }
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minutesOfDay: h * 60 + m, weekdayIdx: map[weekday] ?? 0 };
}

// Today + previous-day overnight check: if a business closes after midnight
// (e.g. open 22:00–02:00), we also consider whether yesterday's window is
// still active right now. Times are interpreted in the listing's configured
// timezone when set, otherwise the viewer's local TZ.
function isOpenNow(hours: BusinessHours | null, timezone: string | null): { open: boolean; label: string } {
  if (!hours) return { open: false, label: "Hours not set" };
  const order: DayKey[] = ["sun","mon","tue","wed","thu","fri","sat"];
  const { minutesOfDay: cur, weekdayIdx: todayIdx } = nowInTimezone(timezone);
  const yesterdayIdx = (todayIdx + 6) % 7;
  const today = hours[order[todayIdx]];
  const yesterday = hours[order[yesterdayIdx]];

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  void cur; // (kept above for clarity)
  // 1. Yesterday's window if it crossed midnight and we're still inside it.
  if (yesterday && !yesterday.closed) {
    const yOpen = toMinutes(yesterday.open);
    const yClose = toMinutes(yesterday.close);
    if (yClose <= yOpen) {
      // overnight; today portion = [0, yClose)
      if (cur < yClose) return { open: true, label: `Open until ${yesterday.close}` };
    }
  }

  // 2. Today's window.
  if (!today || today.closed) return { open: false, label: "Closed today" };
  const tOpen = toMinutes(today.open);
  const tClose = toMinutes(today.close);
  if (tClose <= tOpen) {
    // overnight: open from tOpen to 24:00 today, plus 0..tClose tomorrow
    if (cur >= tOpen) return { open: true, label: `Open until ${today.close} (tomorrow)` };
    if (cur < tClose) return { open: true, label: `Open until ${today.close}` };
    return { open: false, label: `Opens at ${today.open}` };
  }
  if (cur >= tOpen && cur < tClose) return { open: true, label: `Open until ${today.close}` };
  if (cur < tOpen) return { open: false, label: `Opens at ${today.open}` };
  return { open: false, label: "Closed" };
}

function trackPublicClick(id: number, kind: string) {
  try {
    fetch(`/api/community-locations/${id}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

export default function BusinessProfile() {
  const [, params] = useRoute<{ slug: string }>("/biz/:slug");
  const slug = params?.slug ?? "";

  const { data: biz, isLoading, error } = useQuery<PublicBiz>({
    queryKey: ["/api/biz", slug],
    queryFn: async () => {
      const r = await fetch(`/api/biz/${encodeURIComponent(slug)}`);
      if (!r.ok) throw new Error(`biz ${r.status}`);
      return r.json();
    },
    enabled: !!slug,
  });

  // Track public profile view (fire-and-forget)
  useEffect(() => {
    if (!biz?.id) return;
    fetch(`/api/community-locations/${biz.id}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [biz?.id]);

  // SEO: set page title, meta description, and open-graph tags. Most social
  // crawlers (Facebook, Slack, Discord, etc.) get server-rendered tags via the
  // /biz/:slug Express handler — these client-side tags are a fallback for any
  // crawler that does execute JS.
  useEffect(() => {
    if (!biz) return;
    const prevTitle = document.title;
    const title = `${biz.name} · Cold Plunge Spot · ColdStreak`;
    document.title = title;
    const desc = biz.description?.slice(0, 155)
      ?? `Cold plunge spot in ${[biz.city, biz.state].filter(Boolean).join(", ") || biz.country}. Track your plunges with ColdStreak.`;

    const upsertMeta = (selector: string, attrName: string, attrValue: string, content: string) => {
      let m = document.head.querySelector(selector) as HTMLMetaElement | null;
      const created = !m;
      if (!m) {
        m = document.createElement("meta");
        m.setAttribute(attrName, attrValue);
        document.head.appendChild(m);
      }
      const prev = m.content;
      m.content = content;
      return { el: m, prev, created };
    };

    const ogImage = `${window.location.origin}/api/og/biz/${biz.slug}.svg`;
    const ogUrl = window.location.href;
    const tags = [
      upsertMeta('meta[name="description"]', "name", "description", desc),
      upsertMeta('meta[property="og:type"]', "property", "og:type", "website"),
      upsertMeta('meta[property="og:title"]', "property", "og:title", title),
      upsertMeta('meta[property="og:description"]', "property", "og:description", desc),
      upsertMeta('meta[property="og:url"]', "property", "og:url", ogUrl),
      upsertMeta('meta[property="og:image"]', "property", "og:image", ogImage),
      upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image"),
      upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title),
      upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc),
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", ogImage),
    ];

    return () => {
      document.title = prevTitle;
      for (const t of tags) {
        if (t.created) t.el.remove();
        else t.el.content = t.prev;
      }
    };
  }, [biz]);

  const openNow = useMemo(() => isOpenNow(biz?.hours ?? null, biz?.timezone ?? null), [biz?.hours, biz?.timezone]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-blue-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (error || !biz) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center text-white p-6">
        <p className="text-lg font-bold mb-2">Listing not found</p>
        <p className="text-blue-400 text-sm mb-4">This business profile may have been removed.</p>
        <Link href="/" data-testid="link-home">
          <button className="bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold px-5 py-2.5 rounded-xl text-sm">Back to ColdStreak</button>
        </Link>
      </div>
    );
  }

  const mapsUrl = biz.latitude && biz.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}`
    : biz.fullAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(biz.fullAddress)}`
      : null;

  const onShare = async () => {
    trackPublicClick(biz.id, "share");
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: biz.name, text: `Check out ${biz.name} on ColdStreak`, url }); return; } catch { /* user cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); alert("Link copied!"); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 text-white pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-blue-950/95 backdrop-blur border-b border-blue-800/40 px-4 py-3 flex items-center gap-3">
        <Link href="/" data-testid="link-back-home">
          <button className="p-2 -ml-2 rounded-lg hover:bg-blue-900/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-cyan-400" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-blue-400 text-xs">ColdStreak Verified Business</p>
        </div>
        <button
          data-testid="button-share"
          onClick={onShare}
          className="bg-cyan-500/20 border border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Hero */}
        <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-2">
            <BadgeCheck className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h1 data-testid="text-biz-name" className="text-2xl font-black leading-tight">{biz.name}</h1>
              {(biz.city || biz.state) && (
                <p className="text-blue-300 text-sm mt-1">{[biz.city, biz.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>

          {/* Open now badge */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              data-testid="badge-open-now"
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                openNow.open ? "bg-green-500/20 border border-green-500/60 text-green-300" : "bg-blue-900/60 border border-blue-700/60 text-blue-400"
              }`}
            >
              <Clock className="w-3 h-3" /> {openNow.label}
            </span>
            <span className="text-blue-500 text-xs flex items-center gap-1">
              <Eye className="w-3 h-3" /> {biz.viewCount.toLocaleString()} views
            </span>
          </div>

          {biz.description && (
            <p className="text-blue-200 text-sm leading-relaxed mb-3">{biz.description}</p>
          )}

          {biz.modalities && biz.modalities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {biz.modalities.map((m) => (
                <span key={m} className="bg-blue-900/40 border border-blue-700/40 text-blue-200 text-[11px] px-2 py-0.5 rounded-full">{m}</span>
              ))}
            </div>
          )}

          {/* Action grid */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {mapsUrl && (
              <a
                data-testid="link-directions"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicClick(biz.id, "directions")}
                className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/60 text-cyan-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" /> Directions
              </a>
            )}
            {biz.bookingUrl && (
              <a
                data-testid="link-booking"
                href={biz.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicClick(biz.id, "booking")}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/60 text-yellow-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-4 h-4" /> Book
              </a>
            )}
            {biz.phone && (
              <a
                data-testid="link-phone"
                href={`tel:${biz.phone}`}
                onClick={() => trackPublicClick(biz.id, "phone")}
                className="bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/40 text-blue-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            {biz.websiteUrl && (
              <a
                data-testid="link-website"
                href={biz.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicClick(biz.id, "website")}
                className="bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/40 text-blue-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Globe className="w-4 h-4" /> Website
              </a>
            )}
            {biz.yelpUrl && (
              <a
                data-testid="link-yelp"
                href={biz.yelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicClick(biz.id, "yelp")}
                className="bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <SiYelp className="w-4 h-4" /> Yelp
              </a>
            )}
            {biz.facebookUrl && (
              <a
                data-testid="link-facebook"
                href={biz.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicClick(biz.id, "facebook")}
                className="bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/40 text-blue-200 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <SiFacebook className="w-4 h-4" /> Facebook
              </a>
            )}
          </div>
        </div>

        {/* Address */}
        {biz.fullAddress && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p data-testid="text-address" className="text-blue-100 text-sm">{biz.fullAddress}</p>
            </div>
          </div>
        )}

        {/* Hours table */}
        {biz.hours && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Hours
            </h3>
            <ul className="text-sm divide-y divide-blue-900/40">
              {DAY_KEYS.map((d) => {
                const h = biz.hours![d];
                const isToday = d === todayKey();
                return (
                  <li
                    key={d}
                    data-testid={`hours-${d}`}
                    className={`flex justify-between py-1.5 ${isToday ? "text-cyan-200 font-bold" : "text-blue-200"}`}
                  >
                    <span>{DAY_LABELS[d]}</span>
                    <span>{h.closed ? "Closed" : `${h.open} – ${h.close}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Leaderboard */}
        {biz.leaderboard.length > 0 && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" /> Top plungers here
            </h3>
            <ol className="space-y-1.5">
              {biz.leaderboard.map((row, i) => (
                <li
                  key={`${row.username}-${i}`}
                  data-testid={`row-public-leader-${i}`}
                  className="flex items-center justify-between bg-blue-950/60 border border-blue-800/30 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-blue-400 font-bold text-xs w-5">{i + 1}</span>
                    <span className="text-white font-semibold truncate">{row.username}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-cyan-300 font-mono">{row.bestScore.toLocaleString()}</span>
                    <span className="text-blue-500 flex items-center gap-1"><Snowflake className="w-3 h-3" /> {row.plungeCount}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 rounded-2xl p-5 text-center">
          <p className="text-cyan-200 text-sm mb-3">
            Track your own cold plunges and join the leaderboard at <strong>{biz.name}</strong>.
          </p>
          <Link href="/" data-testid="link-get-app">
            <button className="bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-black px-5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 mx-auto">
              <ExternalLink className="w-4 h-4" /> Get ColdStreak
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
