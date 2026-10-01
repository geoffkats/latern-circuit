import type { CellState, Direction, WorldState } from "./types";

export function cellIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function inBounds(
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function turnLeft(facing: Direction): Direction {
  switch (facing) {
    case "north":
      return "west";
    case "west":
      return "south";
    case "south":
      return "east";
    case "east":
      return "north";
    default: {
      const unreachable: never = facing;
      return unreachable;
    }
  }
}

export function turnRight(facing: Direction): Direction {
  switch (facing) {
    case "north":
      return "east";
    case "east":
      return "south";
    case "south":
      return "west";
    case "west":
      return "north";
    default: {
      const unreachable: never = facing;
      return unreachable;
    }
  }
}

export function forwardDelta(facing: Direction): { x: number; y: number } {
  switch (facing) {
    case "north":
      return { x: 0, y: 1 };
    case "east":
      return { x: 1, y: 0 };
    case "south":
      return { x: 0, y: -1 };
    case "west":
      return { x: -1, y: 0 };
    default: {
      const unreachable: never = facing;
      return unreachable;
    }
  }
}

export function frontCell(
  x: number,
  y: number,
  facing: Direction,
): { x: number; y: number } {
  const delta = forwardDelta(facing);
  return { x: x + delta.x, y: y + delta.y };
}

export function cellAt(state: WorldState, x: number, y: number): CellState {
  return state.cells[cellIndex(state.width, x, y)];
}

export function isDirectionClear(state: WorldState, facing: Direction): boolean {
  const next = frontCell(state.actor.x, state.actor.y, facing);
  if (!inBounds(state.width, state.height, next.x, next.y)) return false;
  return !cellAt(state, next.x, next.y).blocked;
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    mode: state.mode,
    skin: state.skin,
    width: state.width,
    height: state.height,
    actor: {
      x: state.actor.x,
      y: state.actor.y,
      facing: state.actor.facing,
      holding: [...state.actor.holding],
    },
    cells: state.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      blocked: cell.blocked,
      items: [...cell.items],
      hazard: cell.hazard,
      goal: cell.goal,
    })),
    moves: state.moves,
    maxMoves: state.maxMoves,
    status: state.status,
    loss: state.loss,
  };
}

export type WallCell = { x: number; y: number };

export type ItemPile = {
  x: number;
  y: number;
  kind: string;
  count: number;
};

export type HazardCell = { x: number; y: number; kind: string };

export function buildCells(
  width: number,
  height: number,
  walls: readonly WallCell[],
  items: readonly ItemPile[],
  hazards: readonly HazardCell[],
  goal: { x: number; y: number },
): CellState[] {
  const cells: CellState[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({
        x,
        y,
        blocked: false,
        items: [],
        hazard: null,
        goal: goal.x === x && goal.y === y,
      });
    }
  }

  for (const wall of walls) {
    if (!inBounds(width, height, wall.x, wall.y)) continue;
    cells[cellIndex(width, wall.x, wall.y)].blocked = true;
  }

  for (const hazard of hazards) {
    if (!inBounds(width, height, hazard.x, hazard.y)) continue;
    cells[cellIndex(width, hazard.x, hazard.y)].hazard = hazard.kind;
  }

  for (const pile of items) {
    if (!inBounds(width, height, pile.x, pile.y)) continue;
    const cell = cells[cellIndex(width, pile.x, pile.y)];
    for (let copy = 0; copy < pile.count; copy += 1) {
      cell.items.push(pile.kind);
    }
  }

  return cells;
}
