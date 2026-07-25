import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadFriends, type FriendEntry, type FriendRequest } from "../loadFriends";

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
  });

  it("populates friends and requests on a successful response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, sampleFriends))
      .mockResolvedValueOnce(makeResponse(200, sampleRequests));

    const deps = makeDeps(authFetch);
    await loadFriends(deps);

    expect(deps.setFriendsLoading).toHaveBeenCalledWith(true);
    expect(deps.setFriends).toHaveBeenCalledWith(sampleFriends);
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
    expect(deps.setFriendsLoading).toHaveBeenCalledWith(false);
  });
});
