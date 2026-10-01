import type { Phase1Level } from "@/lib/levels/schema";
import { phase1LevelSchema } from "@/lib/levels/schema";
import type { AdventureLevel as SimAdventureLevel } from "@/lib/sim/adventure/world-type";
import { adventureWorld } from "@/lib/sim/adventure/world-type";
import type { RobotLevel as SimRobotLevel } from "@/lib/sim/robot/world-type";
import { robotWorld } from "@/lib/sim/robot/world-type";
import type { Fault, Json, TraceEvent, WorldState } from "@/lib/sim/types";
import type { ApiFunctionDescriptor, WorldType } from "@/lib/sim/world-type";
import {
  TRACE_CHUNK_SIZE,
  TRACE_EVENT_CAP,
  type WorkerResponse,
} from "./protocol";

export type PyodideLike = {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    get: (name: string) => unknown;
    set: (name: string, value: unknown) => void;
  };
  registerJsModule: (name: string, module: Record<string, unknown>) => void;
  toPy: (value: unknown) => unknown;
};

export type StudentRunResult =
  | { kind: "final"; events: TraceEvent[] }
  | {
      kind: "error";
      events: TraceEvent[];
      line: number | null;
      errorName: string;
      errorMessage: string;
    }
  | { kind: "cancelled"; events: TraceEvent[] };

type WorldBridge =
  | {
      mode: "robot";
      world: WorldType<SimRobotLevel>;
      level: SimRobotLevel;
    }
  | {
      mode: "adventure";
      world: WorldType<SimAdventureLevel>;
      level: SimAdventureLevel;
    };

type ApiOutcome =
  | { kind: "ok"; value: Json | null }
  | { kind: "halt"; fault: Fault }
  | { kind: "cancel" }
  | { kind: "trace_limit" };

const STUDENT_FILENAME = "<student>";

type BridgeSession = {
  setLine: (line: number) => void;
  emitVars: (line: number, raw: Record<string, unknown>) => void;
  callApi: (name: string, args: unknown[]) => ApiOutcome;
  shouldCancel: () => boolean;
};

const bridgeSessions = new WeakMap<PyodideLike, BridgeSession>();
const bootstrapped = new WeakSet<PyodideLike>();

const BOOTSTRAP_PYTHON = `
import sys
import types
from lantern_bridge import set_line, emit_vars, call_api, should_cancel

sys.setrecursionlimit(100)

class WorldHalt(Exception):
    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)

class TraceLimit(Exception):
    pass

class Cancelled(Exception):
    pass

def _locals_dict(frame):
    out = {}
    for key, value in frame.f_locals.items():
        if key.startswith("_"):
            continue
        if key.startswith("__") and key.endswith("__"):
            continue
        if callable(value):
            continue
        if isinstance(value, type):
            continue
        if isinstance(value, types.ModuleType):
            continue
        out[key] = value
    return out

_pending_line = None

def _tracer(frame, event, arg):
    global _pending_line
    if frame.f_code.co_filename != "${STUDENT_FILENAME}":
        return None
    if event == "call":
        return _tracer
    if event == "line":
        if should_cancel():
            raise Cancelled()
        if _pending_line is not None:
            emit_vars(_pending_line, _locals_dict(frame))
        _pending_line = frame.f_lineno
        set_line(frame.f_lineno)
        return _tracer
    if event == "return":
        if _pending_line is not None:
            emit_vars(_pending_line, _locals_dict(frame))
            _pending_line = None
        return _tracer
    return _tracer

def _make_api(name):
    def _fn(*args):
        if should_cancel():
            raise Cancelled()
        result = call_api(name, list(args))
        kind = result["kind"] if isinstance(result, dict) else getattr(result, "kind", None)
        if kind == "cancel":
            raise Cancelled()
        if kind == "trace_limit":
            raise TraceLimit()
        if kind == "halt":
            fault = result["fault"] if isinstance(result, dict) else getattr(result, "fault", "wall")
            raise WorldHalt(fault)
        if kind == "ok":
            value = result["value"] if isinstance(result, dict) else getattr(result, "value", None)
            return value
        return None
    _fn.__name__ = name
    _fn.__qualname__ = name
    return _fn

def _print(*args, **kwargs):
    return None

def run_student(code, allowed):
    global _pending_line
    _pending_line = None
    safe_builtins = {
        "range": range,
        "len": len,
        "int": int,
        "str": str,
        "bool": bool,
        "list": list,
        "dict": dict,
        "abs": abs,
        "min": min,
        "max": max,
        "print": _print,
        "True": True,
        "False": False,
        "None": None,
    }
    ns = {"__builtins__": safe_builtins}
    for name in allowed:
        ns[name] = _make_api(name)
    compiled = compile(code, "${STUDENT_FILENAME}", "exec")
    sys.settrace(_tracer)
    try:
        exec(compiled, ns, ns)
        if _pending_line is not None:
            emit_vars(
                _pending_line,
                {
                    k: v
                    for k, v in ns.items()
                    if k != "__builtins__" and not callable(v) and not isinstance(v, type)
                },
            )
            _pending_line = None
        return {
            "ok": True,
            "locals": {
                k: v
                for k, v in ns.items()
                if k != "__builtins__" and not callable(v) and not isinstance(v, type)
            },
        }
    except WorldHalt as halt:
        return {"ok": False, "halt": halt.reason, "locals": None}
    except TraceLimit:
        return {"ok": False, "trace_limit": True, "locals": None}
    except Cancelled:
        return {"ok": False, "cancelled": True, "locals": None}
    finally:
        sys.settrace(None)
`;

