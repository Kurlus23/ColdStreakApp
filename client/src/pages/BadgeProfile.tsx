import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TEMP_TIERS, DAYS_TIERS, STATE_EMOJI } from "@/lib/passport";
import { X, Pencil, Share2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { SiInstagram, SiSnapchat, SiFacebook, SiTiktok, SiX, SiYoutube } from "react-icons/si";
import { getAuthToken } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { shareContent } from "@/lib/share";

interface BadgeProfile {
  username: string;
  featuredBadges: string;
  plungeCount: number;
  uniqueDays: number;
  coldestTemp: number | null;
  updatedAt: string;
  foundingPlunger: boolean;
  computed?: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  socialLinks?: string;
}

interface SocialLinks {
  instagram?: string;
  snapchat?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
}

const SOCIAL_META: { key: keyof SocialLinks; label: string; Icon: React.ElementType; color: string; placeholder: string; prefix: string }[] = [
  { key: "instagram", label: "Instagram", Icon: SiInstagram, color: "text-pink-400", placeholder: "yourhandle", prefix: "https://instagram.com/" },
  { key: "snapchat", label: "Snapchat", Icon: SiSnapchat, color: "text-yellow-300", placeholder: "yourhandle", prefix: "https://snapchat.com/add/" },
  { key: "tiktok", label: "TikTok", Icon: SiTiktok, color: "text-white", placeholder: "yourhandle", prefix: "https://tiktok.com/@" },
  { key: "facebook", label: "Facebook", Icon: SiFacebook, color: "text-blue-400", placeholder: "yourhandle", prefix: "https://facebook.com/" },
  { key: "twitter", label: "X / Twitter", Icon: SiX, color: "text-white", placeholder: "yourhandle", prefix: "https://x.com/" },
  { key: "youtube", label: "YouTube", Icon: SiYoutube, color: "text-red-400", placeholder: "yourhandle", prefix: "https://youtube.com/@" },
];

function computeEarnedTempTiers(coldestTemp: number | null): Set<string> {
  if (coldestTemp === null) return new Set();
  const ordered = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
  const earned = new Set<string>();
  let cascade = false;
  for (const t of ordered) {
    if (!cascade) cascade = coldestTemp >= t.minTemp && coldestTemp <= t.maxTemp;
    if (cascade) earned.add(t.id);
  }
  return earned;
}

function Avatar({ username, avatarUrl, size = "lg" }: { username: string; avatarUrl?: string | null; size?: "lg" | "sm" }) {
  const initials = username.slice(0, 2).toUpperCase();
  const colors = [
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-700",
    "from-emerald-500 to-teal-700",
    "from-amber-400 to-orange-600",
    "from-rose-500 to-pink-700",
  ];
  const gradient = colors[username.charCodeAt(0) % colors.length];
  const sizeClass = size === "lg" ? "w-28 h-28 text-3xl" : "w-20 h-20 text-2xl";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${username}'s avatar`}
        className={`${sizeClass} rounded-full object-cover border-2 border-cyan-400/60 shadow-xl`}
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = "none";
          (el.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
        }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-xl border-2 border-white/10`}>
      {initials}
    </div>
  );
}

export default function BadgeProfile() {
  const { username } = useParams<{ username: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  // Display name is stored in localStorage as "coldstreak-username"; auth token confirms they're logged in
  const myUsername = getAuthToken()
    ? (localStorage.getItem("coldstreak-username") ?? null)
    : null;

  const [showEdit, setShowEdit] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLinks, setEditLinks] = useState<SocialLinks>({});
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading, isError } = useQuery<BadgeProfile>({
    queryKey: ["/api/badge-profile", username],
    queryFn: async () => {
      const res = await fetch(`/api/badge-profile/${encodeURIComponent(username!)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!username,
    retry: false,
  });

  const updateMeta = useMutation({
    mutationFn: (body: { avatarUrl?: string | null; bio: string; socialLinks: string }) =>
      apiRequest("PATCH", "/api/badge-profile", body).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge-profile", username] });
      setSaved(true);
      setTimeout(() => { setSaved(false); setShowEdit(false); }, 1500);
    },
  });

  function openEdit() {
    if (!profile) return;
    setEditAvatarUrl(profile.avatarUrl ?? "");
    setEditBio(profile.bio ?? "");
    try { setEditLinks(JSON.parse(profile.socialLinks ?? "{}")); } catch { setEditLinks({}); }
    setShowEdit(true);
  }

  function saveEdit() {
    const links: SocialLinks = {};
    for (const { key } of SOCIAL_META) {
      const val = (editLinks[key] ?? "").trim();
      if (val) links[key] = val;
    }
    updateMeta.mutate({
      avatarUrl: editAvatarUrl.trim() || null,
      bio: editBio.trim(),
      socialLinks: JSON.stringify(links),
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="text-blue-300 text-center">
          <div className="text-4xl mb-3 animate-pulse">🧊</div>
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">🌊</p>
        <h1 className="text-white font-bold text-xl mb-2">Profile not found</h1>
        <p className="text-blue-400 text-sm mb-6">
          <strong>{username}</strong> doesn't have a ColdStreak profile yet.
        </p>
        <Link href="/" className="bg-cyan-500 text-blue-950 font-bold px-6 py-3 rounded-xl text-sm">
          Open ColdStreak
        </Link>
      </div>
    );
  }

  const featuredIds: string[] = (() => {
    try { return JSON.parse(profile.featuredBadges) as string[]; } catch { return []; }
  })();

  const socialLinks: SocialLinks = (() => {
    try { return JSON.parse(profile.socialLinks ?? "{}"); } catch { return {}; }
  })();

  const earnedTempTierIds = computeEarnedTempTiers(profile.coldestTemp);
  const earnedDaysTierIds = new Set(DAYS_TIERS.filter((t) => profile.uniqueDays >= t.days).map((t) => t.id));

  const emojiLookup: Record<string, string> = {};
  TEMP_TIERS.forEach((t) => { emojiLookup[t.id] = t.emoji; });
  DAYS_TIERS.forEach((t) => { emojiLookup[t.id] = t.emoji; });
  Object.entries(STATE_EMOJI).forEach(([s, e]) => { emojiLookup[s] = e as string; });

  const totalEarnedTemp = earnedTempTierIds.size;
  const totalEarnedDays = earnedDaysTierIds.size;
  const totalEarned = totalEarnedTemp + totalEarnedDays;

  const updatedStr = new Date(profile.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const isOwner = !!myUsername && myUsername.toLowerCase() === profile.username.toLowerCase();

  const activeSocials = SOCIAL_META.filter(({ key }) => socialLinks[key]);


  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 flex flex-col items-center">
      {/* Close button */}
      <button
        data-testid="button-close-profile"
        onClick={() => {
          if (window.opener) {
            window.close();
          } else if (window.history.length > 1) {
            window.history.back();
          } else {
            navigate("/");
          }
        }}
        className="fixed top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-blue-800/80 border border-blue-600/60 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-90 z-50"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-full max-w-sm space-y-4">

        {/* Branding */}
        <div className="text-center mb-1">
          <span className="text-cyan-400 font-bold text-lg tracking-wide">🧊 ColdStreak</span>
        </div>

        {/* Profile Header */}
        <div className="bg-blue-900/70 rounded-3xl px-5 pt-5 pb-4 border border-blue-700/50">
          {/* Avatar left + info right */}
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar column */}
            <div className="relative flex-shrink-0">
              <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size="sm" />
              {/* Fallback initials shown when image fails */}
              {profile.avatarUrl && (
                <div
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 items-center justify-center text-white font-bold text-2xl shadow-xl border-2 border-white/10 hidden"
                  aria-hidden="true"
                >
                  {profile.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              {/* Owner pencil shortcut */}
              {isOwner && (
                <button
                  onClick={() => (showEdit ? setShowEdit(false) : openEdit())}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-cyan-500 border-2 border-blue-950 flex items-center justify-center shadow-lg hover:bg-cyan-400 transition-colors active:scale-90"
                  title="Edit avatar"
                >
                  <Pencil className="w-3 h-3 text-blue-950" />
                </button>
              )}
            </div>

            {/* Info column */}
            <div className="flex-1 min-w-0">
              <h1 data-testid="text-profile-username" className="text-white font-bold text-xl leading-tight mb-1 truncate">{profile.username}</h1>

              {profile.foundingPlunger && (
                <div className="mb-1.5">
                  <span
                    data-testid="badge-founding-plunger"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold"
                  >🎖️ Founding Plunger</span>
                </div>
              )}

              {/* Social Links */}
              {activeSocials.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mb-1">
                  {activeSocials.map(({ key, label, Icon, color, prefix }) => (
                    <a
                      key={key}
                      href={`${prefix}${socialLinks[key]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${label}: ${socialLinks[key]}`}
                      data-testid={`link-social-${key}`}
                      className={`${color} hover:opacity-80 transition-opacity active:scale-90`}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              )}

              <p className="text-blue-500 text-[10px]">
                {profile.computed ? "ColdStreak Profile" : `Updated ${updatedStr}`}
              </p>

              {/* "Add photo" nudge for owners with no avatar */}
              {isOwner && !profile.avatarUrl && (
                <p className="text-cyan-400 text-[10px] font-semibold mt-0.5">tap ✎ to add photo</p>
              )}
            </div>
          </div>

          {/* Bio — full width below the row */}
          {profile.bio && (
            <p className="text-blue-300 text-sm leading-relaxed mb-3">{profile.bio}</p>
          )}

          {/* Featured badges */}
          {featuredIds.length > 0 && (
            <div className="flex justify-center flex-wrap gap-1 mb-4">
              {featuredIds.map((id) => (
                <span key={id} data-testid={`badge-featured-${id}`} className="text-3xl leading-none">{emojiLookup[id] ?? "🏆"}</span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex justify-center gap-5 text-center">
            <div>
              <div data-testid="stat-plunge-count" className="text-white font-bold text-xl">{profile.plungeCount}</div>
              <div className="text-blue-400 text-[11px]">plunges</div>
            </div>
            <div className="w-px bg-blue-700/60" />
            <div>
              <div data-testid="stat-unique-days" className="text-white font-bold text-xl">{profile.uniqueDays}</div>
              <div className="text-blue-400 text-[11px]">days</div>
            </div>
            {profile.coldestTemp !== null && (
              <>
                <div className="w-px bg-blue-700/60" />
                <div>
                  <div data-testid="stat-coldest-temp" className="text-white font-bold text-xl">{profile.coldestTemp}°F</div>
                  <div className="text-blue-400 text-[11px]">coldest</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Owner action bar */}
        {isOwner && (
          <div className="flex gap-2">
            <button
              data-testid="button-edit-badge-profile"
              onClick={() => (showEdit ? setShowEdit(false) : openEdit())}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
              {showEdit ? "Cancel" : "Edit Profile"}
              {showEdit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              data-testid="button-share-profile"
              onClick={async () => {
                await shareContent({
                  title: `${profile.username} on ColdStreak`,
                  text: `Check out ${profile.username}'s cold plunge streak on ColdStreak 🧊🔥\nThey're on a ${profile.streak}-day streak!\n\nJoin the grind →`,
                  url: `https://coldstreakapp.com/profile/${encodeURIComponent(profile.username)}`,
                });
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-800/60 border border-blue-600/40 text-blue-200 text-xs font-semibold hover:bg-blue-700/60 transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Profile
            </button>
          </div>
        )}

        {/* Inline edit panel */}
        {isOwner && showEdit && (
          <div className="bg-blue-900/80 rounded-2xl border border-blue-700/50 px-4 py-4 space-y-4">
            <p className="text-white font-semibold text-sm">Edit Your Profile</p>

            {/* Avatar URL */}
            <div>
              <label className="text-blue-300 text-xs font-semibold block mb-1">Avatar Image URL</label>
              <input
                data-testid="input-avatar-url"
                type="url"
                placeholder="https://… paste a direct image link"
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                className="w-full bg-blue-950/70 border border-blue-700 rounded-xl px-3 py-2 text-white text-xs placeholder:text-blue-600 focus:outline-none focus:border-cyan-500"
              />
              <div className="mt-2 bg-blue-950/60 rounded-xl px-3 py-2.5 border border-blue-700/40 space-y-1.5">
                <p className="text-blue-300 text-[10px] font-semibold">How to get your Imgur link:</p>
                <ol className="text-blue-400 text-[10px] space-y-0.5 list-none">
                  <li>1. Go to <span className="text-cyan-300 font-medium">imgur.com</span> and upload your photo</li>
                  <li>2. Click on the uploaded image to open it</li>
                  <li>3. Right-click the image → <span className="text-white">"Copy image address"</span></li>
                  <li>4. The link will start with <span className="text-white font-mono">https://i.imgur.com/</span></li>
                  <li>5. Paste it in the field above</li>
                </ol>
                <p className="text-blue-500 text-[10px]">Works with any photo — including a Bitmoji or Snapchat screenshot.</p>
              </div>
              {editAvatarUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={editAvatarUrl}
                    alt="Preview"
                    className="w-10 h-10 rounded-full object-cover border border-blue-600"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                  <span className="text-blue-500 text-[10px]">Preview</span>
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="text-blue-300 text-xs font-semibold block mb-1">Bio <span className="text-blue-500">({editBio.length}/200)</span></label>
              <textarea
                data-testid="input-bio"
                placeholder="Tell the community about your cold plunge journey…"
                value={editBio}
                maxLength={200}
                rows={3}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full bg-blue-950/70 border border-blue-700 rounded-xl px-3 py-2 text-white text-xs placeholder:text-blue-600 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            {/* Social handles */}
            <div>
              <label className="text-blue-300 text-xs font-semibold block mb-2">Social Handles <span className="text-blue-600 font-normal">(username only, no @)</span></label>
              <div className="space-y-2">
                {SOCIAL_META.map(({ key, label, Icon, color, placeholder }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                    <input
                      data-testid={`input-social-${key}`}
                      type="text"
                      placeholder={placeholder}
                      value={editLinks[key] ?? ""}
                      onChange={(e) => setEditLinks((l) => ({ ...l, [key]: e.target.value.replace(/^@/, "") }))}
                      className="flex-1 bg-blue-950/70 border border-blue-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-blue-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Featured badges note */}
            <div className="bg-blue-950/60 rounded-xl px-3 py-2 border border-blue-800/50">
              <p className="text-blue-400 text-[11px] leading-relaxed">
                To change your <strong className="text-blue-300">featured badges</strong>, go to the <strong className="text-blue-300">Badges</strong> tab in the app.
              </p>
            </div>

            <button
              data-testid="button-save-profile"
              onClick={saveEdit}
              disabled={updateMeta.isPending}
              className="w-full py-2.5 rounded-xl bg-cyan-500 text-blue-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all active:scale-95 disabled:opacity-60"
            >
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : updateMeta.isPending ? "Saving…" : "Save Profile"}
            </button>
          </div>
        )}

        {/* Temperature Tiers */}
        {totalEarnedTemp > 0 && (
          <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">Temperature Tiers</p>
            <div className="space-y-2">
              {[...TEMP_TIERS].reverse().map((tier) => {
                const earned = earnedTempTierIds.has(tier.id);
                if (!earned) return null;
                return (
                  <div key={tier.id} data-testid={`badge-temp-${tier.id}`} className="flex items-center gap-3">
                    <span className="text-2xl leading-none w-8 text-center">{tier.emoji}</span>
                    <div>
                      <div className="text-white text-sm font-semibold">{tier.label}</div>
                      <div className="text-blue-400 text-xs">{tier.minTemp === 0 ? `≤${tier.maxTemp}°F` : `${tier.minTemp}–${tier.maxTemp}°F`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Days Tiers */}
        {totalEarnedDays > 0 && (
          <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">Days Plunged</p>
            <div className="space-y-2">
              {[...DAYS_TIERS].reverse().map((tier) => {
                const earned = earnedDaysTierIds.has(tier.id);
                if (!earned) return null;
                return (
                  <div key={tier.id} data-testid={`badge-days-${tier.id}`} className="flex items-center gap-3">
                    <span className="text-2xl leading-none w-8 text-center">{tier.emoji}</span>
                    <div>
                      <div className="text-white text-sm font-semibold">{tier.label}</div>
                      <div className="text-blue-400 text-xs">{tier.days}+ days</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalEarned === 0 && (
          <div className="bg-blue-900/40 rounded-2xl border border-blue-800/40 px-4 py-5 text-center">
            <p className="text-blue-400 text-sm">No temperature or days badges yet — keep plunging! 🥶</p>
          </div>
        )}

      </div>
    </div>
  );
}
