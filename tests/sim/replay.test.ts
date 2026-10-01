import { describe, expect, it } from "vitest";
import { finalVariables, replay, TraceMismatch } from "@/lib/sim/replay";
import { robotWorld, type RobotLevel } from "@/lib/sim/robot/world-type";
import { worldRegistry } from "@/lib/sim/registry";
import type { TraceEvent } from "@/lib/sim/types";

function level(overrides: Partial<RobotLevel> = {}): RobotLevel {
  return {
    mode: "robot",
    worldId: "keel-station",
    grid: { width: 3, height: 1 },
    start: { x: 0, y: 0, facing: "east" },
    walls: [],
    items: [],
    goal: { x: 1, y: 0, holding: [], collectKinds: [] },
    constraints: { maxMoves: null },
    finalVars: null,
    ...overrides,
  };
}

function action(index: number, name: string): TraceEvent {
  return { kind: "action", index, line: index + 1, name, args: [] };
}

function sensor(index: number, name: string, value: boolean): TraceEvent {
  return { kind: "sensor", index, line: index + 1, name, args: [], value };
}

function vars(index: number, variables: Record<string, number>): TraceEvent {
  return { kind: "vars", index, line: index + 1, variables };
}

function stop(index: number, line: number | null = index + 1): TraceEvent {
  return { kind: "stop", index, line, reason: "done" };
}

describe("replay", () => {
  it("registers adventure and robot only", () => {
    expect(Object.keys(worldRegistry).sort()).toEqual(["adventure", "robot"]);
  });

  it("returns the same steps for the same trace and level", () => {
    const board = level({
      goal: { x: 2, y: 0, holding: [], collectKinds: [] },
    });
    const events: TraceEvent[] = [
      action(0, "move"),
      vars(1, { steps: 1 }),
      sensor(2, "front_is_clear", true),
      stop(3),
    ];

    const first = replay(robotWorld, board, events);
    const second = replay(robotWorld, board, events);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first[0].state.actor).toEqual({ x: 1, y: 0, facing: "east", holding: [] });
    expect(first[0].state.moves).toBe(1);
    expect(first[1].state).toEqual(first[0].state);
    expect(first[1].sensorValue).toBe(true);
    expect(first[1].state.moves).toBe(1);
    expect(first[1].won).toBe(false);
  });

  it("does not add a spatial step for vars or stop", () => {
    const events: TraceEvent[] = [
      action(0, "turn_left"),
      vars(1, { turned: 1 }),
      sensor(2, "facing_north", true),
      vars(3, { turned: 1 }),
      stop(4),
    ];
    const steps = replay(robotWorld, level({ goal: { x: 0, y: 0, holding: [], collectKinds: [] } }), events);
    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.state.actor.facing)).toEqual(["north", "north"]);
    expect(steps[0].state.moves).toBe(1);
    expect(steps[1].state.moves).toBe(1);
  });

  it("throws TraceMismatch when a sensor value disagrees", () => {
    const events: TraceEvent[] = [sensor(0, "front_is_clear", false)];
    expect(() => replay(robotWorld, level(), events)).toThrow(TraceMismatch);
    expect(() => replay(robotWorld, level(), events)).toThrow(/front_is_clear/);
  });

  it("uses the vars snapshot immediately before stop done", () => {
    const board = level({ finalVars: { carried: 1 } });
    const withSnapshot: TraceEvent[] = [
      action(0, "move"),
      vars(1, { carried: 0 }),
      vars(2, { carried: 1 }),
      stop(3),
    ];

    const won = replay(robotWorld, board, withSnapshot);
    expect(finalVariables(withSnapshot)).toEqual({ carried: 1 });
    expect(won).toHaveLength(1);
    expect(robotWorld.checkWin(won[0].state, board).passed).toBe(true);
    expect(won[0].won).toBe(true);
    expect(won[0].state.status).toBe("won");

    const withoutSnapshot: TraceEvent[] = [
      action(0, "move"),
      vars(1, { carried: 0 }),
      stop(2),
    ];
    const missed = replay(robotWorld, board, withoutSnapshot);
    expect(finalVariables(withoutSnapshot)).toEqual({ carried: 0 });
    expect(robotWorld.checkWin(missed[0].state, board).passed).toBe(true);
    expect(missed[0].won).toBe(false);
    expect(missed[0].state.status).toBe("running");

    const snapshotAfterStop: TraceEvent[] = [
      action(0, "move"),
      stop(1),
      vars(2, { carried: 1 }),
    ];
    const late = replay(robotWorld, board, snapshotAfterStop);
    expect(finalVariables(snapshotAfterStop)).toBeNull();
    expect(late[0].won).toBe(false);
    expect(late[0].state.status).toBe("running");
  });
});
