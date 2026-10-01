import { describe, expect, it } from "vitest";
import { loadLevel } from "@/lib/levels/load-level";
import { isLevelSolved, replayLevel } from "@/lib/levels/solved";
import type { TraceEvent } from "@/lib/sim/types";

function action(index: number, name: string): TraceEvent {
  return { kind: "action", index, line: index + 1, name, args: [] };
}

function sensor(
  index: number,
  name: string,
  value: boolean,
): TraceEvent {
  return { kind: "sensor", index, line: index + 1, name, args: [], value };
}

function vars(
  index: number,
  variables: Record<string, number>,
): TraceEvent {
  return { kind: "vars", index, line: index + 1, variables };
}

function stop(index: number): TraceEvent {
  return { kind: "stop", index, line: index + 1, reason: "done" };
}

function expectWin(levelId: string, events: TraceEvent[]) {
  const level = loadLevel(levelId);
  const steps = replayLevel(level, events);
  expect(isLevelSolved(level, events)).toBe(true);
  expect(steps.some((step) => step.won)).toBe(true);
  const state = steps[steps.length - 1]?.state;
  expect(state?.maxMoves).toBe(level.constraints.maxMoves);
  if (typeof level.constraints.maxMoves === "number") {
    const mutating = events.filter((event) => event.kind === "action").length;
    expect(mutating).toBeLessThanOrEqual(level.constraints.maxMoves);
    expect(state?.loss).not.toBe("move_cap");
  }
}

function expectNotWin(levelId: string, events: TraceEvent[]) {
  const level = loadLevel(levelId);
  expect(isLevelSolved(level, events)).toBe(false);
  const steps = replayLevel(level, events);
  expect(steps.some((step) => step.won)).toBe(false);
}

describe("level solvability", () => {
  it("mc-01-first-steps: two steps and a pick wins", () => {
    expectWin("mc-01-first-steps", [
      action(0, "move"),
      action(1, "move"),
      action(2, "pick_item"),
      stop(3),
    ]);
    expectNotWin("mc-01-first-steps", [
      action(0, "move"),
      action(1, "move"),
      stop(2),
    ]);
  });

  it("mc-02-the-bend: one turn_left then move wins", () => {
    expectWin("mc-02-the-bend", [
      action(0, "turn_left"),
      action(1, "move"),
      stop(2),
    ]);
    expectNotWin("mc-02-the-bend", [
      action(0, "move"),
      stop(1),
    ]);
  });

  it("mc-03-glowfruit: required item then a different goal tile wins", () => {
    expectWin("mc-03-glowfruit", [
      action(0, "move"),
      action(1, "pick_item"),
      action(2, "move"),
      stop(3),
    ]);
    expectNotWin("mc-03-glowfruit", [
      action(0, "move"),
      action(1, "move"),
      stop(2),
    ]);
  });

  it("ks-01-bay-walk: three moves down the hall wins", () => {
    expectWin("ks-01-bay-walk", [
      action(0, "move"),
      action(1, "move"),
      action(2, "move"),
      stop(3),
    ]);
    expectNotWin("ks-01-bay-walk", [
      action(0, "move"),
      action(1, "move"),
      stop(2),
    ]);
  });

  it("ks-02-corner-crate: turn, move, pick wins", () => {
    expectWin("ks-02-corner-crate", [
      action(0, "turn_left"),
      action(1, "move"),
      action(2, "pick_item"),
      stop(3),
    ]);
    expectNotWin("ks-02-corner-crate", [
      action(0, "turn_left"),
      action(1, "move"),
      stop(2),
    ]);
  });

  it("ks-03-two-crates: two picks match the goal stack", () => {
    expectWin("ks-03-two-crates", [
      action(0, "pick_item"),
      action(1, "pick_item"),
      stop(2),
    ]);
    expectNotWin("ks-03-two-crates", [
      action(0, "pick_item"),
      stop(1),
    ]);
  });

  it("cd-01-carried: last vars snapshot before done must match", () => {
    expectWin("cd-01-carried", [
      action(0, "move"),
      vars(1, { carried: 0 }),
      vars(2, { carried: 1 }),
      stop(3),
    ]);
    expectNotWin("cd-01-carried", [
      action(0, "move"),
      vars(1, { carried: 0 }),
      stop(2),
    ]);
  });

  it("ks-04-clear-ahead: sensor then move when clear wins; blind move does not", () => {
    expectWin("ks-04-clear-ahead", [
      sensor(0, "front_is_clear", false),
      action(1, "turn_left"),
      sensor(2, "front_is_clear", true),
      action(3, "move"),
      stop(4),
    ]);

    const level = loadLevel("ks-04-clear-ahead");
    const blind = [
      action(0, "move"),
      stop(1),
    ];
    const steps = replayLevel(level, blind);
    expect(steps[0]?.fault).toBe("wall");
    expect(isLevelSolved(level, blind)).toBe(false);
    expect(steps.some((step) => step.won)).toBe(false);
  });
});
