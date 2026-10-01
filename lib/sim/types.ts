export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type TraceEvent =
  | {
      kind: "action";
      index: number;
      line: number;
      name: string;
      args: Json[];
    }
  | {
      kind: "sensor";
      index: number;
      line: number;
      name: string;
      args: Json[];
      value: Json;
    }
  | {
      kind: "vars";
      index: number;
      line: number;
      variables: Record<string, Json>;
    }
  | {
      kind: "stop";
      index: number;
      line: number | null;
      reason:
        | "done"
        | "wall"
        | "hazard"
        | "move_cap"
        | "empty_pick"
        | "bad_put"
        | "trace_limit"
        | "timeout"
        | "error";
      errorName?:
        | "SyntaxError"
        | "IndentationError"
        | "NameError"
        | "TypeError"
        | "RuntimeError";
      errorMessage?: string;
    };

export type Direction = "north" | "east" | "south" | "west";

export type ModeId = "adventure" | "robot" | "puzzle" | "sandbox";

export type SkinId =
  | "moss-canopy"
  | "cinder-dunes"
  | "keel-station"
  | "tide-vault"
  | "echo-archives"
  | "prism-spire";

export type Fault =
  | "wall"
  | "hazard"
  | "move_cap"
  | "empty_pick"
  | "bad_put"
  | "unknown_api";

export type ActorState = {
  x: number;
  y: number;
  facing: Direction;
  holding: string[];
};

export type CellState = {
  x: number;
  y: number;
  blocked: boolean;
  items: string[];
  hazard: string | null;
  goal: boolean;
};

export type WorldState = {
  mode: ModeId;
  skin: SkinId;
  width: number;
  height: number;
  actor: ActorState;
  cells: CellState[];
  moves: number;
  maxMoves: number | null;
  status: "running" | "won" | "lost";
  loss: Fault | null;
};

export type StepResult = {
  state: WorldState;
  ok: boolean;
  fault: Fault | null;
  sensorValue: Json | null;
  won: boolean;
};

export type FinalVarValue = string | number | boolean | null;

export type FinalVars = Record<string, FinalVarValue> | null;
