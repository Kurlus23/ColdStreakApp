import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, MapPin, Users, Snowflake, ExternalLink, Copy, Check, Navigation } from "lucide-react";
import { useState } from "react";
import type { Event, EventParticipant } from "@shared/schema";

function openDirections(lat: number | string, lng: number | string) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank", "noopener,noreferrer");
}

type EventDetail = Event & { participants: EventParticipant[]; participantCount: number };

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

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

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/event/${code}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    toast({ title: "Link copied!", description: url });
    setTimeout(() => setCopied(false), 2500);
  };

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
            <span>{fmtDate(evt.eventDate)}</span>
          </div>
          {evt.locationName && (
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>{evt.locationName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <Users className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>{evt.participantCount} attending</span>
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

        {evt.createdByUsername && (
          <p className="text-blue-500 text-xs">Organized by {evt.createdByUsername}</p>
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
          data-testid="button-copy-event-link"
          onClick={handleCopyLink}
          className="w-full py-2.5 rounded-2xl border border-blue-700/50 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-blue-500 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy invite link"}
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
                <div className="w-7 h-7 rounded-full bg-blue-700/60 border border-blue-600/40 flex items-center justify-center text-xs font-bold text-cyan-300">
                  {p.username.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium flex-1">{p.username}</span>
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
