/** Standalone, dependency-injected implementation of the loadFriends logic.
 *  Kept here so it can be imported and unit-tested without mounting Home.tsx.
 */

export interface FriendEntry {
  friendshipId: number;
  userId: number;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  streak: number;
  plungedToday: boolean;
  latestScore: number | null;
  bestScore: number | null;
  bfScoreThisPlunge?: number | null;
  bfScoreToday?: number;
  bfScoreAllTime?: number;
}

export interface BrainFreezeStats {
  thisPlunge: number | null;
  today: number;
  allTime: number;
}

export interface FriendRequest {
  friendshipId: number;
  requesterId: number;
  requesterUsername: string | null;
  requesterDisplayName: string | null;
  requesterAvatarUrl: string | null;
  requesterStreak: number;
  requesterPlungeCount: number;
  createdAt: string;
}

const FRIENDS_CACHE_PREFIX = "coldstreak-friends-cache:v1:";

function isFriendEntry(value: unknown): value is FriendEntry {
  if (!value || typeof value !== "object") return false;
  const friend = value as Partial<FriendEntry>;
  return typeof friend.friendshipId === "number"
    && typeof friend.userId === "number"
    && (friend.username === null || typeof friend.username === "string")
    && (friend.displayName === null || typeof friend.displayName === "string");
}

/**
 * The Friends screen may be recreated while a native WebView is backgrounded.
 * Keep only the most recently confirmed list, keyed by account, so a transient
 * refresh failure never looks like all friendships were removed.
 */
export function readCachedFriends(userId: number | null | undefined): FriendEntry[] | null {
  if (!Number.isInteger(userId)) return null;
  try {
    const raw = localStorage.getItem(`${FRIENDS_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isFriendEntry) ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheFriends(userId: number | null | undefined, friends: FriendEntry[]): void {
  if (!Number.isInteger(userId)) return;
  try {
    localStorage.setItem(`${FRIENDS_CACHE_PREFIX}${userId}`, JSON.stringify(friends));
  } catch {
    // Storage is an enhancement only; a successful server response still renders.
  }
}

export interface LoadFriendsDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" | null }) => unknown;
  setFriendsLoading: (v: boolean) => void;
  setFriends: (v: FriendEntry[]) => void;
  setPendingRequests: (v: FriendRequest[]) => void;
  setMyBf?: (v: BrainFreezeStats) => void;
  setFriendsLoadError?: (message: string | null) => void;
  onFriendsLoaded?: (friends: FriendEntry[]) => void;
  clearAuthToken: () => void;
}

export async function loadFriends(deps: LoadFriendsDeps): Promise<void> {
  const {
    authFetch,
    navigate,
    toast,
    setFriendsLoading,
    setFriends,
    setPendingRequests,
    clearAuthToken,
  } = deps;

  setFriendsLoading(true);
  deps.setFriendsLoadError?.(null);
  try {
    const [friendsRes, requestsRes] = await Promise.all([
      authFetch("/api/friends"),
      authFetch("/api/friends/requests"),
    ]);

    if (friendsRes.status === 401 || requestsRes.status === 401) {
      clearAuthToken();
      navigate("/");
      return;
    }

    if (!friendsRes.ok || !requestsRes.ok) {
      deps.setFriendsLoadError?.("We couldn't refresh your friends. Check your connection and try again.");
      toast({
        title: "Couldn't load friends",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    const [fr, pr] = await Promise.all([friendsRes.json(), requestsRes.json()]);
    // fr is now { friends: FriendEntry[], myBf: BrainFreezeStats }
    if (fr && Array.isArray(fr.friends)) {
      setFriends(fr.friends);
      deps.onFriendsLoaded?.(fr.friends);
      if (fr.myBf && deps.setMyBf) deps.setMyBf(fr.myBf);
    } else if (Array.isArray(fr)) {
      // backward-compat fallback
      setFriends(fr);
      deps.onFriendsLoaded?.(fr);
    } else {
      deps.setFriendsLoadError?.("We couldn't refresh your friends. Check your connection and try again.");
      toast({
        title: "Couldn't load friends",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }
    if (Array.isArray(pr)) setPendingRequests(pr);
  } catch {
    deps.setFriendsLoadError?.("We couldn't refresh your friends. Check your connection and try again.");
    toast({
      title: "Couldn't load friends",
      description: "Please check your connection and try again.",
      variant: "destructive",
    });
  } finally {
    setFriendsLoading(false);
  }
}
