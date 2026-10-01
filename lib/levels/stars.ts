import { countCodeLines } from "./constraints";
import type { Phase1Level } from "./schema";

export type StarCount = 0 | 1 | 2 | 3;

export type StarInput = {
  solved: boolean;
  moves: number;
  code: string;
  stars: Phase1Level["stars"];
  /** True when the run used the level's bonus technique. */
  usedBonusTechnique?: boolean;
};

export type StarResult = {
  stars: StarCount;
  /** Extra flag only. Never a fourth star. */
  bonusTechnique: boolean;
};

/**
 * 1 if solved, 2 if also moves <= efficientMaxMoves, 3 if also lines <= elegantMaxLines.
 * `bonusTechnique` is reported separately and never raises the star count.
 */
export function evaluateStars(input: StarInput): StarResult {
  const lines = countCodeLines(input.code);
  const bonusTechnique =
    input.stars.bonusTechnique !== null && input.usedBonusTechnique === true;

  if (!input.solved) {
    return { stars: 0, bonusTechnique };
  }

  let stars: StarCount = 1;
  if (input.moves <= input.stars.efficientMaxMoves) {
    stars = 2;
    if (lines <= input.stars.elegantMaxLines) {
      stars = 3;
    }
  }

  return { stars, bonusTechnique };
}
