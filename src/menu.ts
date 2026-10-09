import * as C from "./constants";
import type { CaromState } from "./game";
export function items(s: CaromState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: CaromState, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= items(s).length)
    return null;
  return {
    x: s.screen === "title" ? 112 : 440,
    y:
      (s.screen === "howto" ? 586 : s.screen === "title" ? 366 : 366) +
      index * 64,
    w: 400,
    h: 54,
  };
}
