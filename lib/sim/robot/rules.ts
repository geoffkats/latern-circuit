import { applyCoreAction } from "../core-action";
import { cellAt, isDirectionClear, turnLeft, turnRight } from "../grid";
import type { Json, StepResult, WorldState } from "../types";
import type { WinCheck } from "../world-type";
import type { RobotLevel } from "./world-type";

export function applyRobotAction(
  state: WorldState,
  name: string,
  args: readonly Json[],
): StepResult {
  return applyCoreAction(state, name, args, { treatHazards: false });
}

export function readRobotSensor(
  state: WorldState,
  name: string,
  args: readonly Json[],
): Json {
  void args;
  switch (name) {
    case "front_is_clear":
      return isDirectionClear(state, state.actor.facing);
    case "left_is_clear":
      return isDirectionClear(state, turnLeft(state.actor.facing));
    case "right_is_clear":
      return isDirectionClear(state, turnRight(state.actor.facing));
    case "item_here":
      return cellAt(state, state.actor.x, state.actor.y).items.length > 0;
    case "facing_north":
      return state.actor.facing === "north";
    case "facing_east":
      return state.actor.facing === "east";
    case "facing_south":
      return state.actor.facing === "south";
    case "facing_west":
      return state.actor.facing === "west";
    default:
      return null;
  }
}

function expandPiles(piles: readonly { kind: string; count: number }[]): string[] {
  const stack: string[] = [];
  for (const pile of piles) {
    for (let copy = 0; copy < pile.count; copy += 1) {
      stack.push(pile.kind);
    }
  }
  return stack;
}

function sameStack(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function robotGoalMet(state: WorldState, level: RobotLevel): WinCheck {
  if (state.status === "lost") return { passed: false, reason: "lost" };

  const onGoal = state.actor.x === level.goal.x && state.actor.y === level.goal.y;
  const holdingOk = sameStack(state.actor.holding, expandPiles(level.goal.holding));
  const banned = new Set(level.goal.collectKinds);
  const floorClear = state.cells.every((cell) =>
    cell.items.every((kind) => !banned.has(kind)),
  );

  if (onGoal && holdingOk && floorClear) return { passed: true, reason: "goal" };
  return { passed: false, reason: "incomplete" };
}
