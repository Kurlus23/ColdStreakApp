/** Standalone, dependency-injected implementation of the send-friend-request logic.
 *  Kept here so it can be imported and unit-tested without mounting Home.tsx.
 */

export interface SendFriendRequestDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  onSuccess: (addresseeId: number) => void;
  clearAuthToken: () => void;
}

export async function sendFriendRequest(
  addresseeId: number,
  displayName: string,
  deps: SendFriendRequestDeps,
): Promise<void> {
  const { authFetch, navigate, toast, onSuccess, clearAuthToken } = deps;

  try {
    const res = await authFetch("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ addresseeId }),
    });

    if (res.status === 401) {
      clearAuthToken();
      navigate("/");
      return;
    }

    if (!res.ok) {
      toast({
        title: "Couldn't send request",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    onSuccess(addresseeId);
    toast({
      title: "Request sent! 🧊",
      description: `${displayName} will get a notification.`,
    });
  } catch {
    toast({
      title: "Couldn't send request",
      description: "Please check your connection and try again.",
      variant: "destructive",
    });
  }
}
