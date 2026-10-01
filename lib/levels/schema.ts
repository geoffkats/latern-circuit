import * as z from "zod";

const kindSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const cellSchema = z.strictObject({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

const directionSchema = z.enum(["north", "east", "south", "west"]);

const worldIdSchema = z.enum([
  "moss-canopy",
  "cinder-dunes",
  "keel-station",
  "tide-vault",
  "echo-archives",
  "prism-spire",
]);

const conceptIdSchema = z.enum([
  "sequence",
  "turn",
  "pick-put",
  "stack",
  "variable",
  "for-loop",
  "while-loop",
  "nested-loop",
  "conditional",
  "sensor",
  "function",
  "list",
  "string",
]);

const hintSchema = z.string().min(1).max(280);

const sharedFields = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(48),
  worldId: worldIdSchema,
  conceptId: conceptIdSchema,
  story: z.strictObject({
    intro: z.string().min(1).max(320),
    success: z.string().min(1).max(320),
    blocked: z.string().min(1).max(320),
  }),
  hints: z.tuple([hintSchema, hintSchema, hintSchema]),
  constraints: z.strictObject({
    maxLines: z.number().int().positive().nullable(),
    forbiddenKeywords: z.array(z.string().min(1).max(32)).max(24),
    maxMoves: z.number().int().positive().nullable(),
  }),
  stars: z.strictObject({
    efficientMaxMoves: z.number().int().positive(),
    elegantMaxLines: z.number().int().positive(),
    bonusTechnique: z
      .enum(["uses_loop", "uses_function", "uses_variable", "uses_sensor"])
      .nullable(),
  }),
  grid: z.strictObject({
    width: z.number().int().min(1).max(16),
    height: z.number().int().min(1).max(16),
  }),
  start: z.strictObject({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    facing: directionSchema,
  }),
  walls: z.array(cellSchema).max(256),
  finalVars: z
    .record(
      z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,31}$/),
      z.union([z.string().max(80), z.number(), z.boolean(), z.null()]),
    )
    .nullable(),
};

const pileSchema = z.strictObject({
  kind: kindSchema,
  count: z.number().int().min(1).max(20),
});

const placedSchema = z.strictObject({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  kind: kindSchema,
  count: z.number().int().min(1).max(20),
});

export const robotCommandSchema = z.enum([
  "move",
  "turn_left",
  "turn_right",
  "pick_item",
  "put_item",
  "front_is_clear",
  "left_is_clear",
  "right_is_clear",
  "item_here",
  "facing_north",
  "facing_east",
  "facing_south",
  "facing_west",
]);

export const adventureCommandSchema = z.enum([
  "move",
  "turn_left",
  "turn_right",
  "pick_item",
  "put_item",
]);

export const robotLevelSchema = z.strictObject({
  mode: z.literal("robot"),
  ...sharedFields,
  apiAllow: z.array(robotCommandSchema).min(1).max(13),
  items: z.array(placedSchema).max(64),
  goal: z.strictObject({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    holding: z.array(pileSchema).max(8),
    collectKinds: z.array(kindSchema).max(8),
  }),
});

export const adventureLevelSchema = z.strictObject({
  mode: z.literal("adventure"),
  ...sharedFields,
  apiAllow: z.array(adventureCommandSchema).min(1).max(5),
  items: z
    .array(
      z.strictObject({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        kind: kindSchema,
        count: z.number().int().min(1).max(20),
        required: z.boolean(),
      }),
    )
    .max(64),
  hazards: z
    .array(
      z.strictObject({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        kind: z.enum(["thorn", "gap", "spark", "current"]),
      }),
    )
    .max(64),
  goal: cellSchema,
});

function inside(
  grid: { width: number; height: number },
  cell: { x: number; y: number },
): boolean {
  return cell.x < grid.width && cell.y < grid.height;
}

export function hintIsProgram(hint: string): string | null {
  const calls = hint.match(/\(/g)?.length ?? 0;
  if (calls > 1) {
    return "A hint cannot contain two or more call parentheses.";
  }
  if (hint.includes("\n") && calls > 0) {
    return "A hint cannot contain a newline plus a call.";
  }
  if (/\bdef\b/.test(hint)) {
    return "A hint cannot contain the word def.";
  }
  return null;
}

export const phase1LevelSchema = z
  .discriminatedUnion("mode", [robotLevelSchema, adventureLevelSchema])
  .superRefine((level, ctx) => {
    const cells = [
      level.start,
      level.goal,
      ...level.walls,
      ...level.items,
      ...("hazards" in level ? level.hazards : []),
    ];
    cells.forEach((cell, i) => {
      if (!inside(level.grid, cell)) {
        ctx.addIssue({
          code: "custom",
          path: ["bounds", i],
          message: "Cell is outside the grid.",
        });
      }
    });
    const wallKey = new Set(level.walls.map((wall) => `${wall.x},${wall.y}`));
    const occupied = [level.start, level.goal, ...level.items];
    occupied.forEach((cell) => {
      if (wallKey.has(`${cell.x},${cell.y}`)) {
        ctx.addIssue({
          code: "custom",
          path: ["walls"],
          message: "Start, goal, and items cannot sit on a wall.",
        });
      }
    });
    level.hints.forEach((hint, i) => {
      const issue = hintIsProgram(hint);
      if (issue) {
        ctx.addIssue({
          code: "custom",
          path: ["hints", i],
          message: issue,
        });
      }
    });
    const seen = new Set<string>();
    level.apiAllow.forEach((name, i) => {
      if (seen.has(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["apiAllow", i],
          message: "Duplicate command.",
        });
      }
      seen.add(name);
    });
    if ("hazards" in level) {
      const itemKey = new Set(level.items.map((item) => `${item.x},${item.y}`));
      level.hazards.forEach((hazard, i) => {
        const key = `${hazard.x},${hazard.y}`;
        const onGoal = hazard.x === level.goal.x && hazard.y === level.goal.y;
        const onStart =
          hazard.x === level.start.x && hazard.y === level.start.y;
        const onWall = wallKey.has(key);
        const onItem = itemKey.has(key);
        if (onGoal || onStart || onWall || onItem) {
          ctx.addIssue({
            code: "custom",
            path: ["hazards", i],
            message:
              "A hazard cannot sit on the start, the goal, a wall, or an item.",
          });
        }
      });
    }
  });

export type Phase1Level = z.infer<typeof phase1LevelSchema>;
export type RobotLevel = z.infer<typeof robotLevelSchema>;
export type AdventureLevel = z.infer<typeof adventureLevelSchema>;
export type ConceptId = z.infer<typeof conceptIdSchema>;
