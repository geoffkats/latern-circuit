import { describe, expect, it } from "vitest";
import {
  countCodeLines,
  exceedsMaxLines,
  findForbiddenKeywords,
  hasForbiddenKeyword,
} from "@/lib/levels/constraints";
import { evaluateStars } from "@/lib/levels/stars";

describe("level constraints", () => {
  it("ignores blank lines and full-line comments when counting code lines", () => {
    const code = [
      "move()",
      "",
      "# face the wall",
      "turn_left()",
      "  # indented comment still full-line",
      "move()",
    ].join("\n");

    expect(countCodeLines(code)).toBe(3);
    expect(exceedsMaxLines(code, 3)).toBe(false);
    expect(exceedsMaxLines(code, 2)).toBe(true);
    expect(exceedsMaxLines(code, null)).toBe(false);
  });

  it("matches forbidden keywords as whole words", () => {
    expect(findForbiddenKeywords("forward = 1", ["for"])).toEqual([]);
    expect(findForbiddenKeywords("for step in range(3):", ["for"])).toEqual([
      "for",
    ]);
    expect(
      hasForbiddenKeyword('print("while")\nwhile True:\n  pass', [
        "while",
        "import",
      ]),
    ).toBe(true);
    expect(findForbiddenKeywords("import math", ["import"])).toEqual([
      "import",
    ]);
  });
});

describe("stars", () => {
  const stars = {
    efficientMaxMoves: 3,
    elegantMaxLines: 3,
    bonusTechnique: "uses_variable" as const,
  };

  it("awards 1, 2, or 3 stars and keeps bonusTechnique as a flag", () => {
    expect(
      evaluateStars({
        solved: false,
        moves: 1,
        code: "move()",
        stars,
        usedBonusTechnique: true,
      }),
    ).toEqual({ stars: 0, bonusTechnique: true });

    expect(
      evaluateStars({
        solved: true,
        moves: 4,
        code: "move()\nmove()\nmove()\nmove()",
        stars,
      }),
    ).toEqual({ stars: 1, bonusTechnique: false });

    expect(
      evaluateStars({
        solved: true,
        moves: 3,
        code: "move()\nmove()\nmove()\nmove()",
        stars,
      }),
    ).toEqual({ stars: 2, bonusTechnique: false });

    expect(
      evaluateStars({
        solved: true,
        moves: 3,
        code: "move()\nmove()\nmove()",
        stars,
        usedBonusTechnique: true,
      }),
    ).toEqual({ stars: 3, bonusTechnique: true });
  });
});