async function ensureBootstrap(pyodide: PyodideLike): Promise<void> {
  if (bootstrapped.has(pyodide)) return;

  const session: BridgeSession = {
    setLine() {},
    emitVars() {},
    callApi: () => ({ kind: "cancel" }),
    shouldCancel: () => false,
  };
  bridgeSessions.set(pyodide, session);

  pyodide.registerJsModule("lantern_bridge", {
    set_line(line: number) {
      bridgeSessions.get(pyodide)?.setLine(line);
    },
    emit_vars(line: number, raw: Record<string, unknown>) {
      const plain =
        raw &&
        typeof raw === "object" &&
        typeof (raw as { toJs?: (opts?: object) => unknown }).toJs === "function"
          ? ((raw as { toJs: (opts?: object) => unknown }).toJs({
              dict_converter: Object.fromEntries,
            }) as Record<string, unknown>)
          : raw;
      bridgeSessions.get(pyodide)?.emitVars(line, plain);
    },
    call_api(name: string, args: unknown[]) {
      const list =
        args &&
        typeof args === "object" &&
        typeof (args as unknown as { toJs?: () => unknown }).toJs === "function"
          ? ((args as unknown as { toJs: () => unknown }).toJs() as unknown[])
          : args;
      return (
        bridgeSessions.get(pyodide)?.callApi(name, list ?? []) ?? {
          kind: "cancel" as const,
        }
      );
    },
    should_cancel() {
      return bridgeSessions.get(pyodide)?.shouldCancel() ?? false;
    },
  });

  await pyodide.runPythonAsync(BOOTSTRAP_PYTHON);
  bootstrapped.add(pyodide);
}

function asRobot(level: Phase1Level & { mode: "robot" }): SimRobotLevel {
  return level;
}

function asAdventure(level: Phase1Level & { mode: "adventure" }): SimAdventureLevel {
  return level;
}

function bridgeFor(level: Phase1Level): WorldBridge {
  if (level.mode === "robot") {
    return { mode: "robot", world: robotWorld, level: asRobot(level) };
  }
  return { mode: "adventure", world: adventureWorld, level: asAdventure(level) };
}

