"use client";

import { useEffect, useRef } from "react";
import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { copy } from "@/lib/copy/en";
import type { Phase1Level } from "@/lib/levels/schema";
import type { PlayerError } from "@/lib/store/player-store";

type PythonEditorProps = {
  level: Phase1Level;
  code: string;
  onChange: (code: string) => void;
  error: PlayerError | null;
  readOnly?: boolean;
};

function apiCompletions(apiAllow: readonly string[]) {
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[A-Za-z_][\w]*/);
    if (!word && !context.explicit) return null;
    return {
      from: word ? word.from : context.pos,
      options: apiAllow.map((name) => ({
        label: name,
        type: "function",
        apply: `${name}()`,
      })),
    };
  };
}

export function PythonEditor({
  level,
  code,
  onChange,
  error,
  readOnly = false,
}: PythonEditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const errorRef = useRef(error);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    if (!parentRef.current) return;

    const errorLinter = linter(() => {
      const current = errorRef.current;
      if (!current || current.line === null) return [] as Diagnostic[];
      const doc = viewRef.current?.state.doc;
      if (!doc) return [];
      const lineNo = Math.min(Math.max(current.line, 1), doc.lines);
      const line = doc.line(lineNo);
      return [
        {
          from: line.from,
          to: line.to,
          severity: "error",
          message: current.sentence,
        } satisfies Diagnostic,
      ];
    });

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        python(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        autocompletion({ override: [apiCompletions(level.apiAllow)] }),
        lintGutter(),
        errorLinter,
        placeholder(copy.emptyEditor),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "calc(0.95rem * var(--lc-font-scale, 1))",
            border: "1px solid #d4d4d8",
            backgroundColor: "#fafafa",
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily:
              "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
          },
          ".cm-content": { padding: "12px 0", caretColor: "#171717" },
          ".cm-gutters": {
            backgroundColor: "#f4f4f5",
            color: "#71717a",
            borderRight: "1px solid #e4e4e7",
          },
        }),
        keymap.of(completionKeymap),
      ],
    });

    const view = new EditorView({ state, parent: parentRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate when the level API surface changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  useEffect(() => {
    viewRef.current?.dispatch({});
  }, [error]);

  return (
    <div
      ref={parentRef}
      className="h-full min-h-[220px] overflow-hidden rounded-md"
      aria-label="Python editor"
    />
  );
}
