"use client";

import { create } from "zustand";
import { translateError } from "@/lib/engine/error-translator";
import {
  RunController,
  type RunControllerStatus,
} from "@/lib/engine/run-controller";
import {
  exceedsMaxLines,
  findForbiddenKeywords,
} from "@/lib/levels/constraints";
import type { Phase1Level } from "@/lib/levels/schema";
import { evaluateStars, type StarCount } from "@/lib/levels/stars";
import { createLevelState, isLevelSolved, replayLevel } from "@/lib/levels/solved";
import { framesFromSteps, SPEED_MS, type SpeedId } from "@/lib/render/playback";
import type { TraceEvent, WorldState } from "@/lib/sim/types";
import { copy } from "@/lib/copy/en";

export type PlayerError = {
  sentence: string;
  line: number | null;
};

export type PlayerRunStatus =
  | "idle"
  | "loading-python"
  | "running"
  | "playing"
  | "paused"
  | "completed"
  | "error"
  | "timeout"
  | "cancelled";

type PlayerStore = {
  level: Phase1Level | null;
  code: string;
  runStatus: PlayerRunStatus;
  controllerStatus: RunControllerStatus;
  events: TraceEvent[];
  frames: WorldState[];
  cursor: number;
  playing: boolean;
  speed: SpeedId;
  hintsRevealed: number;
  currentError: PlayerError | null;
  announcement: string;
  stars: StarCount;
  bonusTechnique: boolean;
  conceptDismissed: boolean;
  fontStep: 0 | 1 | 2;
  initLevel: (level: Phase1Level) => void;
  setCode: (code: string) => void;
  setSpeed: (speed: SpeedId) => void;
  setFontStep: (step: 0 | 1 | 2) => void;
  revealHint: () => void;
  dismissConcept: () => void;
  run: () => Promise<void>;
  cancel: () => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  tickPlayback: () => void;
};

let controller: RunController | null = null;
const dismissedConcepts = new Set<string>();

function getController(): RunController {
  if (!controller) controller = new RunController();
  return controller;
}

function detectBonusTechnique(level: Phase1Level, code: string): boolean {
  const bonus = level.stars.bonusTechnique;
  if (bonus === "uses_variable") return /[A-Za-z_]\w*\s*=/.test(code);
  if (bonus === "uses_sensor") {
    return /(front_is_clear|left_is_clear|right_is_clear|item_here|facing_north|facing_east|facing_south|facing_west)/.test(
      code,
    );
  }
  return false;
}

function actorName(level: Phase1Level): string {
  return level.mode === "robot" ? "Pebble" : "Nia";
}

function announceState(level: Phase1Level, state: WorldState): string {
  return copy.actorAnnounce(
    actorName(level),
    state.actor.facing,
    state.actor.x,
    state.actor.y,
  );
}

