import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { CaromState, PaddleState } from "./game";
import { clamp, parkedBall, startMatch, title } from "./world";
import { items, menuItemRect } from "./menu";
import { fly } from "./physics";

function confirm(s: CaromState): CaromState {
  const i = s.menuIndex;
  switch (s.screen) {
    case "title": {
      const selected = { ...s, titleIndex: i };
      return i === 2
        ? { ...selected, screen: "howto", menuIndex: 0 }
        : startMatch(selected, i === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return i === 0
        ? { ...s, screen: s.resumeScreen }
        : i === 1
          ? startMatch(s, s.mode)
          : title(s);
    case "matchover":
      return i === 0 ? startMatch(s, s.mode) : title(s);
    default:
      return s;
  }
}
function integrate(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
function movePaddles(
  s: CaromState,
  held: Record<C.ActionName, boolean>,
  dt: number,
): CaromState {
  const solo = s.mode === "solo";
  const up = held["p1-up"] || (solo && held["p2-up"]),
    down = held["p1-down"] || (solo && held["p2-down"]);
  let rightVy =
    (Number(held["p2-down"]) - Number(held["p2-up"])) * C.PADDLE_SPEED;
  if (solo) {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  const l = s.paddles.left,
    r = s.paddles.right;
  return {
    ...s,
    paddles: {
      left: integrate(
        l,
        l.driven ? l.drivenVy : (Number(down) - Number(up)) * C.PADDLE_SPEED,
        dt,
      ),
      right: integrate(r, r.driven ? r.drivenVy : rightVy, dt),
    },
  };
}

export function update(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState {
  const edges = {} as Record<C.ActionName, boolean>,
    held = {} as Record<C.ActionName, boolean>;
  for (const name of C.ACTIONS) {
    edges[name] = api.input.pressed(name);
    held[name] = api.input.value(name) > 0;
  }
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  api.audio.setMuted(edges.mute ? !state.muted : state.muted);
  let s: CaromState = {
    ...state,
    simTime: state.simTime + dt,
    muted: api.audio.muted(),
  };
  const screen = s.screen;
  if ((screen === "playing" || screen === "countdown") && edges.pause)
    s = { ...s, resumeScreen: screen, screen: "paused", menuIndex: 0 };
  else if (screen === "paused" && (edges.pause || edges.back))
    s = { ...s, screen: s.resumeScreen };
  else if ((screen === "howto" || screen === "matchover") && edges.back)
    s = title(s);
  else if (items(s).length > 0) {
    const count = items(s).length;
    const up = edges["p1-up"] || edges["p2-up"],
      down = edges["p1-down"] || edges["p2-down"];
    const keyboardConfirm = !up && !down && edges.confirm;
    if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
    else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
    const keyboardItem = s.menuIndex;
    const hit = (x: number, y: number): number => {
      for (let i = 0; i < count; i++) {
        const r = menuItemRect(s, i);
        if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
          return i;
      }
      return -1;
    };
    const presses = { ...s.menuPresses };
    let pointerConfirm = false;
    for (const p of samples) {
      const i = hit(p.x, p.y);
      if (i >= 0) s = { ...s, menuIndex: i };
      if (p.type === "down") presses[p.id] = i;
      if (p.type === "up") {
        if (i >= 0 && presses[p.id] === i) pointerConfirm = true;
        delete presses[p.id];
      }
    }
    for (const p of contacts) {
      const i = hit(p.x, p.y);
      if (i >= 0) s = { ...s, menuIndex: i };
    }
    s = { ...s, menuPresses: presses };
    if (keyboardConfirm) s = confirm({ ...s, menuIndex: keyboardItem });
    else if (pointerConfirm) s = confirm(s);
  }
  if (s.screen !== screen) s = { ...s, menuPresses: {} };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = movePaddles(s, held, dt);
  if (!s.ball) return s;
  let b = s.ball;
  const cues = new Set<C.CueName>();
  if (s.screen === "countdown") {
    const holdTimer = Math.max(0, b.holdTimer - dt);
    b = { ...b, holdTimer };
    if (holdTimer <= 0) {
      b = {
        ...b,
        held: false,
        trail: [],
        vx:
          (s.receiver === "left" ? -1 : 1) *
          C.SERVE_SPEED *
          Math.cos(C.SERVE_ANGLE),
        vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
      };
      s = { ...s, screen: "playing" };
    }
  } else if (!b.held) b = fly(s, b, dt, cues);
  b = {
    ...b,
    trail: [
      ...b.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
      { x: b.x, y: b.y, t: s.simTime },
    ],
  };
  s = { ...s, ball: b };
  if (
    s.screen === "playing" &&
    (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
  ) {
    const left = b.x > C.FIELD_W;
    const score = {
      p1: s.score.p1 + Number(left),
      p2: s.score.p2 + Number(!left),
    };
    cues.add(C.CUES.score);
    if (
      (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
      (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD)
    )
      s = {
        ...s,
        score,
        winner: left ? "left" : "right",
        screen: "matchover",
        menuIndex: 0,
      };
    else
      s = {
        ...s,
        score,
        receiver: left ? "right" : "left",
        screen: "countdown",
        ball: parkedBall(),
      };
  }
  for (const cue of cues) api.audio.play(cue);
  return s;
}
