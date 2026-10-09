import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menu";

const INK = "#e9f4eb",
  DIM = "#779297",
  CYAN = "#5de2dc",
  CORAL = "#ff8879",
  GOLD = "#eac580";
const BG = "#09191e";
export function render(s: DeepReadonly<CaromState>, api: RenderApi): void {
  const ctx = api.ctx;
  function text(
    copy: string,
    x: number,
    y: number,
    size = 16,
    color = DIM,
    weight = 400,
    align: CanvasTextAlign = "left",
  ) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${size < 18 ? "monospace" : "Arial, sans-serif"}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(copy, x, y);
  }
  function line(
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string,
    width = 1,
  ) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function bar(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    glow = false,
  ) {
    ctx.save();
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowBlur = 22;
      ctx.shadowColor = color;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(w / 2, 8));
    ctx.fill();
    ctx.restore();
  }
  function circle(x: number, y: number, r: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function menu() {
    items(s).forEach((copy, i) => {
      const r = menuItemRect(s, i)!;
      const chosen = i === s.menuIndex;
      ctx.fillStyle = chosen ? CYAN : "#10272d";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (!chosen) {
        ctx.strokeStyle = "#244047";
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
      text(copy, r.x + 24, r.y + r.h / 2, 17, chosen ? BG : INK, 700);
      text(
        chosen ? "↗" : String(i + 1).padStart(2, "0"),
        r.x + r.w - 25,
        r.y + r.h / 2,
        19,
        chosen ? BG : DIM,
        400,
        "right",
      );
    });
  }
  function field() {
    // Quiet measurement grid beneath the high-contrast moving bodies.
    ctx.strokeStyle = "#10282e";
    ctx.lineWidth = 1;
    for (let x = 80; x < C.FIELD_W; x += 80)
      line(x, 0, x, C.FIELD_H, "#10282e");
    for (let y = 80; y < C.FIELD_H; y += 80)
      line(0, y, C.FIELD_W, y, "#10282e");
    line(0, 2, C.FIELD_W, 2, "#496067", 3);
    line(0, C.FIELD_H - 2, C.FIELD_W, C.FIELD_H - 2, "#496067", 3);
    ctx.setLineDash([7, 13]);
    line(C.NET_X, 100, C.NET_X, C.FIELD_H - 65, "#2d474d", 2);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(C.FIELD_CX, C.FIELD_CY, 70, 0, Math.PI * 2);
    ctx.strokeStyle = "#203a40";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const o of s.obstacles) {
      bar(
        o.cx - C.OBSTACLE_HW,
        o.cy - C.OBSTACLE_HH,
        C.OBSTACLE_W,
        C.OBSTACLE_H,
        GOLD,
        true,
      );
      text(o.index === 0 ? "A" : "B", o.cx + 25, o.cy, 12, "#aa9266");
    }
    bar(
      C.P1_X0,
      s.paddles.left.cy - C.PADDLE_HALF,
      C.PADDLE_W,
      C.PADDLE_H,
      CYAN,
      true,
    );
    bar(
      C.P2_X0,
      s.paddles.right.cy - C.PADDLE_HALF,
      C.PADDLE_W,
      C.PADDLE_H,
      CORAL,
      true,
    );
    if (s.ball) {
      const b = s.ball;
      b.trail.forEach((p, i) => {
        ctx.globalAlpha = ((i + 1) / b.trail.length) * 0.3;
        circle(
          p.x,
          p.y,
          C.BALL_R * (0.3 + (0.7 * (i + 1)) / b.trail.length),
          INK,
        );
      });
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = INK;
      ctx.shadowBlur = 24;
      circle(b.x, b.y, C.BALL_R, INK);
      ctx.restore();
      if (b.held) {
        ctx.beginPath();
        ctx.arc(
          b.x,
          b.y,
          24,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * b.holdTimer) / C.HOLD_TIME,
        );
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.fillStyle = BG;
    ctx.fillRect(C.FIELD_CX - 230, 14, 460, 82);
    text("PLAYER 01", C.FIELD_CX - 132, 30, 12, CYAN, 400, "center");
    text(
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
      C.FIELD_CX + 132,
      30,
      12,
      CORAL,
      400,
      "center",
    );
    text(
      String(s.score.p1).padStart(2, "0"),
      C.FIELD_CX - 132,
      69,
      47,
      INK,
      700,
      "center",
    );
    text(
      String(s.score.p2).padStart(2, "0"),
      C.FIELD_CX + 132,
      69,
      47,
      INK,
      700,
      "center",
    );
    text(
      s.mode === "solo" ? "SOLO" : "VERSUS",
      C.FIELD_CX,
      44,
      12,
      DIM,
      400,
      "center",
    );
    text(`FIRST TO ${C.WIN_SCORE}`, C.FIELD_CX, 66, 10, DIM, 400, "center");
    text(C.TITLE_TEXT, 30, 32, 19, INK, 700);
    text("W / S", 38, C.FIELD_H - 29, 12, CYAN);
    text(
      s.mode === "solo" ? "W / S OR ↑ / ↓ TO MOVE" : "↑ / ↓",
      C.FIELD_W - 38,
      C.FIELD_H - 29,
      12,
      CORAL,
      400,
      "right",
    );
    text(
      "P  PAUSE     M  " + (s.muted ? "SOUND OFF" : "SOUND ON"),
      C.FIELD_CX,
      C.FIELD_H - 27,
      12,
      DIM,
      400,
      "center",
    );
    if (s.screen === "countdown") {
      text("GET READY", C.FIELD_CX, C.FIELD_CY - 67, 16, INK, 700, "center");
      text(
        s.receiver === "left" ? "←  SERVING LEFT" : "SERVING RIGHT  →",
        C.FIELD_CX,
        C.FIELD_CY + 62,
        12,
        DIM,
        400,
        "center",
      );
    }
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  if (s.screen === "title") {
    for (let x = 720; x < 1230; x += 28)
      for (let y = 110; y < 595; y += 28) circle(x, y, 1, "#284148");
    text("C / 01", 48, 43, 14, CYAN);
    text("THE PADDLE DUEL", 1232, 43, 12, DIM, 400, "right");
    line(48, 73, 1232, 73, "#284047");
    text("A NEW ANGLE ON THE RALLY", 112, 152, 13, CYAN);
    text(C.TITLE_TEXT, 104, 235, 110, INK, 900);
    text("Move. Spin. Find your angle.", 112, 311, 23, DIM);
    menu();
    text("↑ ↓  SELECT     ENTER  PLAY", 112, 589, 12, DIM);
    // A drawn shot diagram introduces the bank-shot mechanic on the title.
    ctx.save();
    ctx.translate(742, 145);
    ctx.rotate(-0.12);
    ctx.strokeStyle = "#38545a";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 405, 390);
    ctx.setLineDash([5, 9]);
    line(202, 0, 202, 390, "#38545a");
    ctx.setLineDash([]);
    bar(18, 216, 12, 89, CYAN, true);
    bar(375, 87, 12, 89, CORAL, true);
    bar(139, 53, 16, 108, GOLD, true);
    bar(250, 237, 16, 108, GOLD, true);
    ctx.beginPath();
    ctx.moveTo(36, 247);
    ctx.bezierCurveTo(103, 215, 96, 142, 127, 117);
    ctx.lineTo(67, 15);
    ctx.quadraticCurveTo(185, 49, 308, 190);
    ctx.strokeStyle = "#78a9a9";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.shadowBlur = 28;
    ctx.shadowColor = INK;
    circle(308, 190, C.BALL_R, INK);
    ctx.restore();
    text("01", 19, 365, 11, CYAN);
    text("02", 370, 365, 11, CORAL);
    ctx.restore();
    text("CHANGE THE FLIGHT.", 967, 586, 14, GOLD, 400, "center");
    text("OWN THE NEXT POINT.", 967, 609, 14, DIM, 400, "center");
    line(48, 650, 1232, 650, "#284047");
    text("1–2 PLAYERS  /  LOCAL ARCADE", 48, 680, 12, DIM);
    text(
      "M  " + (s.muted ? "SOUND OFF" : "SOUND ON"),
      1232,
      680,
      12,
      DIM,
      400,
      "right",
    );
  } else if (s.screen === "howto") {
    text("C / FIELD GUIDE", 64, 54, 14, CYAN);
    text("HOW TO PLAY", 64, 123, 52, INK, 800);
    text("A simple duel. An unexpected return.", 64, 177, 22, DIM);
    const columns = [
      {
        x: 64,
        n: "01",
        title: "MOVE",
        color: CYAN,
        lines: [
          "SOLO   W / S or ↑ / ↓",
          "VERSUS   P1: W / S",
          "         P2: ↑ / ↓",
          "P or Esc pauses · M mutes",
        ],
      },
      {
        x: 474,
        n: "02",
        title: "ADD SPIN",
        color: CORAL,
        lines: [
          "Move your paddle as you hit.",
          "Paddle motion adds curve.",
          "Hits near the edge",
          "send the ball at an angle.",
        ],
      },
      {
        x: 884,
        n: "03",
        title: "BANK IT",
        color: GOLD,
        lines: [
          "Use the gold obstacles and",
          "walls to change the angle.",
          `First to ${C.WIN_SCORE}, win by ${C.WIN_LEAD}.`,
          "Score behind their paddle.",
        ],
      },
    ];
    columns.forEach((p) => {
      line(p.x, 239, p.x + 330, 239, "#375057");
      text(p.n, p.x, 277, 13, p.color);
      text(p.title, p.x, 319, 27, INK, 700);
      p.lines.forEach((l, i) => text(l, p.x, 365 + i * 28, 14, DIM));
    });
    text(
      "THE CONTACT MAKES THE CURVE.",
      C.FIELD_CX,
      517,
      13,
      CYAN,
      400,
      "center",
    );
    menu();
  } else {
    field();
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#061318cc";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      ctx.fillStyle = "#10252b";
      ctx.fillRect(392, 151, 496, 448);
      ctx.strokeStyle = "#365158";
      ctx.lineWidth = 1;
      ctx.strokeRect(392.5, 151.5, 495, 447);
      text(
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        192,
        12,
        CYAN,
        400,
        "center",
      );
      text(
        s.screen === "paused"
          ? "PAUSED"
          : s.winner === "left"
            ? "PLAYER 01 WINS"
            : s.mode === "solo"
              ? "COMPUTER WINS"
              : "PLAYER 02 WINS",
        C.FIELD_CX,
        252,
        s.screen === "paused" ? 56 : 35,
        INK,
        800,
        "center",
      );
      text(
        s.screen === "paused"
          ? "Your next shot can wait."
          : `${s.score.p1}  —  ${s.score.p2}`,
        C.FIELD_CX,
        311,
        23,
        DIM,
        400,
        "center",
      );
      menu();
    }
  }
}
