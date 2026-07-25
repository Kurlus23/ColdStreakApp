import { describe, it, expect, vi, beforeEach } from "vitest";
import { respondFriendRequest } from "../respondFriendRequest";

// ---- helpers ----------------------------------------------------------------

function makeResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeDeps(authFetch: (url: string, opts?: RequestInit) => Promise<Response>) {
  return {
    authFetch,
    navigate: vi.fn(),
    toast: vi.fn(),
    onSuccess: vi.fn(),
    clearAuthToken: vi.fn(),
  };
}

// ---- tests ------------------------------------------------------------------

describe("respondFriendRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onSuccess on a successful accept response", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "accepted", deps);

    expect(authFetch).toHaveBeenCalledWith(
      "/api/friends/respond",
      expect.objectContaining({ method: "POST" }),
    );
    const callOpts = authFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(callOpts.body as string)).toEqual({ friendshipId: 7, status: "accepted" });
    expect(deps.onSuccess).toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.clearAuthToken).not.toHaveBeenCalled();
  });

  it("calls onSuccess on a successful decline response", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "declined", deps);

    expect(deps.onSuccess).toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("clears the auth token and redirects to / on a 401", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "accepted", deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("shows a destructive toast on a non-ok, non-401 error response for accept", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "accepted", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't accept request",
        variant: "destructive",
      }),
    );
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("shows a destructive toast on a non-ok, non-401 error response for decline", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "declined", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't decline request",
        variant: "destructive",
      }),
    );
    expect(deps.onSuccess).not.toHaveBeenCalled();
  });

  it("shows a destructive toast when fetch throws a network error", async () => {
    const authFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const deps = makeDeps(authFetch);

    await respondFriendRequest(7, "accepted", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't accept request",
        variant: "destructive",
      }),
    );
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
