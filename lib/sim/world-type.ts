import type { ZodType } from "zod";
import type {
  Json,
  ModeId,
  SkinId,
  StepResult,
  WorldState,
} from "./types";

export type ApiParam = {
  name: string;
  type: "int" | "str" | "bool";
  optional?: boolean;
};

export type ApiFunctionDescriptor = {
  name: string;
  params: readonly ApiParam[];
  returns: "none" | "bool" | "int" | "str";
  doc: string;
  mutates: boolean;
};

export type WinCheck = {
  passed: boolean;
  reason: "goal" | "incomplete" | "lost";
};

export interface WorldType<TLevel> {
  id: ModeId;
  levelSchema: ZodType<TLevel>;
  api: readonly ApiFunctionDescriptor[];
  createInitialState(level: TLevel): WorldState;
  applyAction(
    state: WorldState,
    name: string,
    args: readonly Json[],
  ): StepResult;
  readSensor(state: WorldState, name: string, args: readonly Json[]): Json;
  checkWin(state: WorldState, level: TLevel): WinCheck;
  skinId(level: TLevel): SkinId;
}
