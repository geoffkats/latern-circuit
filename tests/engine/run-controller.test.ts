import { describe, expect, it } from "vitest";
import { RunController, type WorkerLike } from "@/lib/engine/run-controller";
import type { WorkerRequest, WorkerResponse } from "@/lib/engine/protocol";
import { loadLevel } from "@/lib/levels/load-level";

class FakeWorker implements WorkerLike {
  listeners = new Set<(event: MessageEvent<WorkerResponse>) => void>();
  terminated = false;
  messages: WorkerRequest[] = [];
  autoReadyDelay: number | null = 1000;
  runHandler:
    | ((request: Extract<WorkerRequest, { type: "run" }>) => void)
    | null = null;

  constructor(
    private readonly queueTimer: (fn: () => void, ms: number) => void,
  ) {}

  postMessage(message: WorkerRequest): void {
    this.messages.push(message);
    if (message.type === "run") {
      if (this.autoReadyDelay !== null) {
        this.queueTimer(() => {
          this.emit({ type: "ready" });
          this.runHandler?.(message);
        }, this.autoReadyDelay);
      } else {
        this.runHandler?.(message);
      }
    }
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  emit(data: WorkerResponse): void {
    if (this.terminated) return;
    const event = { data } as MessageEvent<WorkerResponse>;
    for (const listener of this.listeners) listener(event);
  }
}

function installFakeClock() {
  let now = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  let nextId = 1;

  const setTimeoutFn = (fn: () => void, ms: number) => {
    const id = nextId;
    nextId += 1;
    timers.set(id, { fn, at: now + ms });
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  const clearTimeoutFn = (id: ReturnType<typeof setTimeout>) => {
    timers.delete(id as unknown as number);
  };

  const flush = (target: number) => {
    now = target;
    for (const [id, timer] of [...timers.entries()]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.fn();
      }
    }
  };

  return {
    now: () => now,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    flush,
  };
}

describe("run controller timer", () => {
  it("does not count load time toward the 5s timeout", async () => {
    const clock = installFakeClock();
    let worker: FakeWorker | null = null;

    const controller = new RunController({
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      createRunId: () => "run-load",
      timeoutMs: 5000,
      createWorker: () => {
        worker = new FakeWorker((fn, ms) => clock.setTimeout(fn, ms));
        worker.autoReadyDelay = 4000;
        worker.runHandler = () => {
          // Stay running until the host timer fires.
        };
        return worker;
      },
    });

    const level = loadLevel("ks-01-bay-walk");
    const resultPromise = controller.run("move()", level);

    expect(controller.getStatus()).toBe("loading-python");
    clock.flush(3999);
    expect(controller.getStatus()).toBe("loading-python");
    expect(controller.isPythonReady()).toBe(false);

    clock.flush(4000);
    expect(controller.isPythonReady()).toBe(true);
    expect(controller.getStatus()).toBe("running");

    // 5s after ready is t=9000. Still running just before that.
    clock.flush(8999);
    expect(controller.getStatus()).toBe("running");

    clock.flush(9000);
    await expect(resultPromise).resolves.toMatchObject({
      status: "timeout",
      runId: "run-load",
    });
    expect(worker!.terminated).toBe(true);
  });

  it("times out a run after ready and rebuilds a worker afterward", async () => {
    const clock = installFakeClock();
    let workerCount = 0;
    const workers: FakeWorker[] = [];

    const controller = new RunController({
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      createRunId: () => `run-${workerCount}`,
      timeoutMs: 5000,
      createWorker: () => {
        workerCount += 1;
        const worker = new FakeWorker((fn, ms) => clock.setTimeout(fn, ms));
        workers.push(worker);
        worker.autoReadyDelay = 0;
        worker.runHandler = (request) => {
          if (workerCount === 1) return;
          worker.emit({
            type: "trace-final",
            runId: request.runId,
            events: [],
            total: 0,
          });
        };
        return worker;
      },
    });

    const level = loadLevel("ks-01-bay-walk");
    const first = controller.run("move()", level);
    clock.flush(0);
    expect(controller.getStatus()).toBe("running");
    clock.flush(5000);
    await expect(first).resolves.toMatchObject({ status: "timeout" });
    expect(workers[0]!.terminated).toBe(true);

    workers[0]!.emit({
      type: "trace-final",
      runId: "run-1",
      events: [{ kind: "stop", index: 0, line: 1, reason: "done" }],
      total: 1,
    });

    const second = controller.run("move()\nmove()\nmove()\n", level);
    clock.flush(clock.now());
    await expect(second).resolves.toMatchObject({ status: "completed" });
    expect(workerCount).toBe(2);
  });
});
