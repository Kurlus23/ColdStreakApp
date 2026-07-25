import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendFriendChallenge } from "../sendFriendChallenge";

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
    onSettled: vi.fn(),
    clearAuthToken: vi.fn(),
  };
}

// ---- tests ------------------------------------------------------------------

describe("sendFriendChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a success toast and calls onSettled on a successful response", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, { sent: true }));
    const deps = makeDeps(authFetch);

    await sendFriendChallenge(42, "Alice", deps);

    expect(authFetch).toHaveBeenCalledWith(
      "/api/friends/challenge/42",
      expect.objectContaining({ method: "POST" }),
    );
    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "❄️ Challenge sent!" }),
    );
    expect(deps.onSettled).toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.clearAuthToken).not.toHaveBeenCalled();
  });

  it("shows a 'could not send' toast when sent is false", async () => {
    const authFetch = vi.fn().mockResolvedValueOnce(makeResponse(200, { sent: false }));
    const deps = makeDeps(authFetch);

    await sendFriendChallenge(42, "Alice", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Could not send", variant: "destructive" }),
    );
    expect(deps.onSettled).toHaveBeenCalled();
  });

  it("clears the auth token and redirects to / on a 401", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(401, { error: "Unauthorized" }));
    const deps = makeDeps(authFetch);

    await sendFriendChallenge(42, "Alice", deps);

    expect(deps.clearAuthToken).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith("/");
    expect(deps.onSettled).toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it("shows a destructive toast on a non-ok, non-401 error response", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500, { error: "Server error" }));
    const deps = makeDeps(authFetch);

    await sendFriendChallenge(42, "Alice", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't send challenge",
        variant: "destructive",
      }),
    );
    expect(deps.onSettled).toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it("shows a destructive toast when fetch throws a network error", async () => {
    const authFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const deps = makeDeps(authFetch);

    await sendFriendChallenge(42, "Alice", deps);

    expect(deps.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't send challenge",
        variant: "destructive",
      }),
    );
    expect(deps.onSettled).toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
