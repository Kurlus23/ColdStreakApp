/**
 * Handles messages posted from the service worker to the app window.
 *
 * Extracted so it can be unit-tested independently of the Home component.
 */

export interface SwMessageDeps {
  toast: (opts: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
  loadFriends: () => void;
  setActiveChallengerUserId: (id: number) => void;
  /** Returns true when the user is currently on the Friends screen. */
  isOnFriendsScreen: () => boolean;
  setFriendsBadge: (value: boolean) => void;
}

export function handleSwMessage(
  event: MessageEvent,
  deps: SwMessageDeps,
): void {
  const { toast, loadFriends, setActiveChallengerUserId, isOnFriendsScreen, setFriendsBadge } =
    deps;

  if (event.data?.type === "notification-navigate") {
    const url = event.data?.url ?? "";
    const id = Number(new URLSearchParams(url.split("?")[1] ?? "").get("challenger"));
    if (id) setActiveChallengerUserId(id);
  } else if (event.data?.type === "friend-request-resolved") {
    loadFriends();
    const requesterName: string | null = event.data.requesterName ?? null;
    const resolution: string | null = event.data.resolution ?? null;
    if (requesterName && resolution) {
      const verb = resolution === "accepted" ? "accepted" : "declined";
      toast({
        title: resolution === "accepted" ? "🎉 Friend request accepted" : "Friend request declined",
        description: `${requesterName} ${verb} your friend request.`,
      });
    }
    if (!isOnFriendsScreen()) {
      localStorage.setItem("coldstreak-friends-badge", "1");
      setFriendsBadge(true);
    }
  } else if (event.data?.type === "friend-action-failed") {
    toast({
      title: "Action failed",
      description:
        event.data.message || "Something went wrong. Please try again in the app.",
      variant: "destructive",
    });
  }
}
