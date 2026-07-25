/** Standalone, dependency-injected implementation of the respond-to-friend-request logic.
 *  Kept here so it can be imported and unit-tested without mounting Home.tsx.
 */

export interface RespondFriendRequestDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  onSuccess: () => void;
  clearAuthToken: () => void;
}

export async function respondFriendRequest(
  friendshipId: number,
  status: "accepted" | "declined",
  deps: RespondFriendRequestDeps,
): Promise<void> {
  const { authFetch, navigate, toast, onSuccess, clearAuthToken } = deps;

  try {
    const res = await authFetch("/api/friends/respond", {
      method: "POST",
      body: JSON.stringify({ friendshipId, status }),
    });

    if (res.status === 401) {
      clearAuthToken();
      navigate("/");
      return;
    }

    if (!res.ok) {
      toast({
        title: status === "accepted" ? "Couldn't accept request" : "Couldn't decline request",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    onSuccess();
  } catch {
    toast({
      title: status === "accepted" ? "Couldn't accept request" : "Couldn't decline request",
      description: "Please check your connection and try again.",
      variant: "destructive",
    });
  }
}
