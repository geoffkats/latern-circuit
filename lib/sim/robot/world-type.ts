import { z } from "zod";
import { buildCells } from "../grid";
import type { Direction, FinalVars, SkinId, WorldState } from "../types";
import type { WorldType } from "../world-type";
import { ROBOT_API } from "./api";
import { applyRobotAction, readRobotSensor, robotGoalMet } from "./rules";

const skinSchema = z.enum([
  "moss-canopy",
  "cinder-dunes",
  "keel-station",
  "tide-vault",
  "echo-archives",
  "prism-spire",
]);

const directionSchema = z.enum(["north", "east", "south", "west"]);

export const robotLevelSchema = z.object({
  mode: z.literal("robot"),
  worldId: skinSchema,
  grid: z.object({
    width: z.number().int(),
    height: z.number().int(),
  }),
  start: z.object({
    x: z.number().int(),
    y: z.number().int(),
    facing: directionSchema,
  }),
  walls: z.array(z.object({ x: z.number().int(), y: z.number().int() })),
  items: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      kind: z.string(),
      count: z.number().int(),
    }),
  ),
  goal: z.object({
    x: z.number().int(),
    y: z.number().int(),
    holding: z.array(z.object({ kind: z.string(), count: z.number().int() })),
    collectKinds: z.array(z.string()),
  }),
  constraints: z.object({
    maxMoves: z.number().int().nullable(),
  }),
  finalVars: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
});

export type RobotLevel = {
  mode: "robot";
  worldId: SkinId;
  grid: { width: number; height: number };
  start: { x: number; y: number; facing: Direction };
  walls: { x: number; y: number }[];
  items: { x: number; y: number; kind: string; count: number }[];
  goal: {
    x: number;
    y: number;
    holding: { kind: string; count: number }[];
    collectKinds: string[];
  };
  constraints: { maxMoves: number | null };
  finalVars: FinalVars;
};

export function createRobotState(level: RobotLevel): WorldState {
  return {
    mode: "robot",
    skin: level.worldId,
    width: level.grid.width,
    height: level.grid.height,
    actor: {
      x: level.start.x,
      y: level.start.y,
      facing: level.start.facing,
      holding: [],
    },
    cells: buildCells(
      level.grid.width,
      level.grid.height,
      level.walls,
      level.items,
      [],
      level.goal,
    ),
    moves: 0,
    maxMoves: level.constraints.maxMoves,
    status: "running",
    loss: null,
  };
}

export const robotWorld: WorldType<RobotLevel> = {
  id: "robot",
  levelSchema: robotLevelSchema,
  api: ROBOT_API,
  createInitialState: createRobotState,
  applyAction: applyRobotAction,
  readSensor: readRobotSensor,
  checkWin: robotGoalMet,
  skinId(level) {
    return level.worldId;
  },
};
