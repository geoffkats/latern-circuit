import {
  cellAt,
  cellIndex,
  cloneWorld,
  frontCell,
  inBounds,
  turnLeft,
  turnRight,
} from "./grid";
import type { Fault, Json, StepResult, WorldState } from "./types";

const COMMANDS = [
  "move",
  "turn_left",
  "turn_right",
  "pick_item",
  "put_item",
] as const;

type CommandName = (typeof COMMANDS)[number];

function isCommand(name: string): name is CommandName {
  return (COMMANDS as readonly string[]).includes(name);
}

function rejected(state: WorldState, fault: Fault): StepResult {
  return {
    state,
    ok: false,
    fault,
    sensorValue: null,
    won: false,
  };
}

function failed(state: WorldState, fault: Fault): StepResult {
  const next = cloneWorld(state);
  next.moves += 1;
  next.loss = fault;
  return {
    state: next,
    ok: false,
    fault,
    sensorValue: null,
    won: false,
  };
}

function succeeded(state: WorldState): StepResult {
  return {
    state,
    ok: true,
    fault: null,
    sensorValue: null,
    won: false,
  };
}

function atMoveCap(state: WorldState): boolean {
  return state.maxMoves !== null && state.moves >= state.maxMoves;
}

function move(state: WorldState, treatHazards: boolean): StepResult {
  const nextPos = frontCell(state.actor.x, state.actor.y, state.actor.facing);
  if (
    !inBounds(state.width, state.height, nextPos.x, nextPos.y) ||
    cellAt(state, nextPos.x, nextPos.y).blocked
  ) {
    return failed(state, "wall");
  }

  const entered = cellAt(state, nextPos.x, nextPos.y);
  const next = cloneWorld(state);
  next.actor.x = nextPos.x;
  next.actor.y = nextPos.y;
  next.moves += 1;

  if (treatHazards && entered.hazard !== null) {
    next.status = "lost";
    next.loss = "hazard";
    return {
      state: next,
      ok: false,
      fault: "hazard",
      sensorValue: null,
      won: false,
    };
  }

  return succeeded(next);
}

function turn(state: WorldState, command: "turn_left" | "turn_right"): StepResult {
  const next = cloneWorld(state);
  next.actor.facing =
    command === "turn_left"
      ? turnLeft(state.actor.facing)
      : turnRight(state.actor.facing);
  next.moves += 1;
  return succeeded(next);
}

function pick(state: WorldState): StepResult {
  const index = cellIndex(state.width, state.actor.x, state.actor.y);
  if (state.cells[index].items.length === 0) return failed(state, "empty_pick");

  const next = cloneWorld(state);
  const taken = next.cells[index].items.pop();
  if (taken === undefined) return failed(state, "empty_pick");
  next.actor.holding.push(taken);
  next.moves += 1;
  return succeeded(next);
}

function put(state: WorldState): StepResult {
  if (state.actor.holding.length === 0) return failed(state, "bad_put");

  const next = cloneWorld(state);
  const item = next.actor.holding.pop();
  if (item === undefined) return failed(state, "bad_put");
  const index = cellIndex(state.width, state.actor.x, state.actor.y);
  next.cells[index].items.push(item);
  next.moves += 1;
  return succeeded(next);
}

export function applyCoreAction(
  state: WorldState,
  name: string,
  args: readonly Json[],
  options: { treatHazards: boolean },
): StepResult {
  void args;
  if (!isCommand(name)) return rejected(state, "unknown_api");
  if (atMoveCap(state)) return failed(state, "move_cap");

  switch (name) {
    case "move":
      return move(state, options.treatHazards);
    case "turn_left":
    case "turn_right":
      return turn(state, name);
    case "pick_item":
      return pick(state);
    case "put_item":
      return put(state);
    default: {
      const unreachable: never = name;
      return unreachable;
    }
  }
}
