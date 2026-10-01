export type TranslatorInput =
  | {
      kind: "python-error";
      errorName: string;
      line: number | null;
    }
  | {
      kind: "stop";
      reason: string;
      line: number | null;
    }
  | {
      kind: "finished-not-won";
      line: number | null;
    };

export type TranslatorResult = {
  sentence: string;
  line: number | null;
};

const PYTHON_SENTENCES: Record<string, string> = {
  SyntaxError: "This line has a problem Python cannot read.",
  IndentationError: "This line does not line up with the block it belongs to.",
  NameError: "That name is not available on this level.",
  TypeError: "That value cannot be used that way.",
};

const STOP_SENTENCES: Record<string, string> = {
  wall: "The next tile is blocked.",
  hazard: "That tile is dangerous.",
  move_cap: "This level limits how many moves the program can use.",
  empty_pick: "There is nothing here to pick up.",
  bad_put: "There is nothing held to put down.",
  timeout: "This run kept going. A loop may never be finishing.",
  trace_limit: "This run kept going. A loop may never be finishing.",
};

/**
 * Maps a terminal stop or Python error to one sentence plus the line.
 */
export function translateError(input: TranslatorInput): TranslatorResult {
  if (input.kind === "python-error") {
    const sentence =
      PYTHON_SENTENCES[input.errorName] ??
      "That value cannot be used that way.";
    return { sentence, line: input.line };
  }

  if (input.kind === "finished-not-won") {
    return {
      sentence: "The program finished before the goal was done.",
      line: input.line,
    };
  }

  const sentence =
    STOP_SENTENCES[input.reason] ??
    "The program finished before the goal was done.";
  return { sentence, line: input.line };
}
