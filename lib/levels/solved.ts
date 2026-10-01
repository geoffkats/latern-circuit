import type { AdventureLevel as SimAdventureLevel } from "@/lib/sim/adventure/world-type";
import { adventureWorld } from "@/lib/sim/adventure/world-type";
import { finalVariables, replay } from "@/lib/sim/replay";
import type { RobotLevel as SimRobotLevel } from "@/lib/sim/robot/world-type";
import { robotWorld } from "@/lib/sim/robot/world-type";
import type { Json, TraceEvent } from "@/lib/sim/types";
import type { AdventureLevel, Phase1Level, RobotLevel } from "./schema";

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
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    ) {
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

function finalVarsMatch(
  expected: Phase1Level["finalVars"],
  events: readonly TraceEvent[],
): boolean {
  if (expected === null) return true;
  const snapshot = finalVariables(events);
  if (snapshot === null) return false;
  return jsonEqual(snapshot, expected);
}

function asSimRobot(level: RobotLevel): SimRobotLevel {
  return level;
}

function asSimAdventure(level: AdventureLevel): SimAdventureLevel {
  return level;
}

/**
 * A level is solved when checkWin passes and finalVars match the last vars
 * snapshot before stop/done. A spatial win with the wrong snapshot is not solved.
 */
export function isLevelSolved(
  level: Phase1Level,
  events: readonly TraceEvent[],
): boolean {
  if (level.mode === "robot") {
    const simLevel = asSimRobot(level);
    const steps = replay(robotWorld, simLevel, events);
    const state =
      steps.length > 0
        ? steps[steps.length - 1].state
        : robotWorld.createInitialState(simLevel);
    const win = robotWorld.checkWin(state, simLevel);
    return win.passed && finalVarsMatch(level.finalVars, events);
  }

  const simLevel = asSimAdventure(level);
  const steps = replay(adventureWorld, simLevel, events);
  const state =
    steps.length > 0
      ? steps[steps.length - 1].state
      : adventureWorld.createInitialState(simLevel);
  const win = adventureWorld.checkWin(state, simLevel);
  return win.passed && finalVarsMatch(level.finalVars, events);
}

export function replayLevel(
  level: Phase1Level,
  events: readonly TraceEvent[],
) {
  if (level.mode === "robot") {
    return replay(robotWorld, asSimRobot(level), events);
  }
  return replay(adventureWorld, asSimAdventure(level), events);
}

export function createLevelState(level: Phase1Level) {
  if (level.mode === "robot") {
    return robotWorld.createInitialState(asSimRobot(level));
  }
  return adventureWorld.createInitialState(asSimAdventure(level));
}
