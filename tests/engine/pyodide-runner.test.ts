import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  executeStudentRun,
  loadPyodideRuntime,
  type PyodideLike,
} from "@/lib/engine/python-runner";
import { loadLevel } from "@/lib/levels/load-level";
import { isLevelSolved } from "@/lib/levels/solved";
import { finalVariables } from "@/lib/sim/replay";

const indexURL = `${path.join(process.cwd(), "node_modules", "pyodide")}/`;

describe("pyodide student runner", () => {
  let pyodide: PyodideLike;

  beforeAll(async () => {
    pyodide = await loadPyodideRuntime(indexURL);
  }, 120_000);

  it(
    "emits carried=1 vars before stop/done for cd-01-carried",
    async () => {
      const level = loadLevel("cd-01-carried");
      const result = await executeStudentRun({
        pyodide,
        level,
        code: ["move()", "carried = 0", "carried = 1"].join("\n"),
      });

      expect(result.kind).toBe("final");
      if (result.kind !== "final") return;

      const done = result.events.find(
        (event) => event.kind === "stop" && event.reason === "done",
      );
      expect(done).toBeTruthy();
      const matchingVars = result.events.filter(
        (event) =>
          event.kind === "vars" &&
          event.variables.carried === 1 &&
          done !== undefined &&
          event.index < done.index,
      );
      expect(matchingVars.length).toBeGreaterThan(0);
      expect(finalVariables(result.events)).toEqual({ carried: 1 });
      expect(isLevelSolved(level, result.events)).toBe(true);
    },
    60_000,
  );

  it(
    "records wall after move into a blocked tile",
    async () => {
      const level = loadLevel("ks-04-clear-ahead");
      const result = await executeStudentRun({
        pyodide,
        level,
        code: "move()\n",
      });

      expect(result.kind).toBe("final");
      if (result.kind !== "final") return;

      const actionIndex = result.events.findIndex(
        (event) => event.kind === "action" && event.name === "move",
      );
      expect(actionIndex).toBeGreaterThanOrEqual(0);
      const stop = result.events[actionIndex + 1];
      expect(stop).toMatchObject({
        kind: "stop",
        reason: "wall",
      });
      expect(isLevelSolved(level, result.events)).toBe(false);
    },
    60_000,
  );
});
