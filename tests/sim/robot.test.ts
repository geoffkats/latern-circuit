import { describe, expect, it } from "vitest";
import { robotWorld, type RobotLevel } from "@/lib/sim/robot/world-type";
import type { Direction, WorldState } from "@/lib/sim/types";

function level(overrides: Partial<RobotLevel> = {}): RobotLevel {
  return {
    mode: "robot",
    worldId: "keel-station",
    grid: { width: 3, height: 3 },
    start: { x: 1, y: 1, facing: "north" },
    walls: [],
    items: [],
    goal: { x: 1, y: 1, holding: [], collectKinds: [] },
    constraints: { maxMoves: null },
    finalVars: null,
    ...overrides,
  };
}

function state(overrides: Partial<RobotLevel> = {}): WorldState {
  return robotWorld.createInitialState(level(overrides));
}

describe("robot movement", () => {
  it("steps forward by the facing delta and copies maxMoves", () => {
    const cases: { facing: Direction; x: number; y: number }[] = [
      { facing: "north", x: 1, y: 2 },
      { facing: "east", x: 2, y: 1 },
      { facing: "south", x: 1, y: 0 },
      { facing: "west", x: 0, y: 1 },
    ];

    for (const step of cases) {
      const before = state({ start: { x: 1, y: 1, facing: step.facing } });
      expect(before.maxMoves).toBeNull();
      const result = robotWorld.applyAction(before, "move", []);
      expect(result.ok).toBe(true);
      expect(result.fault).toBeNull();
      expect(result.state.moves).toBe(1);
      expect(result.state.actor).toEqual({
        x: step.x,
        y: step.y,
        facing: step.facing,
        holding: [],
      });
      expect(before.actor).toEqual({ x: 1, y: 1, facing: step.facing, holding: [] });
      expect(before.moves).toBe(0);
    }
  });

  it("faults wall without moving, and still counts the move", () => {
    const blocked = state({
      start: { x: 1, y: 1, facing: "east" },
      walls: [{ x: 2, y: 1 }],
      items: [{ x: 1, y: 1, kind: "crate", count: 1 }],
    });
    const intoWall = robotWorld.applyAction(blocked, "move", []);
    expect(intoWall.fault).toBe("wall");
    expect(intoWall.ok).toBe(false);
    expect(intoWall.state.moves).toBe(1);
    expect(intoWall.state.actor).toEqual(blocked.actor);
    expect(intoWall.state.cells.map((cell) => cell.items)).toEqual(
      blocked.cells.map((cell) => cell.items),
    );
    expect(blocked.moves).toBe(0);

    const edge = state({ start: { x: 0, y: 0, facing: "west" } });
    const offGrid = robotWorld.applyAction(edge, "move", []);
    expect(offGrid.fault).toBe("wall");
    expect(offGrid.state.actor).toEqual(edge.actor);
    expect(offGrid.state.moves).toBe(1);
  });

  it("cycles turn_left north to west to south to east to north", () => {
    let current = state({ start: { x: 1, y: 1, facing: "north" } });
    const expected: Direction[] = ["west", "south", "east", "north"];
    expected.forEach((facing, index) => {
      const result = robotWorld.applyAction(current, "turn_left", []);
      expect(result.ok).toBe(true);
      expect(result.state.actor.facing).toBe(facing);
      expect(result.state.actor.x).toBe(1);
      expect(result.state.actor.y).toBe(1);
      expect(result.state.moves).toBe(index + 1);
      current = result.state;
    });
  });

  it("cycles turn_right north to east to south to west to north", () => {
    let current = state({ start: { x: 1, y: 1, facing: "north" } });
    const expected: Direction[] = ["east", "south", "west", "north"];
    expected.forEach((facing, index) => {
      const result = robotWorld.applyAction(current, "turn_right", []);
      expect(result.ok).toBe(true);
      expect(result.state.actor.facing).toBe(facing);
      expect(result.state.moves).toBe(index + 1);
      current = result.state;
    });
  });
});

describe("robot stacks", () => {
  it("picks and puts the top of the stack", () => {
    let current = state({
      start: { x: 0, y: 0, facing: "east" },
      items: [
        { x: 0, y: 0, kind: "moss", count: 1 },
        { x: 0, y: 0, kind: "crate", count: 1 },
      ],
    });

    const first = robotWorld.applyAction(current, "pick_item", []);
    expect(first.state.actor.holding).toEqual(["crate"]);
    expect(first.state.cells[0].items).toEqual(["moss"]);
    expect(first.state.moves).toBe(1);
    current = first.state;

    const second = robotWorld.applyAction(current, "pick_item", []);
    expect(second.state.actor.holding).toEqual(["crate", "moss"]);
    expect(second.state.cells[0].items).toEqual([]);
    current = second.state;

    const putTop = robotWorld.applyAction(current, "put_item", []);
    expect(putTop.state.actor.holding).toEqual(["crate"]);
    expect(putTop.state.cells[0].items).toEqual(["moss"]);
    current = putTop.state;

    const putRest = robotWorld.applyAction(current, "put_item", []);
    expect(putRest.state.actor.holding).toEqual([]);
    expect(putRest.state.cells[0].items).toEqual(["moss", "crate"]);
    expect(putRest.state.moves).toBe(4);
  });

  it("faults empty_pick and bad_put without changing stacks", () => {
    const empty = state({ start: { x: 0, y: 0, facing: "east" } });
    const missed = robotWorld.applyAction(empty, "pick_item", []);
    expect(missed.fault).toBe("empty_pick");
    expect(missed.state.actor.holding).toEqual([]);
    expect(missed.state.cells[0].items).toEqual([]);
    expect(missed.state.moves).toBe(1);
    expect(empty.moves).toBe(0);

    const bare = robotWorld.applyAction(empty, "put_item", []);
    expect(bare.fault).toBe("bad_put");
    expect(bare.state.actor).toEqual(empty.actor);
    expect(bare.state.moves).toBe(1);
  });
});

