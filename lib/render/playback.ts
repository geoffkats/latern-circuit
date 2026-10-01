import type { Direction, WorldState } from "@/lib/sim/types";

export type SpeedId = "slow" | "normal" | "fast";

export const SPEED_MS: Record<SpeedId, number> = {
  slow: 700,
  normal: 350,
  fast: 175,
};

export type PlaybackFrame = {
  state: WorldState;
  /** 0 when settled on this frame; 0–1 while tweening in from the previous frame. */
  tween: number;
};

export function facingDelta(facing: Direction): { x: number; y: number } {
  switch (facing) {
    case "north":
      return { x: 0, y: 1 };
    case "east":
      return { x: 1, y: 0 };
    case "south":
      return { x: 0, y: -1 };
    case "west":
      return { x: -1, y: 0 };
  }
}

/**
 * Builds display frames: index 0 is the initial state, then one frame per
 * spatial step result. Vars/stop are already absent from stepResults.
 */
export function framesFromSteps(
  initial: WorldState,
  stepStates: readonly WorldState[],
): WorldState[] {
  return [initial, ...stepStates];
}

export function clampCursor(cursor: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.max(0, Math.min(cursor, frameCount - 1));
}
