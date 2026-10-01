/// <reference lib="webworker" />

import {
  createWorkerRuntime,
  loadPyodideRuntime,
} from "./python-runner";
import type { WorkerRequest, WorkerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const runtime = createWorkerRuntime({
  indexURL: "/pyodide/",
  load: loadPyodideRuntime,
  post(message: WorkerResponse) {
    self.postMessage(message);
  },
});

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void runtime.handleRequest(event.data);
};
