import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheFriends, loadFriends, readCachedFriends, type FriendEntry, type FriendRequest } from "../loadFriends";

// ---- helpers ----------------------------------------------------------------

function makeResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeDeps(authFetch: (url: string) => Promise<Response>) {
  return {
    authFetch,
    navigate: vi.fn(),
    toast: vi.fn(),
    setFriendsLoading: vi.fn(),
    setFriends: vi.fn(),
    setPendingRequests: vi.fn(),
    setMyBf: vi.fn(),
    setFriendsLoadError: vi.fn(),
    onFriendsLoaded: vi.fn(),
    clearAuthToken: vi.fn(),
  };
}

// ---- sample data ------------------------------------------------------------

const sampleFriends: FriendEntry[] = [
  {
    friendshipId: 1,
    userId: 42,
    username: "alice",
    displayName: "Alice",
    avatarUrl: null,
    streak: 5,
    latestScore: 3.5,
    bestScore: 4.2,
  },
];

const sampleRequests: FriendRequest[] = [
  {
    friendshipId: 2,
    requesterId: 99,
    requesterUsername: "bob",
    requesterDisplayName: "Bob",
    requesterAvatarUrl: null,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

// ---- tests ------------------------------------------------------------------

describe("loadFriends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("populates friends and requests on a successful response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, {
        friends: sampleFriends,
        myBf: { thisPlunge: 120, today: 240, allTime: 480 },
      }))
      .mockResolvedValueOnce(makeResponse(200, sampleRequests));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.setFriendsLoading).toHaveBeenCalledWith(true);
    expect(deps.setFriends).toHaveBeenCalledWith(sampleFriends);
    expect(deps.onFriendsLoaded).toHaveBeenCalledWith(sampleFriends);
    expect(deps.setFriendsLoadError).toHaveBeenCalledWith(null);
    expect(deps.setMyBf).toHaveBeenCalledWith({ thisPlunge: 120, today: 240, allTime: 480 });
    expect(deps.setPendingRequests).toHaveBeenCalledWith(sampleRequests);
    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });

  it("clears the auth token and redirects to / on a 401 from /api/friends", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(makeResponse(200, sampleRequests));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.setFriends).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
    // loading flag must still be reset
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });

  it("clears the auth token and redirects to / on a 401 from /api/friends/requests", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, sampleFriends))
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.setFriends).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });

  it("shows a destructive toast on a non-ok, non-401 error response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }))
      .mockResolvedValueOnce(makeResponse(200, sampleRequests));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't load friends",
        variant: "destructive",
      })
    );
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriends).not.toHaveBeenCalled();
    expect(deps.setFriendsLoadError).toHaveBeenCalledWith(
      "We couldn't refresh your friends. Check your connection and try again."
    );
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });

  it("shows a destructive toast when fetch throws a network error", async () => {
    const authFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't load friends",
        variant: "destructive",
      })
    );
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriends).not.toHaveBeenCalled();
    expect(deps.setFriendsLoadError).toHaveBeenCalledWith(
      "We couldn't refresh your friends. Check your connection and try again."
    );
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });

  it("reports malformed friends data as a refresh failure without clearing the current list", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, { unexpected: true }))
      .mockResolvedValueOnce(makeResponse(200, sampleRequests));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.setFriends).not.toHaveBeenCalled();
    expect(deps.setFriendsLoadError).toHaveBeenCalledWith(
      "We couldn't refresh your friends. Check your connection and try again."
    );
  });

  it("restores only the matching account's saved friend list", () => {
    cacheFriends(12, sampleFriends);

    expect(readCachedFriends(12)).toEqual(sampleFriends);
    expect(readCachedFriends(13)).toBeNull();
  });

  it("ignores corrupted cached friend data", () => {
    localStorage.setItem("coldstreak-friends-cache:v1:12", JSON.stringify([{ friendshipId: "not-a-number" }]));

    expect(readCachedFriends(12)).toBeNull();
  });
});
