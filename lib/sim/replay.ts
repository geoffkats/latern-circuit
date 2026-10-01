import type { WorldType } from "./world-type";
import type { FinalVars, Json, StepResult, TraceEvent, WorldState } from "./types";
import { cloneWorld } from "./grid";

export class TraceMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceMismatch";
  }
}

function jsonEqual(left: Json, right: Json): boolean {
  if (left === right) return true;
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => jsonEqual(item, right[index]));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      jsonEqual(left[key], right[key]),
  );
}

function recordsEqual(
  snapshot: Readonly<Record<string, Json>>,
  expected: Readonly<Record<string, Json>>,
): boolean {
  return jsonEqual(snapshot, expected);
}

export function finalVariables(
  events: readonly TraceEvent[],
): Record<string, Json> | null {
  const stopAt = events.findIndex(
    (event) => event.kind === "stop" && event.reason === "done",
  );
  if (stopAt === -1) return null;
  for (let index = stopAt - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === "vars") return event.variables;
  }
  return null;
}

function finalVarsSatisfied(
  finalVars: FinalVars,
  events: readonly TraceEvent[],
): boolean {
  if (finalVars === null) return true;
  const snapshot = finalVariables(events);
  if (snapshot === null) return false;
  return recordsEqual(snapshot, finalVars);
}

function withWon(state: WorldState): WorldState {
  const next = cloneWorld(state);
  next.status = "won";
  next.loss = null;
  return next;
}

export function replay<TLevel extends { finalVars: FinalVars }>(
  world: WorldType<TLevel>,
  level: TLevel,
  events: readonly TraceEvent[],
): StepResult[] {
  let state = world.createInitialState(level);
  const steps: StepResult[] = [];
  let settled = false;

  for (const event of events) {
    if (event.kind === "action") {
      const result = world.applyAction(state, event.name, event.args);
      steps.push(result);
      state = result.state;
      continue;
    }

    if (event.kind === "sensor") {
      const value = world.readSensor(state, event.name, event.args);
      if (!jsonEqual(value, event.value)) {
        throw new TraceMismatch(
          `Sensor ${event.name} returned ${JSON.stringify(value)} but the trace recorded ${JSON.stringify(event.value)}.`,
        );
      }
      steps.push({
        state,
        ok: true,
        fault: null,
        sensorValue: value,
        won: false,
      });
      continue;
    }

    if (event.kind === "stop" && event.reason === "done" && !settled) {
      settled = true;
      const win = world.checkWin(state, level);
      if (win.passed && finalVarsSatisfied(level.finalVars, events)) {
        const wonState = withWon(state);
        state = wonState;
        if (steps.length > 0) {
          const last = steps[steps.length - 1];
          steps[steps.length - 1] = { ...last, state: wonState, won: true };
        }
      }
    }
  }

  return steps;
}
