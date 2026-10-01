/**
 * Progress seam for a later cloud save. Phase 1 does not wire a UI to this.
 */
export type ProgressSnapshot = {
  levelId: string;
  stars: 0 | 1 | 2 | 3;
  solvedAt: string | null;
};

export interface ProgressPort {
  load(): Promise<ProgressSnapshot[]>;
  save(snapshot: ProgressSnapshot): Promise<void>;
}
