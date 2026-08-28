import { describe, expect, it } from "vitest";
import { evaluateFlowSafety, SENSOR_STALE_MS, STARTUP_GRACE_MS } from "../shared/flowSafety";

const base = {
  nowMs: 30_000,
  outputEnabled: true,
  outputStartedAtMs: 0,
  lastValidReadingAtMs: 30_000,
  filteredFlowLpm: 10,
  normalFlowLpm: 10,
  lowFlowStartedAtMs: null,
};

describe("flow controller safety contract", () => {
  it("does not trip during startup grace", () => {
    const result = evaluateFlowSafety({ ...base, nowMs: STARTUP_GRACE_MS - 1, filteredFlowLpm: 1 });
    expect(result.shouldShutDown).toBe(false);
  });

  it("filters a brief dip below 70 percent", () => {
    const first = evaluateFlowSafety({ ...base, filteredFlowLpm: 6.9 });
    const recovered = evaluateFlowSafety({ ...base, nowMs: 31_000, filteredFlowLpm: 8, lowFlowStartedAtMs: first.lowFlowStartedAtMs });
    expect(first.state).toBe("normal");
    expect(recovered.lowFlowStartedAtMs).toBeNull();
  });

  it("warns before shutting down sustained low flow", () => {
    const warning = evaluateFlowSafety({ ...base, nowMs: 33_000, filteredFlowLpm: 6, lowFlowStartedAtMs: 30_000 });
    const trip = evaluateFlowSafety({ ...base, nowMs: 38_000, lastValidReadingAtMs: 38_000, filteredFlowLpm: 6, lowFlowStartedAtMs: 30_000 });
    expect(warning).toMatchObject({ state: "warning", shouldShutDown: false });
    expect(trip).toMatchObject({ state: "low_flow_trip", shouldShutDown: true });
  });

  it("shuts down immediately when sensor readings become stale", () => {
    const result = evaluateFlowSafety({ ...base, lastValidReadingAtMs: base.nowMs - SENSOR_STALE_MS - 1 });
    expect(result).toMatchObject({ state: "sensor_fault", shouldShutDown: true });
  });

  it("continues to enforce safety without a network input", () => {
    const result = evaluateFlowSafety(base);
    expect(result).toMatchObject({ state: "normal", shouldShutDown: false });
  });
});