import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TEMP_TIERS, DAYS_TIERS, STATE_EMOJI, usePassportBadges, computeStateBadges } from "@/lib/passport";
import { X, Pencil, Share2, ChevronDown, ChevronUp, Check, Upload, Loader2, Flame, Target, User } from "lucide-react";
import { SiInstagram, SiSnapchat, SiFacebook, SiTiktok, SiX, SiYoutube } from "react-icons/si";
import { getAuthToken } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { shareContent } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Capacitor } from "@capacitor/core";
import { loadFriends as loadFriendsImpl } from "@/lib/loadFriends";
import { searchFriends as searchFriendsImpl } from "@/lib/searchFriends";
import { sendFriendRequest as sendFriendRequestImpl } from "@/lib/sendFriendRequest";
import { respondFriendRequest as respondFriendRequestImpl } from "@/lib/respondFriendRequest";
import { sendFriendChallenge as sendFriendChallengeImpl } from "@/lib/sendFriendChallenge";

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
  userId?: number | null;
}

interface SocialLinks {
  instagram?: string;
  snapchat?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
}

interface FriendEntry { friendshipId: number; userId: number; username: string | null; displayName: string | null; avatarUrl: string | null; streak: number; plungedToday: boolean; latestScore: number | null; bestScore: number | null; }
interface FriendRequest { friendshipId: number; requesterId: number; requesterUsername: string | null; requesterDisplayName: string | null; requesterAvatarUrl: string | null; requesterStreak: number; requesterPlungeCount: number; createdAt: string; }
interface UserResult { id: number; username: string; displayName: string | null; avatarUrl: string | null; friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined'; }
interface PlungeRecord { id: number; duration: number; temperature: number; calories: number | null; createdAt: string; }

const SOCIAL_META: { key: keyof SocialLinks; label: string; Icon: React.ElementType; color: string; placeholder: string; prefix: string }[] = [
  { key: "instagram", label: "Instagram", Icon: SiInstagram, color: "text-pink-400", placeholder: "yourhandle", prefix: "https://instagram.com/" },
  { key: "snapchat", label: "Snapchat", Icon: SiSnapchat, color: "text-yellow-300", placeholder: "yourhandle", prefix: "https://snapchat.com/add/" },
  { key: "tiktok", label: "TikTok", Icon: SiTiktok, color: "text-white", placeholder: "yourhandle", prefix: "https://tiktok.com/@" },
  { key: "facebook", label: "Facebook", Icon: SiFacebook, color: "text-blue-400", placeholder: "yourhandle", prefix: "https://facebook.com/" },
  { key: "twitter", label: "X / Twitter", Icon: SiX, color: "text-white", placeholder: "yourhandle", prefix: "https://x.com/" },
  { key: "youtube", label: "YouTube", Icon: SiYoutube, color: "text-red-400", placeholder: "yourhandle", prefix: "https://youtube.com/@" },
];

function estimateCalories(
  durationSeconds: number,
  tempF: number,
  weightLbs: number,
  bodyFatPct?: number | null,
): number {
  const durationMin = durationSeconds / 60;
  const tempC = (tempF - 32) * 5 / 9;
  const deltaT = Math.max(0, 37 - tempC);
  const effectiveLbs = (bodyFatPct != null && bodyFatPct > 0)
    ? weightLbs * (1 - bodyFatPct / 100)
    : weightLbs;
  return Math.max(0, durationMin * deltaT * (effectiveLbs / 2.205) * 0.0077);
}

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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editLinks, setEditLinks] = useState<SocialLinks>({});
  const [saved, setSaved] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<null | "ok" | "taken" | "invalid">(null);
  const [usernameStatusMsg, setUsernameStatusMsg] = useState("");
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Brain Freeze head-to-head record — only when viewer is logged in and viewing someone else's profile
  const profileOwnerId = profile?.userId ?? null;
  const isViewerLoggedIn = !!getAuthToken();
  // Compute viewer-not-owner early (myUsername and username from params are available here)
  const isNotOwnerViewer = !!myUsername && !!username
    ? myUsername.toLowerCase() !== username.toLowerCase()
    : true;
  const { data: h2hData } = useQuery<{ record: { wins: number; losses: number; ties: number } | null }>({
    queryKey: ["/api/brain-freeze/head-to-head", profileOwnerId],
    queryFn: async () => {
      const r = await fetch(`/api/brain-freeze/head-to-head/${profileOwnerId}`, {
        headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
      });
      if (!r.ok) return { record: null };
      return r.json();
    },
    enabled: isViewerLoggedIn && !!profileOwnerId && isNotOwnerViewer,
    staleTime: 30_000,
  });

  // Must be called unconditionally before any early returns
  const { badges: localBadges } = usePassportBadges();
  const { toast } = useToast();

  // ── Owner-only state (hooks must be unconditional) ────────────────────────
  const [bodyWeightLbs, setBodyWeightLbs] = useState(() => Number(localStorage.getItem("coldstreak-body-weight") || 150));
  const weightHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weightHoldCountRef = useRef(0);
  const weightPullInFlightRef = useRef(false);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(() => Number(localStorage.getItem("weeklyGoalMinutes") || 30));
  const [ownerPlunges, setOwnerPlunges] = useState<PlungeRecord[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsView, setFriendsView] = useState<'leaderboard' | 'requests' | 'add'>('leaderboard');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<UserResult[]>([]);
  const [friendsSearchLoading, setFriendsSearchLoading] = useState(false);
  const [challengingId, setChallengingId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  const authFetch = useCallback((url: string, opts: RequestInit = {}) => {
    const token = getAuthToken() ?? "";
    return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
  }, []);

  // Compute ownership before early returns so we can use it in useEffect
  const isOwnerEarly = !!myUsername && !!username && myUsername.toLowerCase() === username.toLowerCase();

  const loadFriends = useCallback(async () => {
    if (!getAuthToken()) return;
    await loadFriendsImpl({
      authFetch,
      navigate,
      toast,
      setFriendsLoading,
      setFriends,
      setPendingRequests,
      clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token"),
    });
  }, [authFetch, navigate, toast]);

  useEffect(() => {
    if (!isOwnerEarly) return;
    // Load plunges for calorie + weekly stats
    fetch("/api/plunges", { headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setOwnerPlunges)
      .catch(() => {});
    // Load friends
    loadFriends();
  }, [isOwnerEarly, loadFriends]);

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
    setEditUsername(username ?? "");
    setUsernameStatus(null);
    setUsernameStatusMsg("");
    try { setEditLinks(JSON.parse(profile.socialLinks ?? "{}")); } catch { setEditLinks({}); }
    setShowEdit(true);
  }

  async function saveEdit() {
    const links: SocialLinks = {};
    for (const { key } of SOCIAL_META) {
      const val = (editLinks[key] ?? "").trim();
      if (val) links[key] = val;
    }
    const token = getAuthToken();
    // Save username if changed and available
    const newUsername = editUsername.trim();
    const currentUsername = username ?? "";
    let navigateToUsername: string | null = null;
    if (token && newUsername && newUsername.toLowerCase() !== currentUsername.toLowerCase() && usernameStatus === "ok") {
      const data = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername }),
      }).then(r => r.json()).catch(() => null);
      if (data?.username) navigateToUsername = data.username;
    }
    updateMeta.mutate({
      avatarUrl: editAvatarUrl.trim() || null,
      bio: editBio.trim(),
      socialLinks: JSON.stringify(links),
    });
    if (navigateToUsername) {
      setTimeout(() => navigate(`/profile/${navigateToUsername}`), 1600);
    }
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

  const updatedStr = new Date(profile.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const isOwner = !!myUsername && myUsername.toLowerCase() === profile.username.toLowerCase();

  // State/location badges — only meaningful when isOwner (localStorage is device-local)
  const earnedStateBadges = isOwner ? computeStateBadges(localBadges) : [];

  const totalEarned = totalEarnedTemp + totalEarnedDays + earnedStateBadges.length;

  const activeSocials = SOCIAL_META.filter(({ key }) => socialLinks[key]);


  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 flex flex-col items-center">
      {/* Close button */}
      <button
        data-testid="button-close-profile"
        onClick={() => {
          if (window.history.length > 1) {
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
              <h1 data-testid="text-profile-username" className="text-white font-bold text-xl leading-tight mb-0.5 truncate">{profile.username}</h1>

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

          {/* Brain Freeze head-to-head record — shown to logged-in viewers who have played against this user */}
          {h2hData?.record && (
            <div
              data-testid="h2h-record"
              className="mt-3 rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(14,30,54,0.8)", border: "1px solid rgba(34,211,238,0.12)" }}
            >
              <span className="text-blue-300 text-xs font-semibold">🧠 Brain Freeze</span>
              <span className="text-white text-xs font-bold">
                <span className="text-green-400">{h2hData.record.wins}W</span>
                {" · "}
                <span className="text-red-400">{h2hData.record.losses}L</span>
                {" · "}
                <span className="text-slate-400">{h2hData.record.ties}T</span>
                <span className="text-slate-500 font-normal ml-1">vs {profile.username.split(" ")[0]}</span>
              </span>
            </div>
          )}
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
                  url: `https://coldstreakapp.com/profile/${encodeURIComponent(profile.username)}`,
                  trackAs: "profile",
                  trackId: profile.username,
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

            {/* Avatar Upload */}
            <div>
              <label className="text-blue-300 text-xs font-semibold block mb-1">Profile Photo</label>
              <div className="flex items-center gap-3">
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt="Preview"
                    className="w-14 h-14 rounded-full object-cover border-2 border-blue-600 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                    data-testid="img-avatar-preview"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-950/70 border-2 border-blue-700 border-dashed flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-blue-500" />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <label
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-700/40 border border-cyan-600/50 text-cyan-200 text-xs font-semibold cursor-pointer hover:bg-cyan-600/40 transition-colors"
                    data-testid="label-upload-avatar"
                  >
                    {avatarUploading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="w-3.5 h-3.5" /> {editAvatarUrl ? "Change photo" : "Upload photo"}</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      data-testid="input-avatar-file"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = "";
                        if (file.size > 5 * 1024 * 1024) {
                          setAvatarError("Image must be under 5 MB");
                          return;
                        }
                        setAvatarError(null);
                        setAvatarUploading(true);
                        try {
                          const reqRes = await fetch("/api/uploads/request-url", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
                          });
                          if (!reqRes.ok) throw new Error("Could not get upload URL");
                          const { uploadURL, objectPath } = await reqRes.json();
                          const putRes = await fetch(uploadURL, {
                            method: "PUT",
                            body: file,
                            headers: { "Content-Type": file.type || "image/jpeg" },
                          });
                          if (!putRes.ok) throw new Error("Upload failed");
                          setEditAvatarUrl(objectPath);
                        } catch (err: any) {
                          setAvatarError(err?.message || "Upload failed");
                        } finally {
                          setAvatarUploading(false);
                        }
                      }}
                    />
                  </label>
                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl("")}
                      className="block text-[10px] text-blue-400 hover:text-red-400"
                      data-testid="button-remove-avatar"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
              {avatarError && (
                <p className="mt-2 text-[10px] text-red-400" data-testid="text-avatar-error">{avatarError}</p>
              )}
              <p className="mt-2 text-[10px] text-blue-500">
                JPG / PNG up to 5 MB. Bitmoji screenshots work great.
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="text-blue-300 text-xs font-semibold block mb-1">
                Username <span className="text-blue-500 font-normal">(how friends find you)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-sm select-none">@</span>
                <input
                  data-testid="input-edit-username"
                  type="text"
                  value={editUsername}
                  placeholder="yourhandle"
                  maxLength={30}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                    setEditUsername(val);
                    setUsernameStatus(null);
                    setUsernameStatusMsg("");
                    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
                    if (!val || val.toLowerCase() === (username ?? "").toLowerCase()) {
                      setUsernameStatus(val ? "ok" : null);
                      setUsernameStatusMsg("");
                      setUsernameChecking(false);
                      return;
                    }
                    setUsernameChecking(true);
                    usernameCheckRef.current = setTimeout(async () => {
                      const r = await fetch(`/api/auth/check-username?username=${encodeURIComponent(val)}`);
                      const data = await r.json();
                      setUsernameChecking(false);
                      if (data.available) {
                        setUsernameStatus("ok");
                        setUsernameStatusMsg("Available!");
                      } else {
                        setUsernameStatus(data.reason?.toLowerCase().includes("taken") ? "taken" : "invalid");
                        setUsernameStatusMsg(data.reason ?? "Not available");
                      }
                    }, 500);
                  }}
                  className="w-full bg-blue-950/70 border border-blue-700 rounded-xl pl-7 pr-8 py-2 text-white text-xs placeholder:text-blue-600 focus:outline-none focus:border-cyan-500"
                />
                {usernameChecking && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                )}
                {!usernameChecking && usernameStatus === "ok" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-xs">✓</span>
                )}
                {!usernameChecking && (usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-xs">✗</span>
                )}
              </div>
              {usernameStatus === "ok" && usernameStatusMsg && (
                <p className="mt-1 text-[10px] text-green-400">{usernameStatusMsg}</p>
              )}
              {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                <p className="mt-1 text-[10px] text-red-400">{usernameStatusMsg}</p>
              )}
              <p className="mt-1 text-[10px] text-blue-500">Letters, numbers, underscores only. Friends search by this.</p>
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

        {/* ── Owner-only: Body Weight + Calories ── */}
        {isOwner && (() => {
          const now = new Date();
          const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
          const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
          const todayPlunges = ownerPlunges.filter(p => { const d = new Date(p.createdAt); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey; });
          const thisWeek = ownerPlunges.filter(p => new Date(p.createdAt).getTime() >= weekAgo);
          const bfPct = Number(localStorage.getItem("coldstreak-body-fat") || 0) || null;
          const todayCalories = todayPlunges.reduce((s, p) => s + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs, bfPct))), 0);
          const weeklyCalories = thisWeek.reduce((s, p) => s + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs, bfPct))), 0);
          const allTimeCalories = ownerPlunges.reduce((s, p) => s + (p.calories ?? Math.round(estimateCalories(p.duration, p.temperature, bodyWeightLbs, bfPct))), 0);
          const weeklyMinutes = thisWeek.reduce((s, p) => s + p.duration, 0) / 60;
          const weeklyPct = Math.min(100, (weeklyMinutes / weeklyGoalMinutes) * 100);

          const saveWeightToServer = (val: number) => {
            const token = getAuthToken();
            if (token) fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ bodyWeight: val }) }).catch(() => {});
          };
          const stopHold = () => {
            if (weightHoldRef.current) { clearTimeout(weightHoldRef.current); weightHoldRef.current = null; }
            weightHoldCountRef.current = 0;
            const stored = Number(localStorage.getItem("coldstreak-body-weight"));
            if (stored) saveWeightToServer(stored);
          };
          const startHold = (dir: 1 | -1) => {
            const tick = () => {
              weightHoldCountRef.current += 1;
              const fast = weightHoldCountRef.current > 20;
              const step = fast ? 5 : 1;
              const delay = fast ? 60 : 120;
              setBodyWeightLbs(prev => {
                const val = Math.min(400, Math.max(80, prev + dir * step));
                localStorage.setItem("coldstreak-body-weight", String(val));
                return val;
              });
              weightHoldRef.current = setTimeout(tick, delay);
            };
            weightHoldRef.current = setTimeout(tick, 350);
          };
          const pressProps = (dir: 1 | -1) => ({
            onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); startHold(dir); },
            onMouseUp: stopHold, onMouseLeave: stopHold,
            onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); startHold(dir); },
            onTouchEnd: stopHold,
            onClick: () => {
              if (weightHoldCountRef.current > 0) return;
              setBodyWeightLbs(prev => {
                const val = Math.min(400, Math.max(80, prev + dir));
                localStorage.setItem("coldstreak-body-weight", String(val));
                saveWeightToServer(val);
                return val;
              });
            },
          });

          return (<>
            {/* Body Weight + Calories */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" /> Body Weight
              </label>
              <div className="flex items-center gap-2">
                <button {...pressProps(-1)} className="w-8 h-8 rounded-lg bg-blue-800/80 border border-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-95 hover:border-cyan-400 select-none">−</button>
                <div className="w-20 bg-blue-800/80 border border-blue-600 rounded-xl px-2 py-1.5 text-white text-sm font-bold text-center select-none">{bodyWeightLbs}</div>
                <button {...pressProps(1)} className="w-8 h-8 rounded-lg bg-blue-800/80 border border-blue-600 text-white text-lg font-bold flex items-center justify-center active:scale-95 hover:border-cyan-400 select-none">+</button>
                <span className="text-blue-500 text-xs">lbs ({Math.round(bodyWeightLbs / 2.205)} kg)</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center border-t border-blue-800/60 pt-3">
                <div>
                  <div className="text-orange-300 font-bold text-base leading-none">{Math.round(todayCalories) || "—"}</div>
                  <div className="text-blue-500 text-[10px] mt-0.5">kcal today</div>
                </div>
                <div className="border-x border-blue-800/60">
                  <div className="text-orange-300 font-bold text-base leading-none">{Math.round(weeklyCalories) || "—"}</div>
                  <div className="text-blue-500 text-[10px] mt-0.5">kcal this week</div>
                </div>
                <div>
                  <div className="text-orange-300 font-bold text-base leading-none">{Math.round(allTimeCalories) || "—"}</div>
                  <div className="text-blue-500 text-[10px] mt-0.5">kcal all time</div>
                </div>
              </div>
              <p className="text-blue-600 text-[10px] mt-2">Est. via thermogenesis — cold forces your body to generate heat.</p>
            </div>

            {/* Weekly Goal */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40">
              <label className="text-blue-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> Weekly Goal
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={weeklyGoalMinutes}
                  onChange={(e) => { const val = Number(e.target.value); setWeeklyGoalMinutes(val); localStorage.setItem("weeklyGoalMinutes", String(val)); }}
                  className="bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm font-semibold appearance-none focus:outline-none focus:border-cyan-400"
                >
                  {Array.from({ length: 110 }, (_, i) => i + 11).map((m) => (
                    <option key={m} value={m}>{m} min / week</option>
                  ))}
                </select>
                <span className="text-blue-400 text-xs">{weeklyMinutes.toFixed(1)} min done</span>
              </div>
              <div className="mt-2 h-2 bg-blue-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
              </div>
            </div>

            {/* Friends */}
            <div className="bg-blue-900/60 rounded-2xl p-4 border border-blue-700/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-blue-400 text-xs uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" /> Friends
                </label>
                {pendingRequests.length > 0 && (
                  <span className="bg-cyan-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{pendingRequests.length}</span>
                )}
              </div>
              <div className="flex gap-1 bg-blue-950/60 rounded-xl p-1">
                {(['leaderboard', 'requests', 'add'] as const).map((v) => (
                  <button key={v} onClick={() => setFriendsView(v)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${friendsView === v ? 'bg-blue-700/80 text-white' : 'text-blue-400 hover:text-blue-200'}`}>
                    {v === 'leaderboard' ? '🏆 Board' : v === 'requests' ? (
                      <span>📨 Requests{pendingRequests.length > 0 && <span className="ml-1 bg-cyan-500 text-white text-[9px] rounded-full px-1">{pendingRequests.length}</span>}</span>
                    ) : '➕ Add'}
                  </button>
                ))}
              </div>
              {friendsView === 'leaderboard' && (
                <div className="space-y-2">
                  {friendsLoading ? (
                    <div className="text-blue-400 text-xs text-center py-4">Loading…</div>
                  ) : friends.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <div className="text-2xl">🧊</div>
                      <p className="text-blue-400 text-xs">No friends yet — add some to see the board!</p>
                    </div>
                  ) : friends.map((f, i) => (
                    <div key={f.friendshipId} className="flex items-center gap-2 bg-blue-950/60 rounded-xl px-3 py-2.5 border border-blue-800/40 cursor-pointer hover:bg-blue-900/60 transition-colors active:scale-[0.98]"
                      onClick={() => { if (f.username) navigate(`/profile/${encodeURIComponent(f.username)}`); }}>
                      <span className="text-blue-500 text-xs font-bold w-4 shrink-0">{i + 1}</span>
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-blue-700/50" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center shrink-0 border border-blue-700/50"><User className="w-4 h-4 text-blue-400" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{f.displayName || f.username || 'Unknown'}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-orange-400 text-[10px]">🔥 {f.streak}d</span>
                          {f.latestScore != null && <span className="text-cyan-300 text-[10px]">Latest: {f.latestScore.toFixed(1)}</span>}
                        </div>
                      </div>
                      <button disabled={challengingId === f.userId}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setChallengingId(f.userId);
                          await sendFriendChallengeImpl(f.userId, f.displayName || f.username || "Friend", {
                            authFetch, navigate, toast,
                            onSettled: () => setChallengingId(null),
                            clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token"),
                          });
                        }}
                        className="shrink-0 px-2 py-1 rounded-lg bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold hover:bg-cyan-600/50 transition-all active:scale-95 disabled:opacity-40"
                      >{challengingId === f.userId ? '…' : '⚡'}</button>
                    </div>
                  ))}
                </div>
              )}
              {friendsView === 'requests' && (
                <div className="space-y-2">
                  {pendingRequests.length === 0 ? (
                    <p className="text-blue-400 text-xs text-center py-4">No pending requests</p>
                  ) : pendingRequests.map(req => (
                    <div key={req.friendshipId} className="flex items-center gap-2 bg-blue-950/60 rounded-xl px-3 py-2.5 border border-blue-800/40 cursor-pointer hover:bg-blue-900/60 active:scale-[0.98]"
                      onClick={() => { if (req.requesterUsername) navigate(`/profile/${encodeURIComponent(req.requesterUsername)}`); }}>
                      {req.requesterAvatarUrl ? (
                        <img src={req.requesterAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-blue-700/50" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-blue-400" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{req.requesterDisplayName || req.requesterUsername || 'Unknown'}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-blue-500 text-[10px]">@{req.requesterUsername}</span>
                          {req.requesterStreak > 0 && <span className="text-orange-400 text-[10px] font-semibold">🔥 {req.requesterStreak}d</span>}
                          {req.requesterPlungeCount > 0 && <span className="text-cyan-400 text-[10px] font-semibold">🧊 {req.requesterPlungeCount}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={async (e) => { e.stopPropagation(); await respondFriendRequestImpl(req.friendshipId, 'accepted', { authFetch, navigate, toast, onSuccess: async () => { await loadFriends(); setFriendsView('leaderboard'); }, clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token") }); }}
                          className="px-2 py-1 rounded-lg bg-cyan-600 text-white text-[10px] font-bold hover:bg-cyan-500 active:scale-95">✓</button>
                        <button onClick={async (e) => { e.stopPropagation(); await respondFriendRequestImpl(req.friendshipId, 'declined', { authFetch, navigate, toast, onSuccess: async () => { await loadFriends(); }, clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token") }); }}
                          className="px-2 py-1 rounded-lg bg-blue-800/80 border border-blue-700 text-blue-400 text-[10px] font-bold hover:border-blue-500 active:scale-95">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {friendsView === 'add' && (
                <div className="space-y-2">
                  {/* Username tip */}
                  <div className="flex items-start gap-2 bg-cyan-900/20 border border-cyan-700/30 rounded-xl px-3 py-2">
                    <span className="text-cyan-400 text-sm shrink-0">💡</span>
                    <p className="text-cyan-300/80 text-[11px] leading-snug">
                      Friends search by your <span className="font-semibold text-cyan-200">@username</span>. No username yet?{" "}
                      <button onClick={() => { setFriendsView('leaderboard'); setTimeout(openEdit, 100); }} className="underline text-cyan-300 hover:text-white transition-colors">Edit your profile</button> to set one.
                    </p>
                  </div>

                  <input type="text" placeholder="Search by username…" value={friendSearch}
                    onChange={async (e) => {
                      const q = e.target.value; setFriendSearch(q);
                      if (q.length < 2) { setFriendSearchResults([]); return; }
                      await searchFriendsImpl(q, { authFetch, navigate, toast, setFriendsSearchLoading, setFriendSearchResults: (results) => setFriendSearchResults(results.filter((result): result is UserResult => result.username !== null)), clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token") });
                    }}
                    className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                  />
                  {friendsSearchLoading && <div className="text-blue-400 text-xs text-center py-2">Searching…</div>}
                  {friendSearchResults.map(u => (
                    <div key={u.id} className="flex items-center gap-2 bg-blue-950/60 rounded-xl px-3 py-2.5 border border-blue-800/40">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-blue-700/50" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-800 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5 text-blue-400" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{u.displayName || u.username}</div>
                        <div className="text-blue-500 text-[10px]">@{u.username}</div>
                      </div>
                      {u.friendshipStatus === 'accepted' ? (
                        <span className="text-cyan-400 text-[10px] font-bold">Friends ✓</span>
                      ) : u.friendshipStatus === 'pending' ? (
                        <span className="text-blue-400 text-[10px]">Pending…</span>
                      ) : (
                        <button onClick={async () => { await sendFriendRequestImpl(u.id, u.displayName || u.username || "them", { authFetch, navigate, toast, onSuccess: (id) => setFriendSearchResults(prev => prev.map(x => x.id === id ? { ...x, friendshipStatus: 'pending' } : x)), clearAuthToken: () => localStorage.removeItem("coldstreak-auth-token") }); }}
                          className="shrink-0 px-2 py-1 rounded-lg bg-cyan-600 text-white text-[10px] font-bold hover:bg-cyan-500 active:scale-95">+ Add</button>
                      )}
                    </div>
                  ))}

                  {/* No results — offer email invite */}
                  {friendSearch.length >= 2 && !friendsSearchLoading && friendSearchResults.length === 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-blue-400 text-xs text-center">
                        No username found for <span className="text-white font-semibold">"{friendSearch}"</span>.
                      </p>
                      <div className="bg-blue-900/50 border border-blue-700/40 rounded-xl p-3 space-y-2">
                        <p className="text-blue-300 text-[11px] font-semibold">They haven't set a username yet?</p>
                        <p className="text-blue-400/80 text-[11px] leading-snug">Send them an email invite — once they join and set a username, you can add them as a friend.</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="their@email.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            className="flex-1 bg-blue-800/80 border border-blue-600 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            disabled={inviteSending || !inviteEmail.includes('@')}
                            onClick={async () => {
                              setInviteSending(true);
                              try {
                                const r = await authFetch('/api/friends/invite-by-email', {
                                  method: 'POST',
                                  body: JSON.stringify({ email: inviteEmail }),
                                });
                                const data = await r.json();
                                if (data.status === 'request_sent') {
                                  toast({ title: "Friend request sent!", description: `They have an account — request sent to ${data.username ? '@' + data.username : 'them'}.` });
                                  setFriendSearch(''); setInviteEmail(''); setFriendSearchResults([]);
                                } else if (data.status === 'already_friends') {
                                  toast({ title: "Already friends!", description: "You're already connected with that person." });
                                } else if (data.status === 'request_pending') {
                                  toast({ title: "Already pending", description: "You already have a pending request with them." });
                                } else {
                                  toast({ title: "Invite sent! 📧", description: `We emailed ${inviteEmail} an invite to join ColdStreak.` });
                                  setInviteEmail('');
                                }
                              } catch {
                                toast({ title: "Couldn't send", description: "Check the email and try again.", variant: "destructive" });
                              } finally {
                                setInviteSending(false);
                              }
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 active:scale-95 disabled:opacity-40 transition-all"
                          >
                            {inviteSending ? '…' : 'Invite'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>);
        })()}

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

        {/* State / Location Badges (owner only — stored locally) */}
        {earnedStateBadges.length > 0 && (
          <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">State Badges</p>
            <div className="flex flex-wrap gap-3">
              {earnedStateBadges.map((state) => (
                <div key={state} className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{(STATE_EMOJI as Record<string, string>)[state] ?? "🏆"}</span>
                  <span className="text-white text-sm font-semibold">{state}</span>
                </div>
              ))}
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
