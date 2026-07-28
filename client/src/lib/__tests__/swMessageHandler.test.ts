import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSwMessage, type SwMessageDeps } from "../swMessageHandler";

// ---- helpers ----------------------------------------------------------------

function makeEvent(data: unknown): MessageEvent {
  return { data } as unknown as MessageEvent;
}

function makeDeps(overrides: Partial<SwMessageDeps> = {}): SwMessageDeps {
  return {
    toast: vi.fn(),
    loadFriends: vi.fn(),
    setActiveChallengerUserId: vi.fn(),
    isOnFriendsScreen: vi.fn().mockReturnValue(false),
    setFriendsBadge: vi.fn(),
    ...overrides,
  };
}

// ---- tests ------------------------------------------------------------------

describe("handleSwMessage — friend-action-failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows a destructive toast with the message from the event", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({
        type: "friend-action-failed",
        message: "This request was already responded to.",
      }),
      deps,
    );

    expect(deps.toast).toHaveBeenCalledTimes(1);
    expect(deps.toast).toHaveBeenCalledWith({
      title: "Action failed",
      description: "This request was already responded to.",
      variant: "destructive",
    });
  });

  it("falls back to the generic message when event.data.message is absent", () => {
    const deps = makeDeps();
    handleSwMessage(makeEvent({ type: "friend-action-failed" }), deps);

    expect(deps.toast).toHaveBeenCalledWith({
      title: "Action failed",
      description: "Something went wrong. Please try again in the app.",
      variant: "destructive",
    });
  });

  it("does not call loadFriends or setActiveChallengerUserId", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "friend-action-failed", message: "Duplicate tap." }),
      deps,
    );

    expect(deps.loadFriends).not.toHaveBeenCalled();
    expect(deps.setActiveChallengerUserId).not.toHaveBeenCalled();
  });
});

describe("handleSwMessage — friend-request-resolved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls loadFriends when a request is resolved", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "friend-request-resolved", requesterName: "Alice", resolution: "accepted" }),
      deps,
    );

    expect(deps.loadFriends).toHaveBeenCalledTimes(1);
  });

  it("shows an accepted toast with the requester name", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "friend-request-resolved", requesterName: "Alice", resolution: "accepted" }),
      deps,
    );

    expect(deps.toast).toHaveBeenCalledWith({
      title: "🎉 Friend request accepted",
      description: "Alice accepted your friend request.",
    });
  });

  it("shows a declined toast with the requester name", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "friend-request-resolved", requesterName: "Bob", resolution: "declined" }),
      deps,
    );

    expect(deps.toast).toHaveBeenCalledWith({
      title: "Friend request declined",
      description: "Bob declined your friend request.",
    });
  });

  it("sets the friends badge and persists it when the user is not on the friends screen", () => {
    const deps = makeDeps({ isOnFriendsScreen: vi.fn().mockReturnValue(false) });
    handleSwMessage(
      makeEvent({ type: "friend-request-resolved", requesterName: "Alice", resolution: "accepted" }),
      deps,
    );

    expect(deps.setFriendsBadge).toHaveBeenCalledWith(true);
    expect(localStorage.getItem("coldstreak-friends-badge")).toBe("1");
  });

  it("does NOT set the friends badge when the user is already on the friends screen", () => {
    const deps = makeDeps({ isOnFriendsScreen: vi.fn().mockReturnValue(true) });
    handleSwMessage(
      makeEvent({ type: "friend-request-resolved", requesterName: "Alice", resolution: "accepted" }),
      deps,
    );

    expect(deps.setFriendsBadge).not.toHaveBeenCalled();
    expect(localStorage.getItem("coldstreak-friends-badge")).toBeNull();
  });
});

describe("handleSwMessage — notification-navigate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts the challenger id from the URL and calls setActiveChallengerUserId", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "notification-navigate", url: "/app?challenger=42" }),
      deps,
    );

    expect(deps.setActiveChallengerUserId).toHaveBeenCalledWith(42);
    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.loadFriends).not.toHaveBeenCalled();
  });

  it("does nothing when no challenger param is present", () => {
    const deps = makeDeps();
    handleSwMessage(
      makeEvent({ type: "notification-navigate", url: "/app" }),
      deps,
    );

    expect(deps.setActiveChallengerUserId).not.toHaveBeenCalled();
  });
});

describe("handleSwMessage — unknown type", () => {
  it("ignores messages with an unrecognised type", () => {
    const deps = makeDeps();
    handleSwMessage(makeEvent({ type: "some-other-event" }), deps);

    expect(deps.toast).not.toHaveBeenCalled();
    expect(deps.loadFriends).not.toHaveBeenCalled();
    expect(deps.setActiveChallengerUserId).not.toHaveBeenCalled();
  });
});
