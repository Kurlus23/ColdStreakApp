import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, ThumbsUp, Globe, ChevronDown, X, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserLocation } from "@shared/schema";

const NOMINATION_THRESHOLD = 25;
const NOMINATIONS_KEY = "coldstreak-nominations";

function getNominated(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOMINATIONS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveNominated(set: Set<number>) {
  localStorage.setItem(NOMINATIONS_KEY, JSON.stringify([...set]));
}

const COUNTRIES = [
  "All",
  "Australia", "Austria", "Canada", "Chile", "Czech Republic", "Denmark",
  "Finland", "France", "Germany", "Iceland", "Ireland", "Italy", "Japan",
  "Netherlands", "New Zealand", "Norway", "Poland", "Portugal", "Russia",
  "Scotland", "Spain", "Sweden", "Switzerland", "United Kingdom", "United States",
  "Other",
];

export function CommunityLocations({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [countryFilter, setCountryFilter] = useState("All");
  const [nominated, setNominated] = useState<Set<number>>(getNominated);

  const [form, setForm] = useState({ name: "", country: "United States", description: "" });
  const [formError, setFormError] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery<UserLocation[]>({
    queryKey: ["/api/community-locations", countryFilter],
    queryFn: () =>
      fetch(`/api/community-locations${countryFilter !== "All" ? `?country=${encodeURIComponent(countryFilter)}` : ""}`)
        .then((r) => r.json()),
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; country: string; description: string; submittedBy?: string }) =>
      fetch("/api/community-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setShowForm(false);
      setForm({ name: "", country: "United States", description: "" });
      toast({ title: "📍 Location submitted!", description: "Thanks for contributing to ColdStreak." });
    },
    onError: () => toast({ title: "Submission failed", variant: "destructive" }),
  });

  const nominateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/community-locations/${id}/nominate`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (updated: UserLocation) => {
      queryClient.setQueryData<UserLocation[]>(
        ["/api/community-locations", countryFilter],
        (prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? [updated]
      );
      const next = new Set(nominated);
      next.add(updated.id);
      setNominated(next);
      saveNominated(next);
      if (updated.nominationCount >= NOMINATION_THRESHOLD) {
        toast({ title: "🎉 Trending location!", description: `${updated.name} has reached ${NOMINATION_THRESHOLD} nominations and is up for review!` });
      } else {
        toast({ title: "Vote counted!", description: `${updated.nominationCount} / ${NOMINATION_THRESHOLD} nominations` });
      }
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { setFormError("Location name is required."); return; }
    if (!form.country) { setFormError("Please select a country."); return; }
    setFormError("");
    submitMutation.mutate({
      name: form.name.trim(),
      country: form.country,
      description: form.description.trim() || undefined,
      submittedBy: username.trim() || undefined,
    });
  };

  return (
    <div className="mb-5">
      {/* Header toggle */}
      <button
        data-testid="button-toggle-community"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 border rounded-2xl px-4 py-3.5 transition-all active:scale-[0.99] ${open ? "bg-blue-800/80 border-blue-600/60" : "bg-blue-900/60 hover:bg-blue-800/70 border-blue-700/40"}`}
      >
        <Globe className="w-4 h-4 text-cyan-400" />
        <span className="text-white font-bold flex-1 text-left">Community Locations</span>
        <span className="text-xs text-blue-400 mr-1">{locations.length > 0 ? `${locations.length} submitted` : "Suggest a spot"}</span>
        <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${open ? "bg-blue-600/60" : "bg-blue-800/60"}`}>
          <ChevronDown className={`w-3.5 h-3.5 text-blue-300 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {/* Filter + Add button */}
          <div className="flex gap-2 items-center">
            <select
              data-testid="select-country-filter"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="flex-1 bg-blue-900/60 border border-blue-700 rounded-xl px-3 py-2 text-white text-sm appearance-none focus:outline-none focus:border-cyan-400"
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              data-testid="button-add-location"
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600/30 border border-cyan-600/50 text-cyan-300 text-sm font-semibold hover:bg-cyan-600/50 transition-all active:scale-95"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "Cancel" : "Suggest"}
            </button>
          </div>

          {/* Submission form */}
          {showForm && (
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="text-white font-semibold text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" /> Submit a Cold Plunge Spot
              </div>
              <input
                data-testid="input-location-name"
                type="text"
                placeholder="Location name (e.g. Barton Creek Greenbelt)"
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
              />
              <select
                data-testid="select-location-country"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-cyan-400"
              >
                {COUNTRIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea
                data-testid="input-location-description"
                placeholder="Describe the spot — water type, temperature, accessibility… (optional)"
                value={form.description}
                maxLength={300}
                rows={3}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 resize-none"
              />
              {formError && <div className="text-red-400 text-xs">{formError}</div>}
              <button
                data-testid="button-submit-location"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Location"}
              </button>
              <p className="text-blue-500 text-xs">Locations with {NOMINATION_THRESHOLD}+ nominations are reviewed for inclusion in Chill Places.</p>
            </div>
          )}

          {/* Locations list */}
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 bg-blue-900/40 rounded-2xl animate-pulse" />)}</div>
          ) : locations.length === 0 ? (
            <div className="text-center text-blue-500 text-sm py-6">
              No locations submitted yet for this country.<br />Be the first to suggest one!
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc) => {
                const hasNominated = nominated.has(loc.id);
                const pct = Math.min(100, (loc.nominationCount / NOMINATION_THRESHOLD) * 100);
                const trending = loc.nominationCount >= NOMINATION_THRESHOLD;
                return (
                  <div
                    key={loc.id}
                    data-testid={`card-community-${loc.id}`}
                    className={`bg-blue-900/60 rounded-2xl p-3.5 border transition-all ${trending ? "border-yellow-500/50 bg-yellow-900/10" : "border-blue-700/40"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-white font-semibold text-sm">{loc.name}</span>
                          {trending && <Flame className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                        </div>
                        <div className="text-blue-400 text-xs mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" /> {loc.country}
                          {loc.submittedBy && <span className="text-blue-600">· by {loc.submittedBy}</span>}
                        </div>
                        {loc.description && (
                          <p className="text-blue-300 text-xs mt-1 leading-relaxed line-clamp-2">{loc.description}</p>
                        )}
                        {/* Nomination progress */}
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-blue-500">{loc.nominationCount} / {NOMINATION_THRESHOLD} nominations</span>
                            {trending && <span className="text-xs text-yellow-400 font-semibold">Under review ✓</span>}
                          </div>
                          <div className="h-1.5 bg-blue-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${trending ? "bg-yellow-400" : "bg-gradient-to-r from-cyan-500 to-blue-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        data-testid={`button-nominate-${loc.id}`}
                        onClick={() => !hasNominated && nominateMutation.mutate(loc.id)}
                        disabled={hasNominated || nominateMutation.isPending}
                        className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                          hasNominated
                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 cursor-default"
                            : "bg-blue-800/60 border-blue-600/50 text-blue-300 hover:border-cyan-400 hover:text-cyan-300"
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {hasNominated ? "Voted" : "Vote"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