function apiDocs(level: Phase1Level): readonly ApiFunctionDescriptor[] {
  const bridge = bridgeFor(level);
  return bridge.world.api.filter((entry) =>
    (level.apiAllow as readonly string[]).includes(entry.name),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function convertPyValue(value: unknown, depth: number): Json | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) return undefined;
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 200) return undefined;
    return value;
  }
  if (typeof value === "function") return undefined;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : undefined;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) return undefined;
    if (value.length > 20) return undefined;
    const items: Json[] = [];
    for (const entry of value) {
      const converted = convertPyValue(entry, depth + 1);
      if (converted === undefined) return undefined;
      items.push(converted);
    }
    return items;
  }

  if (isPlainObject(value)) {
    if (depth >= 2) return undefined;
    const keys = Object.keys(value);
    if (keys.length > 20) return undefined;
    const out: Record<string, Json> = {};
    for (const key of keys) {
      const converted = convertPyValue(value[key], depth + 1);
      if (converted === undefined) continue;
      out[key] = converted;
    }
    return out;
  }

  return undefined;
}

function snapshotFromObject(raw: Record<string, unknown>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    if (key.startsWith("__") && key.endsWith("__")) continue;
    const converted = convertPyValue(value, 0);
    if (converted === undefined) continue;
    out[key] = converted;
  }
  return out;
}

function sameVars(
  left: Record<string, Json>,
  right: Record<string, Json>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pythonErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const record = error as { type?: string; name?: string; message?: string };
    if (typeof record.type === "string" && record.type.length > 0) {
      return record.type;
    }
    if (typeof record.name === "string" && record.name.length > 0) {
      return record.name;
    }
    if (typeof record.message === "string") {
      const match = /^(SyntaxError|IndentationError|NameError|TypeError|RuntimeError)\b/.exec(
        record.message,
      );
      if (match) return match[1];
    }
  }
  if (error instanceof Error) {
    const match = /^(SyntaxError|IndentationError|NameError|TypeError|RuntimeError)\b/.exec(
      error.message,
    );
    if (match) return match[1];
    return error.name || "RuntimeError";
  }
  return "RuntimeError";
}

function pythonErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as { message?: string };
    if (typeof record.message === "string") return record.message;
  }
  return String(error);
}

function pythonErrorLine(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const record = error as { lineno?: number; line?: number };
    if (typeof record.lineno === "number") return record.lineno;
    if (typeof record.line === "number") return record.line;
  }
  const message = pythonErrorMessage(error);
  const match = /line (\d+)/i.exec(message);
  if (match) return Number(match[1]);
  return null;
}

export async function loadPyodideRuntime(
  indexURL: string,
): Promise<PyodideLike> {
  const mod = (await import("pyodide")) as unknown as {
    loadPyodide: (options: { indexURL: string }) => Promise<{
      runPython: (code: string) => unknown;
      runPythonAsync: (code: string) => Promise<unknown>;
      globals: { get: (name: string) => unknown; set: (name: string, value: unknown) => void };
      registerJsModule: (name: string, module: Record<string, unknown>) => void;
      toPy: (value: unknown) => unknown;
    }>;
  };
  return mod.loadPyodide({ indexURL });
}

/**
 * Runs student Python against a WorldType through an already-loaded Pyodide.
 * Used by the worker and by Node Vitest. Does not import React or touch the DOM.
 */
