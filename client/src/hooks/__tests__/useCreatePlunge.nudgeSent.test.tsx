/**
 * Unit tests for the nudgeSent → localStorage dismiss path in useCreatePlunge.
 *
 * When the server responds with nudgeSent: true the onSuccess handler must
 * write DISMISS_KEY = String(plunge.id) to localStorage so TryThisNextCard
 * hides itself immediately after a plunge is saved, preventing the user from
 * seeing the same nudge advice twice (once in the push notification and once
 * in the in-app card).
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreatePlunge } from "../use-plunges";
import { DISMISS_KEY } from "@/components/TryThisNextCard";

// ── Module mocks ─────────────────────────────────────────────────────────────

// Silence the getAuthToken import (not relevant to these tests)
vi.mock("@/hooks/use-auth", () => ({
  getAuthToken: () => null,
}));

// Capacitor is a native-only runtime; mock it so maybeRequestReview no-ops
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    isPluginAvailable: () => false,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid server response for a created plunge. */
function makePlungeResponse(overrides: Record<string, unknown> = {}) {
  return {
    id:             42,
    clientId:       null,
    userId:         null,
    duration:       180,
    temperature:    50,
    score:          "3.00",
    hrAvg:          null,
    spo2Avg:        null,
    photoData:      null,
    locationName:   null,
    locationId:     null,
    timerUsed:      false,
    calories:       null,
    timezone:       null,
    mood:           null,
    moodEnergy:     null,
    moodFocus:      null,
    moodPromptedAt: null,
    createdAt:      new Date().toISOString(),
    challengeResult: null,
    nudgeSent:      false,
    ...overrides,
  };
}

/**
 * Wrap the hook in a fresh QueryClient so tests are isolated from each other.
 */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

/**
 * Minimal valid PlungeInput — includes `score` which is required by the
 * insertPlungeSchema.extend({ score: z.string().or(z.number()) }) definition.
 */
const PLUNGE_INPUT = {
  duration:    180,
  temperature: 50,
  timerUsed:   false,
  score:       "3.00",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useCreatePlunge — nudgeSent dismiss behaviour", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("writes DISMISS_KEY to localStorage when the server responds with nudgeSent: true", async () => {
    const response = makePlungeResponse({ id: 42, nudgeSent: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const { result } = renderHook(() => useCreatePlunge(), {
      wrapper: createWrapper(),
    });

    await act(async () => { result.current.mutate(PLUNGE_INPUT); });
    await waitFor(() => result.current.isSuccess || result.current.isError, { timeout: 5000 });

    expect(result.current.isSuccess).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBe("42");
  });

  it("does NOT write DISMISS_KEY when the server responds with nudgeSent: false", async () => {
    const response = makePlungeResponse({ id: 99, nudgeSent: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const { result } = renderHook(() => useCreatePlunge(), {
      wrapper: createWrapper(),
    });

    await act(async () => { result.current.mutate(PLUNGE_INPUT); });
    await waitFor(() => result.current.isSuccess || result.current.isError, { timeout: 5000 });

    expect(result.current.isSuccess).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("does NOT write DISMISS_KEY when nudgeSent is absent from the response", async () => {
    // Server omits the field (e.g. older deployment)
    const response = makePlungeResponse({ id: 7 });
    delete (response as Record<string, unknown>).nudgeSent;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const { result } = renderHook(() => useCreatePlunge(), {
      wrapper: createWrapper(),
    });

    await act(async () => { result.current.mutate(PLUNGE_INPUT); });
    await waitFor(() => result.current.isSuccess || result.current.isError, { timeout: 5000 });

    expect(result.current.isSuccess).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("stores the correct plunge ID (not a hard-coded value) when nudgeSent: true", async () => {
    const response = makePlungeResponse({ id: 1337, nudgeSent: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));

    const { result } = renderHook(() => useCreatePlunge(), {
      wrapper: createWrapper(),
    });

    await act(async () => { result.current.mutate(PLUNGE_INPUT); });
    await waitFor(() => result.current.isSuccess || result.current.isError, { timeout: 5000 });

    expect(result.current.isSuccess).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1337");
  });

  it("TryThisNextCard is hidden when DISMISS_KEY matches the latest plunge ID after nudgeSent", async () => {
    // Simulate the post-onSuccess state: the hook has written plunge id=42 to
    // localStorage, then the component re-renders with the updated plunge list.
    // The render guard (dismissedId === String(latestId)) must suppress the card.
    localStorage.setItem(DISMISS_KEY, "42");

    const { TryThisNextCard } = await import("@/components/TryThisNextCard");
    const { render, screen } = await import("@testing-library/react");

    // 10 plunges in one calendar month so deriveNudge can return a nudge;
    // the most-recent plunge has id=42 (matching the localStorage key).
    const plunges = Array.from({ length: 10 }, (_, i) => ({
      id:             i === 9 ? 42 : i + 1,
      clientId:       null,
      userId:         null,
      duration:       180,
      temperature:    50,
      score:          "3.00",
      hrAvg:          null,
      spo2Avg:        null,
      photoData:      null,
      locationName:   null,
      locationId:     null,
      timerUsed:      false,
      calories:       null,
      timezone:       null,
      mood:           4,
      moodEnergy:     null,
      moodFocus:      null,
      moodPromptedAt: null,
      createdAt:      new Date(Date.now() - (10 - i) * 3_600_000),
    }));

    render(React.createElement(TryThisNextCard, { plunges }));
    expect(screen.queryByTestId("try-this-next-card")).not.toBeInTheDocument();
  });
});
