import cd01 from "@/content/levels/cinder-dunes/cd-01-carried.json";
import ks01 from "@/content/levels/keel-station/ks-01-bay-walk.json";
import ks02 from "@/content/levels/keel-station/ks-02-corner-crate.json";
import ks03 from "@/content/levels/keel-station/ks-03-two-crates.json";
import ks04 from "@/content/levels/keel-station/ks-04-clear-ahead.json";
import mc01 from "@/content/levels/moss-canopy/mc-01-first-steps.json";
import mc02 from "@/content/levels/moss-canopy/mc-02-the-bend.json";
import mc03 from "@/content/levels/moss-canopy/mc-03-glowfruit.json";
import {
  phase1LevelSchema,
  type Phase1Level,
} from "./schema";

const rawLevels = [mc01, mc02, mc03, ks01, ks02, ks03, cd01, ks04] as const;

export const phase1Levels: readonly Phase1Level[] = rawLevels.map((raw) =>
  phase1LevelSchema.parse(raw),
);

const levelsById = new Map(
  phase1Levels.map((level) => [level.id, level] as const),
);

export function loadLevel(id: string): Phase1Level {
  const level = levelsById.get(id);
  if (!level) {
    throw new Error(`Unknown level id: ${id}`);
  }
  return level;
}

export function listLevelIds(): string[] {
  return phase1Levels.map((level) => level.id);
}