export async function executeStudentRun(options: {
  pyodide: PyodideLike;
  code: string;
  level: Phase1Level;
  shouldCancel?: () => boolean;
  onChunk?: (events: TraceEvent[]) => void;
}): Promise<StudentRunResult> {
  const parsed = phase1LevelSchema.safeParse(options.level);
  if (!parsed.success) {
    return {
      kind: "error",
      events: [],
      line: null,
      errorName: "RuntimeError",
      errorMessage: "Invalid level payload.",
    };
  }
  const level = parsed.data;
  const bridge = bridgeFor(level);
  let state: WorldState = bridge.world.createInitialState(
    bridge.level as never,
  );
  const events: TraceEvent[] = [];
  let pending: TraceEvent[] = [];
  let currentLine: number | null = 1;
  let lastVars: Record<string, Json> | null = null;
  let finished = false;
  let cancelled = false;
  const shouldCancel = options.shouldCancel ?? (() => false);

  const flush = (force = false) => {
    if (pending.length === 0) return;
    if (!force && pending.length < TRACE_CHUNK_SIZE) return;
    options.onChunk?.(pending);
    pending = [];
  };

  const pushEvent = (event: TraceEvent): ApiOutcome | null => {
    events.push(event);
    pending.push(event);
    if (events.length >= TRACE_EVENT_CAP) {
      if (event.kind !== "stop") {
        const stop: TraceEvent = {
          kind: "stop",
          index: events.length,
          line: currentLine,
          reason: "trace_limit",
        };
        events.push(stop);
        pending.push(stop);
      }
      flush(true);
      finished = true;
      return { kind: "trace_limit" };
    }
    flush(false);
    return null;
  };

  const emitVars = (line: number, raw: Record<string, unknown>) => {
    const variables = snapshotFromObject(raw);
    if (lastVars !== null && sameVars(lastVars, variables)) return;
    lastVars = variables;
    pushEvent({
      kind: "vars",
      index: events.length,
      line,
      variables,
    });
  };

  const ensureFinalVars = (raw: Record<string, unknown> | null) => {
    if (raw) {
      emitVars(currentLine ?? 1, raw);
      return;
    }
    if (lastVars === null) {
      pushEvent({
        kind: "vars",
        index: events.length,
        line: currentLine ?? 1,
        variables: {},
      });
    }
  };

  const callApi = (name: string, args: unknown[]): ApiOutcome => {
    if (finished) return { kind: "trace_limit" };
    if (shouldCancel()) {
      cancelled = true;
      return { kind: "cancel" };
    }

    const descriptor = apiDocs(level).find((entry) => entry.name === name);
    if (!descriptor) {
      const halt = pushEvent({
        kind: "action",
        index: events.length,
        line: currentLine ?? 1,
        name,
        args: [],
      });
      if (halt) return halt;
      const stopHalt = pushEvent({
        kind: "stop",
        index: events.length,
        line: currentLine,
        reason: "error",
        errorName: "NameError",
        errorMessage: `name '${name}' is not available`,
      });
      finished = true;
      return stopHalt ?? { kind: "halt", fault: "unknown_api" };
    }

    const jsonArgs = (Array.isArray(args) ? args : []).map(
      (arg) => convertPyValue(arg, 0) ?? null,
    );

    if (!descriptor.mutates) {
      const value = bridge.world.readSensor(state, name, jsonArgs);
      const limit = pushEvent({
        kind: "sensor",
        index: events.length,
        line: currentLine ?? 1,
        name,
        args: jsonArgs,
        value,
      });
      if (limit) return limit;
      return { kind: "ok", value };
    }

    const result = bridge.world.applyAction(state, name, jsonArgs);
    state = result.state;
    const limit = pushEvent({
      kind: "action",
      index: events.length,
      line: currentLine ?? 1,
      name,
      args: jsonArgs,
    });
    if (limit) return limit;

    if (!result.ok && result.fault) {
      const reason =
        result.fault === "unknown_api" ? "error" : result.fault;
      pushEvent({
        kind: "stop",
        index: events.length,
        line: currentLine,
        reason,
        ...(result.fault === "unknown_api"
          ? {
              errorName: "NameError" as const,
              errorMessage: `name '${name}' is not available`,
            }
          : {}),
      });
      finished = true;
      flush(true);
      return { kind: "halt", fault: result.fault };
    }

    return { kind: "ok", value: null };
  };

  await ensureBootstrap(options.pyodide);
  bridgeSessions.set(options.pyodide, {
    setLine: (line) => {
      currentLine = line;
    },
    emitVars,
    callApi,
    shouldCancel,
  });

  const allowedNames = apiDocs(level).map((entry) => entry.name);
  const runStudent = options.pyodide.globals.get("run_student") as (
    code: string,
    allowed: string[],
  ) => unknown;

  try {
    const rawResult = runStudent(options.code, allowedNames);
    const result = normalizeRunResult(rawResult);

    if (result.cancelled || cancelled) {
      flush(true);
      return { kind: "cancelled", events };
    }

    if (result.trace_limit || finished) {
      flush(true);
      return { kind: "final", events };
    }

    if (result.halt) {
      // Fault stop already recorded inside callApi.
      flush(true);
      return { kind: "final", events };
    }

    if (result.locals) {
      ensureFinalVars(result.locals);
    } else {
      ensureFinalVars(null);
    }

    if (!finished) {
      pushEvent({
        kind: "stop",
        index: events.length,
        line: currentLine,
        reason: "done",
      });
      finished = true;
    }
    flush(true);
    return { kind: "final", events };
  } catch (error) {
    const errorName = pythonErrorName(error);
    const errorMessage = pythonErrorMessage(error);
    const line = pythonErrorLine(error) ?? currentLine;
    flush(true);
    return {
      kind: "error",
      events,
      line,
      errorName,
      errorMessage,
    };
  }
}

