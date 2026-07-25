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

export interface LoadFriendsDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  setFriendsLoading: (v: boolean) => void;
  setFriends: (v: FriendEntry[]) => void;
  setPendingRequests: (v: FriendRequest[]) => void;
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
      toast({
        title: "Couldn't load friends",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    const [fr, pr] = await Promise.all([friendsRes.json(), requestsRes.json()]);
    if (Array.isArray(fr)) setFriends(fr);
    if (Array.isArray(pr)) setPendingRequests(pr);
  } catch {
    toast({
      title: "Couldn't load friends",
      description: "Please check your connection and try again.",
      variant: "destructive",
    });
  } finally {
    setFriendsLoading(false);
  }
}
