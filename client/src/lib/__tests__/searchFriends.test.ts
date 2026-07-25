import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchFriends, type UserResult } from "../searchFriends";

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
    setFriendsSearchLoading: vi.fn(),
    setFriendSearchResults: vi.fn(),
    clearAuthToken: vi.fn(),
  };
}

// ---- sample data ------------------------------------------------------------

const sampleResults: UserResult[] = [
  {
    id: 7,
    username: "alice",
    displayName: "Alice",
    avatarUrl: null,
    friendshipStatus: null,
  },
  {
    id: 8,
    username: "alicia",
    displayName: "Alicia",
    avatarUrl: "https://example.com/avatar.jpg",
    friendshipStatus: "accepted",
  },
];

// ---- tests ------------------------------------------------------------------

describe("searchFriends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates search results on a successful response", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, sampleResults));
    const deps = makeDeps(authFetch);

    await searchFriends("ali", deps);

    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/users/search?q=ali"),
    );
    expect(deps.setFriendsSearchLoading).toHaveBeenCalledWith(true);
    expect(deps.setFriendSearchResults).toHaveBeenCalledWith(sampleResults);
    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriendsSearchLoading).toHaveBeenCalledWith(false);
  });

  it("URL-encodes the query string", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, []));
    const deps = makeDeps(authFetch);

    await searchFriends("hello world", deps);

    expect(authFetch).toHaveBeenCalledWith(
      expect.stringContaining("q=hello%20world"),
    );
  });

  it("clears the auth token and redirects to / on a 401", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));
    const deps = makeDeps(authFetch);

    await searchFriends("ali", deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.setFriendSearchResults).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
    // loading flag must still be reset
    expect(deps.setFriendsSearchLoading).toHaveBeenCalledWith(false);
  });

  it("shows a destructive toast on a non-ok, non-401 error response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }));
    const deps = makeDeps(authFetch);

    await searchFriends("ali", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Search failed, please try again",
        variant: "destructive",
      }),
    );
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriendSearchResults).not.toHaveBeenCalled();
    expect(deps.setFriendsSearchLoading).toHaveBeenCalledWith(false);
  });

  it("shows a destructive toast when fetch throws a network error", async () => {
    const authFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const deps = makeDeps(authFetch);

    await searchFriends("ali", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Search failed, please try again",
        variant: "destructive",
      }),
    );
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.setFriendSearchResults).not.toHaveBeenCalled();
    expect(deps.setFriendsSearchLoading).toHaveBeenCalledWith(false);
  });
});
