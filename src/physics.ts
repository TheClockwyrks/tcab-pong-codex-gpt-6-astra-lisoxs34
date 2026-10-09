import * as C from "./constants";
import type { BallState, CaromState, PaddleState } from "./game";
import { clamp } from "./world";

/** Integrates a fresh ball value; contacts are collected once per rendered frame. */
export function fly(
  s: CaromState,
  original: BallState,
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b = { ...original };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  function rectangle(r: C.Rect, paddle?: PaddleState, dir = 1) {
    if (!(
      b.x > r.x0 - C.BALL_R &&
      b.x < r.x1 + C.BALL_R &&
      b.y > r.y0 - C.BALL_R &&
      b.y < r.y1 + C.BALL_R
    ))
      return;
    const depths = [
      b.x - r.x0 + C.BALL_R,
      r.x1 + C.BALL_R - b.x,
      b.y - r.y0 + C.BALL_R,
      r.y1 + C.BALL_R - b.y,
    ];
    const face = depths.indexOf(Math.min(...depths));
    if (face === 0) b.x = r.x0 - C.BALL_R;
    if (face === 1) b.x = r.x1 + C.BALL_R;
    if (face === 2) b.y = r.y0 - C.BALL_R;
    if (face === 3) b.y = r.y1 + C.BALL_R;
    if (paddle && face < 2) {
      const angle =
        clamp((b.y - paddle.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
      const speed = Math.min(
        Math.hypot(b.vx, b.vy) * C.SPEED_MULT,
        C.SPEED_CAP,
      );
      b.vx = dir * speed * Math.cos(angle);
      b.vy = speed * Math.sin(angle);
      b.spin = clamp(
        b.spin + paddle.vy * C.SPIN_FROM_PADDLE,
        -C.SPIN_CLAMP,
        C.SPIN_CLAMP,
      );
      b.x = dir === 1 ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
      cues.add(C.CUES.paddleHit);
    } else {
      const reflects =
        (face === 0 && b.vx > 0) ||
        (face === 1 && b.vx < 0) ||
        (face === 2 && b.vy > 0) ||
        (face === 3 && b.vy < 0);
      if (reflects) {
        if (face < 2) b.vx = -b.vx;
        else b.vy = -b.vy;
        cues.add(paddle ? C.CUES.wallBounce : C.CUES.obstacleBounce);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h,
        x = b.vx;
      b.vx = x * Math.cos(a) - b.vy * Math.sin(a);
      b.vy = x * Math.sin(a) + b.vy * Math.cos(a);
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    rectangle(
      {
        x0: C.P1_X0,
        x1: C.P1_X1,
        y0: s.paddles.left.cy - C.PADDLE_HALF,
        y1: s.paddles.left.cy + C.PADDLE_HALF,
      },
      s.paddles.left,
      1,
    );
    rectangle(
      {
        x0: C.P2_X0,
        x1: C.P2_X1,
        y0: s.paddles.right.cy - C.PADDLE_HALF,
        y1: s.paddles.right.cy + C.PADDLE_HALF,
      },
      s.paddles.right,
      -1,
    );
    for (const o of s.obstacles) rectangle(C.OBSTACLES[o.index]);
  }
  return b;
}