describe("robot limits", () => {
  it("returns move_cap when moves is already at maxMoves", () => {
    const before = state({
      grid: { width: 3, height: 1 },
      start: { x: 0, y: 0, facing: "east" },
      constraints: { maxMoves: 1 },
    });
    expect(before.maxMoves).toBe(1);

    const first = robotWorld.applyAction(before, "move", []);
    expect(first.ok).toBe(true);
    expect(first.state.actor).toEqual({ x: 1, y: 0, facing: "east", holding: [] });
    expect(first.state.moves).toBe(1);

    const capped = robotWorld.applyAction(first.state, "turn_left", []);
    expect(capped.fault).toBe("move_cap");
    expect(capped.ok).toBe(false);
    expect(capped.state.actor).toEqual(first.state.actor);
    expect(capped.state.moves).toBe(2);
    expect(first.state.moves).toBe(1);
    expect(first.state.actor.facing).toBe("east");
  });

  it("rejects an unknown api without incrementing moves", () => {
    const before = state();
    const result = robotWorld.applyAction(before, "jump", []);
    expect(result.fault).toBe("unknown_api");
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
    expect(result.state.moves).toBe(0);
  });
});

describe("robot sensors", () => {
  it("reports all eight sensors without changing state", () => {
    const before = state({
      start: { x: 1, y: 1, facing: "north" },
      walls: [{ x: 1, y: 2 }],
      items: [{ x: 1, y: 1, kind: "crate", count: 1 }],
    });

    expect(robotWorld.readSensor(before, "front_is_clear", [])).toBe(false);
    expect(robotWorld.readSensor(before, "left_is_clear", [])).toBe(true);
    expect(robotWorld.readSensor(before, "right_is_clear", [])).toBe(true);
    expect(robotWorld.readSensor(before, "item_here", [])).toBe(true);
    expect(robotWorld.readSensor(before, "facing_north", [])).toBe(true);
    expect(robotWorld.readSensor(before, "facing_east", [])).toBe(false);
    expect(robotWorld.readSensor(before, "facing_south", [])).toBe(false);
    expect(robotWorld.readSensor(before, "facing_west", [])).toBe(false);
    expect(before.moves).toBe(0);
    expect(before.actor.facing).toBe("north");

    const facingEast = state({
      start: { x: 1, y: 1, facing: "east" },
      walls: [{ x: 1, y: 2 }],
    });
    expect(robotWorld.readSensor(facingEast, "front_is_clear", [])).toBe(true);
    expect(robotWorld.readSensor(facingEast, "left_is_clear", [])).toBe(false);
    expect(robotWorld.readSensor(facingEast, "right_is_clear", [])).toBe(true);
    expect(robotWorld.readSensor(facingEast, "item_here", [])).toBe(false);
  });
});

describe("robot win", () => {
  const goalLevel = (): RobotLevel =>
    level({
      grid: { width: 2, height: 1 },
      start: { x: 0, y: 0, facing: "east" },
      items: [
        { x: 0, y: 0, kind: "moss", count: 1 },
        { x: 0, y: 0, kind: "crate", count: 1 },
      ],
      goal: {
        x: 1,
        y: 0,
        holding: [
          { kind: "crate", count: 1 },
          { kind: "moss", count: 1 },
        ],
        collectKinds: ["crate", "moss"],
      },
    });

  it("wins on the goal with the expanded stack and a clear floor", () => {
    let current = robotWorld.createInitialState(goalLevel());
    current = robotWorld.applyAction(current, "pick_item", []).state;
    current = robotWorld.applyAction(current, "pick_item", []).state;
    current = robotWorld.applyAction(current, "move", []).state;
    expect(current.actor).toEqual({
      x: 1,
      y: 0,
      facing: "east",
      holding: ["crate", "moss"],
    });
    expect(robotWorld.checkWin(current, goalLevel())).toEqual({
      passed: true,
      reason: "goal",
    });
  });

  it("is not a win while a collected kind is still on the floor", () => {
    let current = robotWorld.createInitialState(goalLevel());
    current = robotWorld.applyAction(current, "pick_item", []).state;
    current = robotWorld.applyAction(current, "move", []).state;
    expect(current.actor.holding).toEqual(["crate"]);
    expect(robotWorld.checkWin(current, goalLevel())).toEqual({
      passed: false,
      reason: "incomplete",
    });
  });
});
