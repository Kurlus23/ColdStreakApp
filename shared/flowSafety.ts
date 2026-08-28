export const FLOW_WARNING_RATIO = 0.70;
export const FLOW_WARNING_DELAY_MS = 2_000;
export const FLOW_TRIP_DELAY_MS = 8_000;
export const SENSOR_STALE_MS = 3_000;
export const STARTUP_GRACE_MS = 15_000;

export type FlowSafetyState = "normal" | "warning" | "low_flow_trip" | "sensor_fault";

export interface FlowSafetyInput {
  nowMs: number;
  outputEnabled: boolean;
  outputStartedAtMs: number;
  lastValidReadingAtMs: number;
  filteredFlowLpm: number;
  normalFlowLpm: number;
  lowFlowStartedAtMs: number | null;
}

export interface FlowSafetyResult {
  state: FlowSafetyState;
  shouldShutDown: boolean;
  lowFlowStartedAtMs: number | null;
}

// Executable copy of the controller safety contract. The ESP32 remains the
// authority; this helper lets server/app tests verify the same timing rules.
export function evaluateFlowSafety(input: FlowSafetyInput): FlowSafetyResult {
  if (!input.outputEnabled) {
    return { state: "normal", shouldShutDown: false, lowFlowStartedAtMs: null };
  }
  if (input.nowMs - input.lastValidReadingAtMs > SENSOR_STALE_MS) {
    return { state: "sensor_fault", shouldShutDown: true, lowFlowStartedAtMs: null };
  }
  if (input.nowMs - input.outputStartedAtMs < STARTUP_GRACE_MS || input.normalFlowLpm <= 0) {
    return { state: "normal", shouldShutDown: false, lowFlowStartedAtMs: null };
  }
  if (input.filteredFlowLpm >= input.normalFlowLpm * FLOW_WARNING_RATIO) {
    return { state: "normal", shouldShutDown: false, lowFlowStartedAtMs: null };
  }
  const started = input.lowFlowStartedAtMs ?? input.nowMs;
  const elapsed = input.nowMs - started;
  if (elapsed >= FLOW_TRIP_DELAY_MS) {
    return { state: "low_flow_trip", shouldShutDown: true, lowFlowStartedAtMs: started };
  }
  return {
    state: elapsed >= FLOW_WARNING_DELAY_MS ? "warning" : "normal",
    shouldShutDown: false,
    lowFlowStartedAtMs: started,
  };
}