import type { DeepReadonly } from "ts-essentials";
import type {
  BallState,
  CaromState,
  Mode,
  Screen,
  Side,
  PaddleState,
} from "./game";
import { CAROM_DEBUG_VERSION } from "./constants";
import { initialState, obstacle, parkedBall, serveSign } from "./world";
import { menuItemRect } from "./menu";
type State = DeepReadonly<CaromState>;
function ball(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddle(s: State, side: Side, patch: Partial<PaddleState>): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export const debug = {
  version: CAROM_DEBUG_VERSION,
  clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s: State): CaromState => ({ ...s, ball: parkedBall() }),
  spawnObstacle: (s: State, index: number): CaromState => ({
    ...s,
    obstacles: [
      ...s.obstacles.filter((o) => o.index !== index),
      obstacle(index),
    ].sort((a, b) => a.index - b.index),
  }),
  reset: (s: State): CaromState => initialState(s.muted),
  reconcile: (s: State): CaromState => ({ ...s }),
  setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
  setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
  setMenuIndex: (s: State, menuIndex: number): CaromState => ({
    ...s,
    menuIndex,
  }),
  setTitleIndex: (s: State, titleIndex: number): CaromState => ({
    ...s,
    titleIndex,
  }),
  setResumeScreen: (
    s: State,
    resumeScreen: "countdown" | "playing",
  ): CaromState => ({ ...s, resumeScreen }),
  setScore: (s: State, p1: number, p2: number): CaromState => ({
    ...s,
    score: { p1, p2 },
  }),
  setWinner: (s: State, winner: Side | null): CaromState => ({ ...s, winner }),
  setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
  setPaddleCy: (s: State, side: Side, cy: number) => paddle(s, side, { cy }),
  setPaddleVy: (s: State, side: Side, drivenVy: number) =>
    paddle(s, side, { drivenVy }),
  setPaddleDriven: (s: State, side: Side, driven: boolean) =>
    paddle(s, side, { driven }),
  setBallPosition: (s: State, x: number, y: number) => ball(s, { x, y }),
  setBallVelocity: (s: State, vx: number, vy: number) => ball(s, { vx, vy }),
  setBallSpin: (s: State, spin: number) => ball(s, { spin }),
  setBallHeld: (s: State, held: boolean) => ball(s, { held }),
  setBallHoldTimer: (s: State, holdTimer: number) => ball(s, { holdTimer }),
  setBallServeSign: (s: State, sign: 1 | -1) => ball(s, { serveSign: sign }),
  drawBallServeSign: (s: State) => ball(s, { serveSign: serveSign() }),
  setAiTracking: (s: State, tracking: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, tracking },
  }),
  setAiMovement: (s: State, movement: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, movement },
  }),
  setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
  snapshot: (s: State) => {
    const { menuPresses: _contacts, ...declared } = structuredClone(s);
    return {
      ...declared,
      version: CAROM_DEBUG_VERSION,
      ball: s.ball
        ? {
            ...structuredClone(s.ball),
            speed: Math.hypot(s.ball.vx, s.ball.vy),
          }
        : null,
    };
  },
  menuItemRect,
};
