import "./stage.css";
import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { initialState } from "./world";
import { debug } from "./debug";
import { update } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

export interface CaromState {
  /** Pending menu contacts, derived from the engine input samples. */
  readonly menuPresses?: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;
}

export type CaromDebugApi = typeof debug;
export const BACKGROUND = "#09191e";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    api.audio.define(C.CUES.paddleHit, {
      freq: 620,
      freqTo: 260,
      durationMs: 90,
      wave: "triangle",
      gain: 0.18,
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 240,
      freqTo: 180,
      durationMs: 55,
      gain: 0.12,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      freq: 880,
      freqTo: 510,
      durationMs: 110,
      wave: "triangle",
      gain: 0.15,
    });
    api.audio.define(C.CUES.score, {
      freq: 390,
      freqTo: 780,
      durationMs: 270,
      gain: 0.18,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("p1", (s) => s.score.p1);
    api.diagnostics.register("p2", (s) => s.score.p2);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "none");
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
    return [initialState(), debug];
  },
  update,
  render,
};
