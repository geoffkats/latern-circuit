import { adventureWorld } from "./adventure/world-type";
import { robotWorld } from "./robot/world-type";

export const worldRegistry = {
  adventure: adventureWorld,
  robot: robotWorld,
} as const;

export type RegisteredMode = keyof typeof worldRegistry;
