# Carom

A browser arcade duel about finding the next angle. Send a ball between two
paddles, bank shots off the amber obstacles, and move at contact to add spin.
Play against the computer or share a keyboard with a friend. First to 11 wins,
with a two-point lead required.

Everything is drawn on canvas. Sound is synthesized by the Simple 2D engine;
there are no downloaded assets, accounts, or backend services.

## Run

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Build

```sh
npm run build
npm run preview
```

The complete static site is emitted to `dist/`. Serve that directory at the
root of any static host. `npm ci` followed by `npm run build` is the entire
production build process.

## Controls

| Action | Controls |
| --- | --- |
| Solo movement | W / S or Up / Down |
| Versus player one | W / S |
| Versus player two | Up / Down |
| Menu selection | W / S or Up / Down; pointer or touch |
| Confirm | Enter or Space; click or tap |
| Pause / resume | P or Escape |
| Back | Escape |
| Mute | M |
| Debug overlay | Backtick |

Touch devices receive the engine's two vertical sliders and menu controls.
Move your paddle during a hit to curve the flight. Hitting near a paddle's end
sends a steeper return; the obstacles and walls preserve the ball's spin.

## Development checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The simulation is independent of rendering. Tests create the actual engine with
a Node canvas and a controlled clock, then drive input and debug poses through
counted frames. The engine exposes the immutable state and debug API to its
caller; the game does not install an API on the page.

`src/game.ts` declares the state and wires initialization, `simulation.ts` handles
input and transitions, `physics.ts` resolves flight and contacts, and `render.ts`
draws the screens. The supplied constants and engine integration remain intact.

The player-facing description, screenshots, and a 4.8-second engine recording
live in `showcase/`.
