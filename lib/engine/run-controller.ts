import { phase1LevelSchema, type Phase1Level } from "@/lib/levels/schema";
import type { TraceEvent } from "@/lib/sim/types";
import {
  RUN_TIMEOUT_MS,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol";

export type RunControllerStatus =
  | "idle"
  | "loading-python"
  | "running"
  | "completed"
  | "error"
  | "timeout"
  | "cancelled";

export type RunControllerResult =
  | {
      status: "completed";
      runId: string;
      events: TraceEvent[];
    }
  | {
      status: "error";
      runId: string;
      events: TraceEvent[];
      line: number | null;
      errorName: string;
      errorMessage: string;
    }
  | {
      status: "timeout";
      runId: string;
      events: TraceEvent[];
    }
  | {
      status: "cancelled";
      runId: string;
      events: TraceEvent[];
    }
  | {
      status: "discarded";
      runId: string;
      reason: "total-mismatch" | "invalid-level";
    };

export type WorkerLike = {
  postMessage: (message: WorkerRequest) => void;
  terminate: () => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void;
  removeEventListener: (
    type: "message",
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void;
};

export type RunControllerOptions = {
  createWorker?: () => WorkerLike;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
  createRunId?: () => string;
  timeoutMs?: number;
};

type PendingRun = {
  runId: string;
  resolve: (result: RunControllerResult) => void;
  events: TraceEvent[];
  timer: ReturnType<typeof setTimeout> | null;
  pythonReady: boolean;
};

function defaultCreateWorker(): WorkerLike {
  return new Worker(new URL("./python.worker.ts", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;
}

/**
 * Main-thread run controller. Does not import Pyodide.
 * The 5s timer starts only after the worker posts `ready` and a run is going.
 */
export class RunController {
  private worker: WorkerLike | null = null;
  private status: RunControllerStatus = "idle";
  private pending: PendingRun | null = null;
  private pythonReady = false;
  private readonly createWorker: () => WorkerLike;
  private readonly now: () => number;
  private readonly setTimeout: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  private readonly createRunId: () => string;
  private readonly timeoutMs: number;
  private readonly onMessage: (event: MessageEvent<WorkerResponse>) => void;

  constructor(options: RunControllerOptions = {}) {
    this.createWorker = options.createWorker ?? defaultCreateWorker;
    this.now = options.now ?? (() => Date.now());
    this.setTimeout = options.setTimeout ?? setTimeout;
    this.clearTimeout = options.clearTimeout ?? clearTimeout;
    this.createRunId =
      options.createRunId ?? (() => crypto.randomUUID());
    this.timeoutMs = options.timeoutMs ?? RUN_TIMEOUT_MS;
    this.onMessage = (event) => this.handleMessage(event.data);
  }

  getStatus(): RunControllerStatus {
    return this.status;
  }

  isPythonReady(): boolean {
    return this.pythonReady;
  }

  async run(code: string, level: Phase1Level): Promise<RunControllerResult> {
    const parsed = phase1LevelSchema.safeParse(level);
    if (!parsed.success) {
      return {
        status: "discarded",
        runId: this.createRunId(),
        reason: "invalid-level",
      };
    }

    this.ensureWorker();
    const runId = this.createRunId();
    this.status = this.pythonReady ? "running" : "loading-python";

    return new Promise<RunControllerResult>((resolve) => {
      this.pending = {
        runId,
        resolve,
        events: [],
        timer: null,
        pythonReady: this.pythonReady,
      };

      if (this.pythonReady) {
        this.startTimer(runId);
        this.status = "running";
      }

      this.worker?.postMessage({
        type: "run",
        runId,
        code,
        level: parsed.data,
      });
    });
  }

  cancel(): void {
    const pending = this.pending;
    if (!pending) return;
    this.worker?.postMessage({ type: "cancel", runId: pending.runId });
    this.finishWithTerminate({
      status: "cancelled",
      runId: pending.runId,
      events: pending.events,
    });
  }

  dispose(): void {
    if (this.pending?.timer) this.clearTimeout(this.pending.timer);
    this.pending = null;
    if (this.worker) {
      this.worker.removeEventListener("message", this.onMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.pythonReady = false;
    this.status = "idle";
  }

  private ensureWorker(): void {
    if (this.worker) return;
    this.worker = this.createWorker();
    this.worker.addEventListener("message", this.onMessage);
    this.pythonReady = false;
  }

  private startTimer(runId: string): void {
    const pending = this.pending;
    if (!pending || pending.runId !== runId) return;
    if (pending.timer) this.clearTimeout(pending.timer);
    pending.timer = this.setTimeout(() => {
      if (!this.pending || this.pending.runId !== runId) return;
      this.finishWithTerminate({
        status: "timeout",
        runId,
        events: this.pending.events,
      });
    }, this.timeoutMs);
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === "ready") {
      this.pythonReady = true;
      if (this.pending) {
        this.pending.pythonReady = true;
        this.status = "running";
        this.startTimer(this.pending.runId);
      }
      return;
    }

    const pending = this.pending;
    if (!pending) return;
    if (!("runId" in message) || message.runId !== pending.runId) return;

    if (message.type === "trace-chunk") {
      pending.events.push(...message.events);
      return;
    }

    if (message.type === "trace-final") {
      pending.events.push(...message.events);
      if (pending.events.length !== message.total) {
        this.clearPendingTimer();
        const runId = pending.runId;
        this.pending = null;
        this.status = "idle";
        pending.resolve({
          status: "discarded",
          runId,
          reason: "total-mismatch",
        });
        return;
      }
      this.clearPendingTimer();
      this.pending = null;
      this.status = "completed";
      pending.resolve({
        status: "completed",
        runId: pending.runId,
        events: pending.events,
      });
      return;
    }

    if (message.type === "error") {
      pending.events.push(...message.events);
      this.clearPendingTimer();
      this.pending = null;
      this.status = "error";
      pending.resolve({
        status: "error",
        runId: pending.runId,
        events: pending.events,
        line: message.line,
        errorName: message.errorName,
        errorMessage: message.errorMessage,
      });
      return;
    }

    if (message.type === "timeout") {
      pending.events.push(...message.events);
      this.finishWithTerminate({
        status: "timeout",
        runId: pending.runId,
        events: pending.events,
      });
      return;
    }

    if (message.type === "cancelled") {
      this.finishWithTerminate({
        status: "cancelled",
        runId: pending.runId,
        events: pending.events,
      });
    }
  }

  private finishWithTerminate(result: RunControllerResult): void {
    const pending = this.pending;
    this.clearPendingTimer();
    this.pending = null;
    if (this.worker) {
      this.worker.removeEventListener("message", this.onMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.pythonReady = false;
    this.status =
      result.status === "timeout"
        ? "timeout"
        : result.status === "cancelled"
          ? "cancelled"
          : "idle";
    pending?.resolve(result);
  }

  private clearPendingTimer(): void {
    if (this.pending?.timer) {
      this.clearTimeout(this.pending.timer);
      this.pending.timer = null;
    }
  }
}