function normalizeRunResult(raw: unknown): {
  ok: boolean;
  halt?: string;
  trace_limit?: boolean;
  cancelled?: boolean;
  locals?: Record<string, unknown> | null;
} {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    // PyProxy support
    const toJs = (record as { toJs?: (opts?: object) => unknown }).toJs;
    const plain = typeof toJs === "function"
      ? (toJs.call(record, { dict_converter: Object.fromEntries }) as Record<
          string,
          unknown
        >)
      : record;
    return {
      ok: Boolean(plain.ok),
      halt: typeof plain.halt === "string" ? plain.halt : undefined,
      trace_limit: Boolean(plain.trace_limit),
      cancelled: Boolean(plain.cancelled),
      locals:
        plain.locals && typeof plain.locals === "object"
          ? (plain.locals as Record<string, unknown>)
          : null,
    };
  }
  return { ok: false };
}

export type WorkerRuntime = {
  handleRequest: (request: import("./protocol").WorkerRequest) => Promise<void>;
};

/**
 * Worker-side orchestration: lazy-load Pyodide, post ready, run, chunk traces.
 */
export function createWorkerRuntime(options: {
  post: (message: WorkerResponse) => void;
  indexURL?: string;
  load?: (indexURL: string) => Promise<PyodideLike>;
}): WorkerRuntime {
  const indexURL = options.indexURL ?? "/pyodide/";
  const load = options.load ?? loadPyodideRuntime;
  let pyodidePromise: Promise<PyodideLike> | null = null;
  let readyPosted = false;
  let activeRunId: string | null = null;
  let cancelRunId: string | null = null;

  const ensurePyodide = async () => {
    if (!pyodidePromise) {
      pyodidePromise = load(indexURL).then((pyodide) => {
        if (!readyPosted) {
          readyPosted = true;
          options.post({ type: "ready" });
        }
        return pyodide;
      });
    }
    return pyodidePromise;
  };

  return {
    async handleRequest(request) {
      if (request.type === "cancel") {
        cancelRunId = request.runId;
        return;
      }

      if (request.type !== "run") return;
      activeRunId = request.runId;
      cancelRunId = null;

      let pyodide: PyodideLike;
      try {
        pyodide = await ensurePyodide();
      } catch (error) {
        options.post({
          type: "error",
          runId: request.runId,
          line: null,
          errorName: "RuntimeError",
          errorMessage: pythonErrorMessage(error),
          events: [],
        });
        return;
      }

      if (cancelRunId === request.runId) {
        options.post({ type: "cancelled", runId: request.runId });
        return;
      }

      let sent = 0;
      const result = await executeStudentRun({
        pyodide,
        code: request.code,
        level: request.level,
        shouldCancel: () => cancelRunId === request.runId,
        onChunk: (events) => {
          if (activeRunId !== request.runId) return;
          sent += events.length;
          options.post({
            type: "trace-chunk",
            runId: request.runId,
            events,
          });
        },
      });

      if (activeRunId !== request.runId) return;

      if (result.kind === "cancelled" || cancelRunId === request.runId) {
        options.post({ type: "cancelled", runId: request.runId });
        return;
      }

      const unsent = result.events.slice(sent);

      if (result.kind === "error") {
        options.post({
          type: "error",
          runId: request.runId,
          line: result.line,
          errorName: result.errorName,
          errorMessage: result.errorMessage,
          events: unsent,
        });
        return;
      }

      options.post({
        type: "trace-final",
        runId: request.runId,
        events: unsent,
        total: result.events.length,
      });
    },
  };
}
