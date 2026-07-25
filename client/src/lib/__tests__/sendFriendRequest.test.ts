import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendFriendRequest } from "../sendFriendRequest";

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

describe("sendFriendRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onSuccess and shows a confirmation toast on a successful response", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(201, { ok: true }));
    const deps = makeDeps(authFetch);

    await sendFriendRequest(42, "Alice", deps);

    expect(authFetch).toHaveBeenCalledWith(
      "/api/friends/request",
      expect.objectContaining({ method: "POST" }),
    );
    expect(deps.onSuccess).toHaveBeenCalledWith(42);
    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Request sent! 🧊" }),
    );
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.clearAuthToken).not.toHaveBeenCalled();
  });

  it("includes the addresseeId in the POST body", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(201, { ok: true }));
    const deps = makeDeps(authFetch);

    await sendFriendRequest(99, "Bob", deps);

    const callOpts = authFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(callOpts.body as string)).toEqual({ addresseeId: 99 });
  });

  it("clears the auth token and redirects to / on a 401", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));
    const deps = makeDeps(authFetch);

    await sendFriendRequest(42, "Alice", deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("shows a destructive toast on a non-ok, non-401 error response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }));
    const deps = makeDeps(authFetch);

    await sendFriendRequest(42, "Alice", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't send request",
        variant: "destructive",
      }),
    );
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("shows a destructive toast when fetch throws a network error", async () => {
    const authFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const deps = makeDeps(authFetch);

    await sendFriendRequest(42, "Alice", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't send request",
        variant: "destructive",
      }),
    );
    expect(deps.onSuccess).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
