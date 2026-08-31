/** Standalone, dependency-injected implementation of the friend-search logic.
 *  Kept here so it can be imported and unit-tested without mounting Home.tsx.
 */

export interface UserResult {
  id: number;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  friendshipStatus: string | null;
}

export interface SearchFriendsDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" | null }) => unknown;
  setFriendsSearchLoading: (v: boolean) => void;
  setFriendSearchResults: (v: UserResult[]) => void;
  clearAuthToken: () => void;
}

export async function searchFriends(
  query: string,
  deps: SearchFriendsDeps,
): Promise<void> {
  const {
    authFetch,
    navigate,
    toast,
    setFriendsSearchLoading,
    setFriendSearchResults,
    clearAuthToken,
  } = deps;

  setFriendsSearchLoading(true);
  try {
    const res = await authFetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (res.status === 401) {
      clearAuthToken();
      navigate("/");
      return;
    }
    if (!res.ok) {
      toast({ title: "Search failed, please try again", variant: "destructive" });
      return;
    }
    const r = await res.json();
    if (Array.isArray(r)) setFriendSearchResults(r);
  } catch {
    toast({ title: "Search failed, please try again", variant: "destructive" });
  } finally {
    setFriendsSearchLoading(false);
  }
}
