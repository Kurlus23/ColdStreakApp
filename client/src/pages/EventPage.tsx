import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, MapPin, Users, Snowflake, ExternalLink, Copy, Navigation, Send, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { shareContent } from "@/lib/share";
import type { Event, EventParticipant } from "@shared/schema";
import { TEMP_TIERS, DAYS_TIERS, STATE_EMOJI } from "@/lib/passport";

function openDirections(lat: number | string, lng: number | string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank", "noopener,noreferrer");
}

type EventCoordinator = { id: number; eventId: number; userId: number; username: string; addedAt: string };
type EventDetail = Event & { participants: EventParticipant[]; participantCount: number; coordinators: EventCoordinator[] };

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

function fmtDateRange(start: string | Date, end: string | Date | null | undefined) {
  if (!end || new Date(end).toDateString() === new Date(start).toDateString()) return fmtDate(start);
  const s = new Date(start).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const e = new Date(end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

type MiniBadgeProfile = { username: string; featuredBadges: string; foundingPlunger: boolean };

export default function EventPage() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: evt, isLoading, error } = useQuery<EventDetail>({
    queryKey: ["/api/events", code],
    queryFn: () => fetch(`/api/events/${code}`).then((r) => { if (!r.ok) throw new Error("Event not found"); return r.json(); }),
    retry: false,
  });

  // Collect all usernames in the event for badge lookups
  const eventUsernames = useMemo(() => {
    if (!evt) return [];
    const names = new Set<string>();
    if (evt.createdByUsername) names.add(evt.createdByUsername);
    evt.coordinators.forEach((c) => names.add(c.username));
    evt.participants.forEach((p) => names.add(p.username));
    return [...names].filter(Boolean);
  }, [evt]);

  const { data: eventBadgeProfiles } = useQuery<MiniBadgeProfile[]>({
    queryKey: ["/api/badge-profiles/batch", eventUsernames.join(",")],
    queryFn: () => fetch(`/api/badge-profiles/batch?usernames=${encodeURIComponent(eventUsernames.join(","))}`).then((r) => r.json()),
    enabled: eventUsernames.length > 0,
    staleTime: 60_000,
  });

  const badgeEmojiLookup = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    TEMP_TIERS.forEach((t) => { m[t.id] = t.emoji; });
    DAYS_TIERS.forEach((t) => { m[t.id] = t.emoji; });
    Object.entries(STATE_EMOJI).forEach(([k, v]) => { m[`state-${k}`] = v; });
    return m;
  }, []);

  const eventBadgeMap = useMemo<Record<string, MiniBadgeProfile>>(() => {
    if (!eventBadgeProfiles) return {};
    return Object.fromEntries(eventBadgeProfiles.map((p) => [p.username, p]));
  }, [eventBadgeProfiles]);

  function renderEventBadges(username: string) {
    const profile = eventBadgeMap[username];
    if (!profile) return null;
    const chips: string[] = [];
    if (profile.foundingPlunger) chips.push("🎖️");
    try {
      const ids: string[] = JSON.parse(profile.featuredBadges);
      ids.slice(0, 3).forEach((id) => { const e = badgeEmojiLookup[id]; if (e) chips.push(e); });
    } catch { /* ignore */ }
    if (!chips.length) return null;
    return <span className="text-sm leading-none" title="Badges">{chips.join("")}</span>;
  }

  const isJoined = evt?.participants.some((p) => p.userId === auth.user?.id) ?? false;

  const join = useMutation({
    mutationFn: () => apiRequest("POST", `/api/events/${evt!.id}/join`, { username: auth.user?.displayName || auth.user?.email?.split("@")[0] || "Anon" }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events", code] }); toast({ title: "You're in! ❄️", description: `You've joined ${evt?.name}.` }); },
    onError: (e: Error) => toast({ title: "Couldn't join", description: e.message, variant: "destructive" }),
  });

  const leave = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/events/${evt!.id}/join`).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events", code] }); toast({ title: "Left event", description: `Removed from ${evt?.name}.` }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex items-center justify-center">
        <Snowflake className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error || !evt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-4">🧊</p>
          <p className="text-white font-bold text-lg mb-2">Event not found</p>
          <p className="text-blue-300 text-sm mb-6">This link may have expired or the event was removed.</p>
          <button onClick={() => navigate("/")} className="bg-cyan-500 text-blue-950 font-bold px-6 py-3 rounded-xl text-sm">
            Open ColdStreak
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
          <Snowflake className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <p className="text-cyan-400 text-xs font-semibold uppercase tracking-widest">ColdStreak Event</p>
          <p className="text-blue-300 text-xs">coldstreakapp.com</p>
        </div>
        <a href="/" className="ml-auto text-blue-400 hover:text-white text-xs font-semibold flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Open App
        </a>
      </div>

      {/* Event card */}
      <div className="bg-blue-900/60 border border-blue-700/50 rounded-3xl p-5 space-y-4 mb-4">
        <div>
          <h1 className="text-white font-bold text-2xl leading-tight">{evt.name}</h1>
          {evt.description && <p className="text-blue-200 text-sm mt-1.5 leading-relaxed">{evt.description}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <CalendarDays className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>{fmtDateRange(evt.eventDate, evt.endDate)}</span>
          </div>
          {evt.locationName && (
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>{evt.locationName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <Users className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              {evt.maxAttendees != null
                ? `${evt.participantCount} / ${evt.maxAttendees} attending${evt.participantCount >= evt.maxAttendees ? " · FULL" : ""}`
                : `${evt.participantCount} attending`}
            </span>
          </div>
        </div>

        {/* Directions */}
        {(evt.plungeLat || evt.accessLat) && (
          <div className="space-y-2">
            <p className="text-blue-500 text-xs font-semibold uppercase tracking-wide">Directions</p>
            <div className="flex gap-2 flex-wrap">
              {evt.plungeLat && evt.plungeLng && (
                <button
                  data-testid="button-directions-plunge"
                  onClick={() => openDirections(evt.plungeLat!, evt.plungeLng!)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5" /> 📍 Plunge Spot
                </button>
              )}
              {evt.accessLat && evt.accessLng && (
                <button
                  data-testid="button-directions-parking"
                  onClick={() => openDirections(evt.accessLat!, evt.accessLng!)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700/40 border border-blue-600/50 text-blue-300 text-xs font-semibold hover:bg-blue-700/60 transition-all active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5" /> 🅿 Parking
                </button>
              )}
            </div>
          </div>
        )}

        {(evt.createdByUsername || evt.coordinators.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {evt.createdByUsername && (
              <button
                onClick={() => window.open(`/profile/${encodeURIComponent(evt.createdByUsername!)}`, '_blank')}
                className="flex items-center gap-1 text-blue-500 text-xs hover:text-cyan-300 transition-colors"
              >
                Organized by <span className="font-semibold">{evt.createdByUsername}</span>
                {renderEventBadges(evt.createdByUsername)}
              </button>
            )}
            {evt.coordinators.map((c) => (
              <button
                key={c.id}
                onClick={() => window.open(`/profile/${encodeURIComponent(c.username)}`, '_blank')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-800/60 border border-blue-700/40 text-blue-300 text-[11px] font-semibold hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
              >
                ⚡ {c.username}{renderEventBadges(c.username)}
              </button>
            ))}
          </div>
        )}

        {/* Join / Leave */}
        {auth.user ? (
          isJoined ? (
            <button
              data-testid="button-leave-event"
              onClick={() => leave.mutate()}
              disabled={leave.isPending}
              className="w-full py-3 rounded-2xl border border-blue-600/60 text-blue-300 font-semibold text-sm hover:border-blue-400 transition-all active:scale-95 disabled:opacity-40"
            >
              {leave.isPending ? "Leaving…" : "✓ Attending — tap to leave"}
            </button>
          ) : (
            <button
              data-testid="button-join-event"
              onClick={() => join.mutate()}
              disabled={join.isPending}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-40 shadow-lg shadow-cyan-500/30"
            >
              {join.isPending ? "Joining…" : "❄️ Join Event"}
            </button>
          )
        ) : (
          <div className="space-y-2">
            <p className="text-blue-400 text-xs text-center">Log in to mark yourself as attending</p>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all active:scale-95"
            >
              Open ColdStreak to Join
            </button>
          </div>
        )}

        {/* Share */}
        <button
          data-testid="button-share-event-link"
          onClick={async () => {
            const location = evt.locationName ? `\n📍 ${evt.locationName}` : "";
            const message = `Join me at ${evt.name} 🧊🔥${location}\n📅 ${fmtDate(evt.eventDate)}`;
            console.log("SHARE MESSAGE:", message);
            await shareContent({
              title: evt.name,
              text: message,
            });
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
          className="w-full py-2.5 rounded-2xl border border-blue-700/50 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-blue-500 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Send className="w-3.5 h-3.5" />}
          {copied ? "Link copied!" : "Invite Friends"}
        </button>
      </div>

      {/* Attendees */}
      {evt.participants.length > 0 && (
        <div className="bg-blue-900/40 border border-blue-700/40 rounded-3xl p-4 space-y-3">
          <h2 className="text-white font-bold text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" /> Attendees
          </h2>
          <div className="space-y-1">
            {evt.participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5">
                <span className="text-blue-500 text-xs w-5 text-right">{i + 1}</span>
                <button onClick={() => window.open(`/profile/${encodeURIComponent(p.username)}`, '_blank')} className="w-7 h-7 rounded-full bg-blue-700/60 border border-blue-600/40 flex items-center justify-center text-xs font-bold text-cyan-300 hover:opacity-80 transition-opacity flex-shrink-0">
                  {p.username.slice(0, 1).toUpperCase()}
                </button>
                <button onClick={() => window.open(`/profile/${encodeURIComponent(p.username)}`, '_blank')} className="flex items-center gap-1 text-white text-sm font-medium flex-1 hover:text-cyan-300 transition-colors text-left">
                  {p.username}
                  {renderEventBadges(p.username)}
                </button>
                <span className="text-blue-500 text-xs">
                  {new Date(p.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-blue-600 text-xs mt-6">Powered by ColdStreak · coldstreakapp.com</p>
    </div>
  );
}