function errorFromEvents(events: TraceEvent[]): PlayerError | null {
  const stop = [...events].reverse().find((event) => event.kind === "stop");
  if (!stop || stop.kind !== "stop") return null;
  if (stop.reason === "done") return null;
  if (stop.reason === "error") {
    return translateError({
      kind: "python-error",
      errorName: stop.errorName ?? "RuntimeError",
      line: stop.line,
    });
  }
  return translateError({
    kind: "stop",
    reason: stop.reason,
    line: stop.line,
  });
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  level: null,
  code: "",
  runStatus: "idle",
  controllerStatus: "idle",
  events: [],
  frames: [],
  cursor: 0,
  playing: false,
  speed: "normal",
  hintsRevealed: 0,
  currentError: null,
  announcement: "",
  stars: 0,
  bonusTechnique: false,
  conceptDismissed: false,
  fontStep: 1,

  initLevel(level) {
    const initial = createLevelState(level);
    set({
      level,
      code: "",
      runStatus: "idle",
      controllerStatus: "idle",
      events: [],
      frames: [initial],
      cursor: 0,
      playing: false,
      speed: "normal",
      hintsRevealed: 0,
      currentError: null,
      announcement: announceState(level, initial),
      stars: 0,
      bonusTechnique: false,
      conceptDismissed: dismissedConcepts.has(level.conceptId),
    });
  },

  setCode(code) {
    set({ code });
  },

  setSpeed(speed) {
    set({ speed });
  },

  setFontStep(fontStep) {
    set({ fontStep });
  },

  revealHint() {
    const { level, hintsRevealed } = get();
    if (!level) return;
    if (hintsRevealed >= level.hints.length) return;
    set({ hintsRevealed: hintsRevealed + 1 });
  },

  dismissConcept() {
    const { level } = get();
    if (level) dismissedConcepts.add(level.conceptId);
    set({ conceptDismissed: true });
  },

  async run() {
    const { level, code } = get();
    if (!level) return;

    if (exceedsMaxLines(code, level.constraints.maxLines)) {
      const max = level.constraints.maxLines ?? 0;
      set({
        currentError: {
          sentence: copy.constraintMaxLines(max),
          line: null,
        },
        runStatus: "error",
        playing: false,
      });
      return;
    }

    const forbidden = findForbiddenKeywords(
      code,
      level.constraints.forbiddenKeywords,
    );
    if (forbidden.length > 0) {
      set({
        currentError: {
          sentence: copy.constraintForbidden(forbidden),
          line: null,
        },
        runStatus: "error",
        playing: false,
      });
      return;
    }

    const ctrl = getController();
    set({
      runStatus: ctrl.isPythonReady() ? "running" : "loading-python",
      controllerStatus: ctrl.isPythonReady() ? "running" : "loading-python",
      currentError: null,
      playing: false,
      stars: 0,
      bonusTechnique: false,
      announcement: ctrl.isPythonReady()
        ? copy.running
        : copy.loadingPython,
    });

    const result = await ctrl.run(code, level);
    const status = ctrl.getStatus();

    if (result.status === "discarded") {
      set({
        runStatus: "error",
        controllerStatus: status,
        currentError: {
          sentence: "This run could not be trusted. Try again.",
          line: null,
        },
        announcement: "This run could not be trusted. Try again.",
      });
      return;
    }

    if (result.status === "cancelled") {
      set({
        runStatus: "cancelled",
        controllerStatus: status,
        events: result.events,
        playing: false,
        announcement: "Run cancelled.",
      });
      return;
    }

    if (result.status === "timeout") {
      const translated = translateError({
        kind: "stop",
        reason: "timeout",
        line: null,
      });
      set({
        runStatus: "timeout",
        controllerStatus: status,
        events: result.events,
        currentError: translated,
        playing: false,
        announcement: translated.sentence,
      });
      return;
    }

    if (result.status === "error") {
      const translated = translateError({
        kind: "python-error",
        errorName: result.errorName,
        line: result.line,
      });
      set({
        runStatus: "error",
        controllerStatus: status,
        events: result.events,
        currentError: translated,
        playing: false,
        announcement: translated.sentence,
      });
      return;
    }

    const events = result.events;
    const initial = createLevelState(level);
    const steps = replayLevel(level, events);
    const frames = framesFromSteps(
      initial,
      steps.map((step) => step.state),
    );
    const solved = isLevelSolved(level, events);
    const lastState = frames[frames.length - 1] ?? initial;
    const starResult = evaluateStars({
      solved,
      moves: lastState.moves,
      code,
      stars: level.stars,
      usedBonusTechnique: detectBonusTechnique(level, code),
    });
    const faultError = errorFromEvents(events);
    const finishedNotWon =
      !solved &&
      !faultError &&
      events.some((event) => event.kind === "stop" && event.reason === "done")
        ? translateError({
            kind: "finished-not-won",
            line:
              [...events].reverse().find((event) => event.kind === "stop")
                ?.line ?? null,
          })
        : null;
    const currentError = faultError ?? finishedNotWon;
    const endAnnounce = solved
      ? level.story.success
      : (currentError?.sentence ?? level.story.blocked);

    set({
      runStatus: frames.length > 1 ? "playing" : "completed",
      controllerStatus: status,
      events,
      frames,
      cursor: 0,
      playing: frames.length > 1,
      currentError,
      stars: starResult.stars,
      bonusTechnique: starResult.bonusTechnique,
      announcement: announceState(level, frames[0] ?? initial),
    });

    if (frames.length <= 1) {
      set({
        announcement: endAnnounce,
      });
    }
  },

  cancel() {
    getController().cancel();
    set({
      runStatus: "cancelled",
      playing: false,
      announcement: "Run cancelled.",
    });
  },

  play() {
    const { frames, cursor } = get();
    if (frames.length <= 1) return;
    if (cursor >= frames.length - 1) {
      set({ cursor: 0, playing: true, runStatus: "playing" });
      return;
    }
    set({ playing: true, runStatus: "playing" });
  },

  pause() {
    set({ playing: false, runStatus: "paused" });
  },

  stepForward() {
    const { level, frames, cursor } = get();
    if (!level || cursor >= frames.length - 1) {
      set({ playing: false, runStatus: "completed" });
      return;
    }
    const next = cursor + 1;
    const state = frames[next]!;
    set({
      cursor: next,
      playing: false,
      runStatus: next >= frames.length - 1 ? "completed" : "paused",
      announcement: announceState(level, state),
    });
  },

  stepBack() {
    const { level, frames, cursor } = get();
    if (!level || cursor <= 0) return;
    const next = cursor - 1;
    set({
      cursor: next,
      playing: false,
      runStatus: "paused",
      announcement: announceState(level, frames[next]!),
    });
  },

  tickPlayback() {
    const { level, playing, frames, cursor } = get();
    if (!playing || !level) return;
    if (cursor >= frames.length - 1) {
      const solved = get().stars > 0;
      set({
        playing: false,
        runStatus: "completed",
        announcement: solved ? level.story.success : (get().currentError?.sentence ?? level.story.blocked),
      });
      return;
    }
    const next = cursor + 1;
    set({
      cursor: next,
      announcement: announceState(level, frames[next]!),
      runStatus: next >= frames.length - 1 ? "completed" : "playing",
      playing: next < frames.length - 1,
    });
  },
}));

export function playbackDelayMs(speed: SpeedId): number {
  return SPEED_MS[speed];
}
