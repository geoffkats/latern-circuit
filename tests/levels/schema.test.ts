import { describe, expect, it } from "vitest";
import { ADVENTURE_API } from "@/lib/sim/adventure/api";
import { ROBOT_API } from "@/lib/sim/robot/api";
import { phase1Levels } from "@/lib/levels/load-level";
import {
  adventureCommandSchema,
  hintIsProgram,
  phase1LevelSchema,
  robotCommandSchema,
  type AdventureLevel,
} from "@/lib/levels/schema";
import { createLevelState } from "@/lib/levels/solved";
import { conceptCardFor, conceptCards } from "@/content/concepts";

function baseAdventure(
  overrides: Partial<AdventureLevel> = {},
): AdventureLevel {
  return {
    id: "mc-test-level",
    title: "Test Level",
    mode: "adventure",
    worldId: "moss-canopy",
    conceptId: "sequence",
    story: {
      intro: "Intro text for the test level.",
      success: "Success text for the test level.",
      blocked: "Blocked text for the test level.",
    },
    hints: ["Walk east.", "Take one step.", "Pick the fruit."],
    apiAllow: ["move", "pick_item"],
    constraints: {
      maxLines: 4,
      forbiddenKeywords: ["for", "while"],
      maxMoves: 4,
    },
    stars: {
      efficientMaxMoves: 3,
      elegantMaxLines: 3,
      bonusTechnique: null,
    },
    grid: { width: 3, height: 2 },
    start: { x: 0, y: 0, facing: "east" },
    walls: [],
    finalVars: null,
    items: [
      { x: 1, y: 0, kind: "glowfruit", count: 1, required: true },
    ],
    hazards: [],
    goal: { x: 2, y: 0 },
    ...overrides,
  };
}

describe("phase1 level schema", () => {
  it("accepts all eight content levels", () => {
    expect(phase1Levels).toHaveLength(8);
    expect(phase1Levels.map((level) => level.id)).toEqual([
      "mc-01-first-steps",
      "mc-02-the-bend",
      "mc-03-glowfruit",
      "ks-01-bay-walk",
      "ks-02-corner-crate",
      "ks-03-two-crates",
      "cd-01-carried",
      "ks-04-clear-ahead",
    ]);
  });

  it("rejects unknown keys", () => {
    const result = phase1LevelSchema.safeParse({
      ...baseAdventure(),
      solution: "move()",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a hazard on the start tile with a clear message", () => {
    const refined = phase1LevelSchema.safeParse(
      baseAdventure({
        hazards: [{ x: 0, y: 0, kind: "thorn" }],
      }),
    );
    expect(refined.success).toBe(false);
    if (refined.success) return;
    const messages = refined.error.issues.map((issue) => issue.message);
    expect(messages.some((message) => message.includes("start"))).toBe(true);
    expect(messages.some((message) => /hazard/i.test(message))).toBe(true);
  });

  it("rejects a hazard on an item tile with a clear message", () => {
    const refined = phase1LevelSchema.safeParse(
      baseAdventure({
        hazards: [{ x: 1, y: 0, kind: "gap" }],
      }),
    );
    expect(refined.success).toBe(false);
    if (refined.success) return;
    const messages = refined.error.issues.map((issue) => issue.message);
    expect(messages.some((message) => message.includes("item"))).toBe(true);
    expect(messages.some((message) => /hazard/i.test(message))).toBe(true);
  });

  it("rejects a hazard on the goal or a wall", () => {
    const onGoal = phase1LevelSchema.safeParse(
      baseAdventure({
        hazards: [{ x: 2, y: 0, kind: "spark" }],
      }),
    );
    expect(onGoal.success).toBe(false);

    const onWall = phase1LevelSchema.safeParse(
      baseAdventure({
        walls: [{ x: 0, y: 1 }],
        hazards: [{ x: 0, y: 1, kind: "current" }],
      }),
    );
    expect(onWall.success).toBe(false);
  });

  it("explains why a hint is a program", () => {
    expect(hintIsProgram("use move() (twice)")).toBe(
      "A hint cannot contain two or more call parentheses.",
    );
    expect(hintIsProgram("step\nmove()")).toBe(
      "A hint cannot contain a newline plus a call.",
    );
    expect(hintIsProgram("write a def later")).toBe(
      "A hint cannot contain the word def.",
    );

    const rejected = phase1LevelSchema.safeParse(
      baseAdventure({
        hints: ["use move() (twice)", "Walk east.", "Take one step."],
      }),
    );
    expect(rejected.success).toBe(false);
    if (rejected.success) return;
    expect(
      rejected.error.issues.some(
        (issue) =>
          issue.message ===
          "A hint cannot contain two or more call parentheses.",
      ),
    ).toBe(true);
  });

  it("allows a hint that names one command", () => {
    expect(hintIsProgram("Each step forward is a single command.")).toBeNull();
    expect(hintIsProgram("One move() covers one tile.")).toBeNull();
  });

  it("matches ROBOT_API and ADVENTURE_API names to the command enums", () => {
    expect(ROBOT_API.map((entry) => entry.name)).toEqual(
      robotCommandSchema.options,
    );
    expect(ADVENTURE_API.map((entry) => entry.name)).toEqual(
      adventureCommandSchema.options,
    );
  });

  it("copies maxMoves into the initial world state", () => {
    for (const level of phase1Levels) {
      const state = createLevelState(level);
      expect(state.maxMoves).toBe(level.constraints.maxMoves);
    }
  });

  it("has a concept card for every level concept", () => {
    for (const level of phase1Levels) {
      expect(conceptCardFor(level.conceptId)?.id).toBe(level.conceptId);
    }
    expect(conceptCards.map((card) => card.id)).toEqual([
      "sequence",
      "turn",
      "pick-put",
      "stack",
      "variable",
      "sensor",
    ]);
  });
});
