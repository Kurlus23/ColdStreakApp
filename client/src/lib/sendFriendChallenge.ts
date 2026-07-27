/** Standalone, dependency-injected implementation of the send-challenge logic.
 *  Kept here so it can be imported and unit-tested without mounting Home.tsx.
 */

export interface SendFriendChallengeDeps {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  navigate: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: string }) => void;
  onSettled: () => void;
  clearAuthToken: () => void;
}

export async function sendFriendChallenge(
  friendUserId: number,
  displayName: string,
  deps: SendFriendChallengeDeps,
): Promise<void> {
  const { authFetch, navigate, toast, onSettled, clearAuthToken } = deps;

  try {
    const res = await authFetch(`/api/friends/challenge/${friendUserId}`, {
      method: "POST",
    });

    if (res.status === 401) {
      clearAuthToken();
      navigate("/");
      onSettled();
      return;
    }

    if (!res.ok) {
      toast({
        title: "Couldn't send challenge",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      onSettled();
      return;
    }

    const r = await res.json();
    toast({
      title: "❄️ Challenge sent!",
      description: r.sent
        ? `${displayName} was notified.`
        : `${displayName} will see it next time they open the app.`,
    });
  } catch {
    toast({
      title: "Couldn't send challenge",
      description: "Please check your connection and try again.",
      variant: "destructive",
    });
  } finally {
    onSettled();
  }
}
