import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CaromState } from "./game";
import * as C from "./constants";
import { fly } from "./physics";
import { initialState, parkedBall } from "./world";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
});
async function setup(ms = 10) {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  cleanup.push(() => engine.destroy());
  const key = (code: string, down = true) =>
    target.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const press = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (type: string, x: number, y: number, device = "mouse") =>
    target.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  const pose = (f: (s: CaromState) => CaromState) => engine.apply(f);
  const live = (x = 640, y = 360, vx = 500, vy = 0) =>
    pose((s) => ({
      ...s,
      screen: "playing",
      ball: { ...parkedBall(), x, y, vx, vy, held: false },
    }));
  return { engine, key, press, pointer, pose, live, d: engine.debug };
}

describe("screens and controls through the engine", () => {
  it("initializes the complete world and registers readable diagnostics", async () => {
    const { engine, d } = await setup();
    const s = d.snapshot(engine.state);
    expect(s.screen).toBe("title");
    expect(s.ball?.speed).toBe(0);
    expect(s.obstacles).toHaveLength(2);
    expect(engine.diagnostics().every((r) => r.error === undefined)).toBe(true);
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(14);
    await engine.advance(1);
    expect(engine.state.simTime).toBe(0.01);
  });
  it("wraps navigation, remembers title choice, and returns from instructions", async () => {
    const { engine, press } = await setup();
    await press("KeyW");
    expect(engine.state.menuIndex).toBe(2);
    await press("Enter");
    expect(engine.state.screen).toBe("howto");
    await press("Escape");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    await press("KeyS");
    expect(engine.state.menuIndex).toBe(0);
  });
  it("applies movement before confirm and up before down", async () => {
    const { engine, key } = await setup();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
  });
  it("serves on the expiry frame without moving the ball", async () => {
    const { engine, press, pose, d } = await setup(10);
    await press("Enter");
    pose((s) => d.setBallServeSign(d.setBallHoldTimer(s, 0.01), -1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vx).toBeLessThan(0);
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(C.SERVE_SPEED);
    await engine.advance(1);
    expect(engine.state.ball?.x).toBeLessThan(C.FIELD_CX);
  });
  it("freezes the match with Escape and resumes only once", async () => {
    const { engine, press } = await setup();
    await press("Enter");
    await press("Escape");
    expect(engine.state.screen).toBe("paused");
    const b = engine.state.ball;
    const t = engine.state.simTime;
    await engine.advance(3);
    expect(engine.state.ball).toEqual(b);
    expect(engine.state.simTime).toBeGreaterThan(t);
    await press("Escape");
    expect(engine.state.screen).toBe("countdown");
  });
  it("restarts and quits through pause, preserving title selection", async () => {
    const { engine, press, pose, d } = await setup();
    await press("KeyS");
    await press("Enter");
    expect(engine.state.mode).toBe("versus");
    pose((s) => d.setScore(s, 7, 9));
    await press("KeyP");
    await press("KeyS");
    await press("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    await press("KeyP");
    await press("KeyW");
    await press("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("supports pointer press and release across frames, and rejects mismatches", async () => {
    const { engine, pointer } = await setup();
    pointer("down", 140, 385);
    await engine.advance(1);
    pointer("up", 140, 450);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    pointer("down", 140, 450);
    await engine.advance(1);
    pointer("up", 140, 450);
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.mode).toBe("versus");
  });
  it("accepts same-frame touch confirmation", async () => {
    const { engine, pointer } = await setup();
    pointer("down", 140, 515, "touch");
    pointer("up", 140, 515, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
  });
  it("uses arrows for the human in Solo and separates controls in Versus", async () => {
    const { engine, key, live, pose, d } = await setup();
    live();
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.01,
    );
    pose((s) => d.setMode(s, "versus"));
    const y = engine.state.paddles.left.cy;
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBe(y);
    expect(engine.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
  });
  it("clamps driven paddles and reports actual velocity, without losing driver velocity", async () => {
    const { engine, live, pose, d } = await setup();
    live();
    pose((s) =>
      d.setPaddleDriven(
        d.setPaddleVy(
          d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2),
          "left",
          C.PADDLE_SPEED,
        ),
        "left",
        true,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(engine.state.paddles.left.vy).toBeCloseTo(200);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
  });
  it("gates the AI senses and movement independently", async () => {
    const { engine, live, pose, d } = await setup();
    live(900, 600, 500, 0);
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s) =>
      d.setAiTracking(
        d.setAiMovement(d.setPaddleCy(s, "right", 500), true),
        false,
      ),
    );
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
});

describe("physics, scoring and audio", () => {
  it("adds spin and speed at a moving paddle, and preserves the previous state", async () => {
    const { engine, live, pose, d } = await setup();
    live(C.P1_X1 + C.BALL_R + 2, C.FIELD_CY, -500, 0);
    pose((s) => d.setPaddleDriven(d.setPaddleVy(s, "left", 200), "left", true));
    const before = engine.state;
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBeGreaterThan(0);
    expect(d.snapshot(engine.state).ball?.speed).toBeCloseTo(520);
    expect(engine.state.ball?.spin).toBeGreaterThan(160);
    expect(before.ball?.vx).toBe(-500);
    expect(cues).toEqual([C.CUES.paddleHit]);
  });
  it("reflects end caps without adding speed or spin", async () => {
    const { engine, live, d } = await setup();
    live(
      (C.P1_X0 + C.P1_X1) / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      500,
    );
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBe(-500);
    expect(d.snapshot(engine.state).ball?.speed).toBe(500);
    expect(engine.state.ball?.spin).toBe(0);
  });
  it("reflects walls and obstacles and emits distinct cues", async () => {
    const { engine, live } = await setup();
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    live(300, C.BALL_R + 1, 0, -500);
    await engine.advance(1);
    expect(engine.state.ball?.vy).toBe(500);
    live(C.OBSTACLES[0].x0 - C.BALL_R - 1, C.OBSTACLE_CENTERS[0].y, 500, 0);
    await engine.advance(1);
    expect(engine.state.ball?.vx).toBe(-500);
    expect(cues).toEqual([C.CUES.wallBounce, C.CUES.obstacleBounce]);
  });
  it("caps paddle speed, rotates flight, and decays spin", () => {
    const s = initialState();
    const cues = new Set<C.CueName>();
    const hit = fly(
      s,
      {
        ...parkedBall(),
        held: false,
        x: 76,
        y: C.FIELD_CY,
        vx: -C.SPEED_CAP,
        vy: 0,
      },
      0.01,
      cues,
    );
    expect(Math.hypot(hit.vx, hit.vy)).toBeCloseTo(C.SPEED_CAP);
    const b = fly(
      { ...s, obstacles: [] },
      { ...parkedBall(), held: false, vx: 200, vy: 0, spin: 100 },
      C.SPIN_HALFLIFE,
      new Set(),
    );
    expect(b.spin).toBeCloseTo(50);
    expect(b.vy).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(200);
  });
  it("parks after points and ends only with a two-point lead", async () => {
    const { engine, live, pose, d, press } = await setup();
    pose((s) => d.setScore(s, 10, 10));
    live(C.FIELD_W + C.BALL_R + 1, 300, 500, 0);
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball?.trail).toEqual([]);
    live(C.FIELD_W + C.BALL_R + 1, 300, 500, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    await press("Enter");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.score.p1).toBe(0);
  });
  it("scores for the right side, including match victory", async () => {
    const { engine, live, pose, d, press } = await setup();
    pose((s) => d.setScore(s, 2, 10));
    live(-C.BALL_R - 1, 300, -500, 0);
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
    await press("Escape");
    expect(engine.state.screen).toBe("title");
  });
  it("emits muted cues and keeps the mute pose and keyboard in agreement", async () => {
    const { engine, pose, d, live, press } = await setup();
    pose((s) => d.setMuted(s, true));
    const gains: number[] = [];
    engine.events.on("cue:played", (e) => gains.push(e.gain));
    live(300, 12, 0, -500);
    await engine.advance(1);
    expect(gains).toEqual([0]);
    expect(engine.state.muted).toBe(true);
    await press("KeyM");
    expect(engine.state.muted).toBe(false);
  });
  it("bounds the trail by elapsed time", async () => {
    const { engine, live } = await setup();
    live(300, 360, 400, 0);
    await engine.advance(20);
    const trail = engine.state.ball!.trail;
    expect(trail.length).toBeGreaterThan(10);
    expect(trail.every((p) => engine.state.simTime - p.t <= C.TRAIL_TIME)).toBe(
      true,
    );
  });
  it("agrees across small and large frame intervals", () => {
    const s = { ...initialState(), obstacles: [] };
    let a = { ...parkedBall(), held: false, vx: 520, vy: -100, spin: 280 };
    let b = { ...a };
    const ca = new Set<C.CueName>(),
      cb = new Set<C.CueName>();
    for (let i = 0; i < 400; i++) a = fly(s, a, 0.002, ca);
    for (let i = 0; i < 50; i++) b = fly(s, b, 0.016, cb);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(Math.hypot(b.vx, b.vy));
    expect(Math.abs(a.vy - b.vy)).toBeLessThan(2);
    expect(ca).toEqual(cb);
  });
});

describe("automation surface", () => {
  it("poses every field, snapshots by value, and reconciles without advancement", async () => {
    const { engine, pose, d } = await setup();
    pose((s) =>
      d.setScreen(
        d.setMode(
          d.setTitleIndex(
            d.setMenuIndex(d.setResumeScreen(s, "countdown"), 1),
            2,
          ),
          "versus",
        ),
        "paused",
      ),
    );
    pose((s) =>
      d.setWinner(d.setReceiver(d.setScore(s, 5, 8), "right"), "right"),
    );
    pose((s) =>
      d.setBallSpin(
        d.setBallVelocity(d.setBallPosition(s, 123, 234), 300, 400),
        67,
      ),
    );
    pose((s) =>
      d.setBallServeSign(d.setBallHoldTimer(d.setBallHeld(s, false), 0.3), 1),
    );
    const snap = d.snapshot(engine.state);
    expect(snap.ball?.speed).toBe(500);
    expect(snap.ball?.spin).toBe(67);
    expect(snap.titleIndex).toBe(2);
    pose(d.reconcile);
    expect(d.snapshot(engine.state)).toEqual(snap);
    expect(d.menuItemRect(engine.state, 10)).toBeNull();
    pose(d.drawBallServeSign);
    expect([-1, 1]).toContain(engine.state.ball?.serveSign);
    pose(d.reset);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.simTime).toBe(0);
  });
  it("supports an empty world and refuses poses of an absent entity", async () => {
    const { engine, pose, d } = await setup();
    pose(d.clearWorld);
    pose((s) => d.setScreen(s, "playing"));
    await engine.advance(2);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    expect(() => pose((s) => d.setBallSpin(s, 3))).toThrow("No ball");
    expect(() => pose((s) => d.spawnObstacle(s, 2))).toThrow();
    pose((s) => d.spawnObstacle(s, 1));
    pose((s) => d.spawnObstacle(s, 0));
    pose(d.spawnBall);
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
  });
});
