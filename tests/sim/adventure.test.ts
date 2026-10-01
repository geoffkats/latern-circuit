import { describe, expect, it } from "vitest";
import {
  adventureWorld,
  type AdventureLevel,
} from "@/lib/sim/adventure/world-type";
import { replay } from "@/lib/sim/replay";
import type { TraceEvent } from "@/lib/sim/types";

function level(overrides: Partial<AdventureLevel> = {}): AdventureLevel {
  return {
    mode: "adventure",
    worldId: "moss-canopy",
    grid: { width: 3, height: 1 },
    start: { x: 0, y: 0, facing: "east" },
    walls: [],
    items: [],
    hazards: [],
    goal: { x: 2, y: 0 },
    constraints: { maxMoves: null },
    finalVars: null,
    ...overrides,
  };
}

function action(index: number, name: string): TraceEvent {
  return { kind: "action", index, line: index + 1, name, args: [] };
}

function stop(index: number): TraceEvent {
  return { kind: "stop", index, line: index + 1, reason: "done" };
}

describe("adventure", () => {
  it("loses when Nia steps onto a hazard", () => {
    const board = level({
      hazards: [{ x: 1, y: 0, kind: "thorn" }],
    });
    const before = adventureWorld.createInitialState(board);
    const result = adventureWorld.applyAction(before, "move", []);

    expect(result.fault).toBe("hazard");
    expect(result.ok).toBe(false);
    expect(result.state.status).toBe("lost");
    expect(result.state.loss).toBe("hazard");
    expect(result.state.actor).toEqual({ x: 1, y: 0, facing: "east", holding: [] });
    expect(result.state.moves).toBe(1);
    expect(before.actor.x).toBe(0);
    expect(adventureWorld.checkWin(result.state, board)).toEqual({
      passed: false,
      reason: "lost",
    });
  });

  it("wins after a required item is held and Nia reaches the goal", () => {
    const board = level({
      items: [
        { x: 0, y: 0, kind: "pebble", count: 1, required: false },
        { x: 1, y: 0, kind: "glowfruit", count: 1, required: true },
      ],
    });

    const picked = [
      action(0, "move"),
      action(1, "pick_item"),
      stop(2),
    ];
    const holdingOnly = replay(adventureWorld, board, picked);
    expect(holdingOnly).toHaveLength(2);
    expect(holdingOnly[1].state.actor).toEqual({
      x: 1,
      y: 0,
      facing: "east",
      holding: ["glowfruit"],
    });
    expect(holdingOnly[1].won).toBe(false);
    expect(adventureWorld.checkWin(holdingOnly[1].state, board).reason).toBe(
      "incomplete",
    );

    const finished = replay(adventureWorld, board, [
      ...picked.slice(0, 2),
      action(2, "move"),
      stop(3),
    ]);
    expect(finished).toHaveLength(3);
    expect(finished[2].won).toBe(true);
    expect(finished[2].state.status).toBe("won");
    expect(finished[2].state.actor).toEqual({
      x: 2,
      y: 0,
      facing: "east",
      holding: ["glowfruit"],
    });
    expect(finished[2].state.cells[0].items).toEqual(["pebble"]);

    const skipped = replay(adventureWorld, board, [
      action(0, "move"),
      action(1, "move"),
      stop(2),
    ]);
    expect(skipped[1].state.actor.x).toBe(2);
    expect(skipped[1].state.actor.holding).toEqual([]);
    expect(skipped[1].won).toBe(false);
  });

  it("does not use sensors", () => {
    const before = adventureWorld.createInitialState(level());
    expect(adventureWorld.readSensor(before, "front_is_clear", [])).toBeNull();
    expect(adventureWorld.readSensor(before, "item_here", [])).toBeNull();
    expect(adventureWorld.readSensor(before, "facing_north", [])).toBeNull();
    expect(before.moves).toBe(0);
    expect(before.actor).toEqual({ x: 0, y: 0, facing: "east", holding: [] });

    const traced = replay(adventureWorld, level(), [
      {
        kind: "sensor",
        index: 0,
        line: 1,
        name: "front_is_clear",
        args: [],
        value: null,
      },
    ]);
    expect(traced).toHaveLength(1);
    expect(traced[0].sensorValue).toBeNull();
    expect(traced[0].state.moves).toBe(0);
    expect(traced[0].won).toBe(false);
  });
});
