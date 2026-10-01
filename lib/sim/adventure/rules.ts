import { applyCoreAction } from "../core-action";
import type { Json, StepResult, WorldState } from "../types";
import type { WinCheck } from "../world-type";
import type { AdventureLevel } from "./world-type";

export function applyAdventureAction(
  state: WorldState,
  name: string,
  args: readonly Json[],
): StepResult {
  return applyCoreAction(state, name, args, { treatHazards: true });
}

export function readAdventureSensor(
  state: WorldState,
  name: string,
  args: readonly Json[],
): Json {
  void state;
  void name;
  void args;
  return null;
}

export function adventureGoalMet(state: WorldState, level: AdventureLevel): WinCheck {
  if (state.status === "lost") return { passed: false, reason: "lost" };

  const required = new Map<string, number>();
  for (const item of level.items) {
    if (!item.required) continue;
    required.set(item.kind, (required.get(item.kind) ?? 0) + item.count);
  }

  const held = new Map<string, number>();
  for (const kind of state.actor.holding) {
    held.set(kind, (held.get(kind) ?? 0) + 1);
  }

  for (const [kind, count] of required) {
    if ((held.get(kind) ?? 0) < count) return { passed: false, reason: "incomplete" };
  }

  const onGoal = state.actor.x === level.goal.x && state.actor.y === level.goal.y;
  if (!onGoal) return { passed: false, reason: "incomplete" };
  return { passed: true, reason: "goal" };
}
