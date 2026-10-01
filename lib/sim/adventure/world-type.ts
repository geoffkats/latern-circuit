import { z } from "zod";
import { buildCells } from "../grid";
import type { Direction, FinalVars, SkinId, WorldState } from "../types";
import type { WorldType } from "../world-type";
import { ADVENTURE_API } from "./api";
import {
  adventureGoalMet,
  applyAdventureAction,
  readAdventureSensor,
} from "./rules";

const skinSchema = z.enum([
  "moss-canopy",
  "cinder-dunes",
  "keel-station",
  "tide-vault",
  "echo-archives",
  "prism-spire",
]);

const directionSchema = z.enum(["north", "east", "south", "west"]);

export const adventureLevelSchema = z.object({
  mode: z.literal("adventure"),
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
      required: z.boolean(),
    }),
  ),
  hazards: z.array(
    z.object({
      x: z.number().int(),
      y: z.number().int(),
      kind: z.string(),
    }),
  ),
  goal: z.object({
    x: z.number().int(),
    y: z.number().int(),
  }),
  constraints: z.object({
    maxMoves: z.number().int().nullable(),
  }),
  finalVars: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
});

export type AdventureLevel = {
  mode: "adventure";
  worldId: SkinId;
  grid: { width: number; height: number };
  start: { x: number; y: number; facing: Direction };
  walls: { x: number; y: number }[];
  items: { x: number; y: number; kind: string; count: number; required: boolean }[];
  hazards: { x: number; y: number; kind: string }[];
  goal: { x: number; y: number };
  constraints: { maxMoves: number | null };
  finalVars: FinalVars;
};

export function createAdventureState(level: AdventureLevel): WorldState {
  return {
    mode: "adventure",
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
      level.hazards,
      level.goal,
    ),
    moves: 0,
    maxMoves: level.constraints.maxMoves,
    status: "running",
    loss: null,
  };
}

export const adventureWorld: WorldType<AdventureLevel> = {
  id: "adventure",
  levelSchema: adventureLevelSchema,
  api: ADVENTURE_API,
  createInitialState: createAdventureState,
  applyAction: applyAdventureAction,
  readSensor: readAdventureSensor,
  checkWin: adventureGoalMet,
  skinId(level) {
    return level.worldId;
  },
};
