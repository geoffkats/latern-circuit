import type { Phase1Level } from "@/lib/levels/schema";
import type { TraceEvent } from "@/lib/sim/types";

export type WorkerRequest =
  | { type: "run"; runId: string; code: string; level: Phase1Level }
  | { type: "cancel"; runId: string };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "trace-chunk"; runId: string; events: TraceEvent[] }
  | {
      type: "trace-final";
      runId: string;
      events: TraceEvent[];
      total: number;
    }
  | {
      type: "error";
      runId: string;
      line: number | null;
      errorName: string;
      errorMessage: string;
      events: TraceEvent[];
    }
  | { type: "timeout"; runId: string; events: TraceEvent[]; total: number }
  | { type: "cancelled"; runId: string };

export const TRACE_EVENT_CAP = 2000;
export const TRACE_CHUNK_SIZE = 25;
export const RUN_TIMEOUT_MS = 5000;
