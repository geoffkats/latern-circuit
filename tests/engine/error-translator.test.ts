import { describe, expect, it } from "vitest";
import { translateError } from "@/lib/engine/error-translator";

describe("error translator", () => {
  it.each([
    {
      name: "SyntaxError",
      input: {
        kind: "python-error" as const,
        errorName: "SyntaxError",
        line: 2,
      },
      sentence: "This line has a problem Python cannot read.",
      line: 2,
    },
    {
      name: "IndentationError",
      input: {
        kind: "python-error" as const,
        errorName: "IndentationError",
        line: 3,
      },
      sentence: "This line does not line up with the block it belongs to.",
      line: 3,
    },
    {
      name: "NameError",
      input: {
        kind: "python-error" as const,
        errorName: "NameError",
        line: 4,
      },
      sentence: "That name is not available on this level.",
      line: 4,
    },
    {
      name: "TypeError",
      input: {
        kind: "python-error" as const,
        errorName: "TypeError",
        line: 5,
      },
      sentence: "That value cannot be used that way.",
      line: 5,
    },
    {
      name: "wall",
      input: { kind: "stop" as const, reason: "wall", line: 1 },
      sentence: "The next tile is blocked.",
      line: 1,
    },
    {
      name: "hazard",
      input: { kind: "stop" as const, reason: "hazard", line: 6 },
      sentence: "That tile is dangerous.",
      line: 6,
    },
    {
      name: "move_cap",
      input: { kind: "stop" as const, reason: "move_cap", line: 7 },
      sentence: "This level limits how many moves the program can use.",
      line: 7,
    },
    {
      name: "empty_pick",
      input: { kind: "stop" as const, reason: "empty_pick", line: 8 },
      sentence: "There is nothing here to pick up.",
      line: 8,
    },
    {
      name: "bad_put",
      input: { kind: "stop" as const, reason: "bad_put", line: 9 },
      sentence: "There is nothing held to put down.",
      line: 9,
    },
    {
      name: "timeout",
      input: { kind: "stop" as const, reason: "timeout", line: null },
      sentence: "This run kept going. A loop may never be finishing.",
      line: null,
    },
    {
      name: "trace_limit",
      input: { kind: "stop" as const, reason: "trace_limit", line: 10 },
      sentence: "This run kept going. A loop may never be finishing.",
      line: 10,
    },
    {
      name: "finished but not won",
      input: { kind: "finished-not-won" as const, line: 11 },
      sentence: "The program finished before the goal was done.",
      line: 11,
    },
  ])("maps $name", ({ input, sentence, line }) => {
    expect(translateError(input)).toEqual({ sentence, line });
  });
});
