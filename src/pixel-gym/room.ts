import { equipment, type Point } from "./equipment";
export type Placement = Point & { id: string; type: string; orientation: 0 };
export type Layout = {
  version: 1;
  width: number;
  height: number;
  tile: number;
  placements: Placement[];
};
const coords: [string, number, number][] = [
  ["dumbbells", 10, 4],
  ["flat-bench", 11, 8],
  ["incline-bench", 23, 8],
  ["treadmill", 2, 8],
  ["stairs", 2, 15],
  ["elliptical", 2, 22],
  ["bike", 2, 30],
  ["bench-press", 33, 7],
  ["smith", 33, 15],
  ["squat-rack", 33, 23],
  ["flat-bench", 33, 31],
  ["crossover", 13, 14],
  ["lateral", 8, 21],
  ["shoulder", 14, 22],
  ["chest", 20, 22],
  ["preacher", 26, 21],
  ["triceps", 8, 28],
  ["leg-press", 14, 28],
  ["leg-extension", 20, 28],
  ["leg-curl", 26, 28],
  ["fly", 12, 34],
  ["row", 22, 34],
];
export const defaultRoom: Layout = {
  version: 1,
  width: 40,
  height: 40,
  tile: 16,
  placements: coords.map(([type, x, y], i) => ({
    id: "fixture-" + i,
    type,
    x,
    y,
    orientation: 0,
  })),
};
export const entrance = { x: 19, y: 38 };
export function isBlocked(room: Layout, p: Point) {
  if (p.x < 1 || p.x >= room.width - 1 || p.y < 4 || p.y >= room.height - 1)
    return true;
  return room.placements.some((item) =>
    equipment
      .get(item.type)
      ?.collision.some(
        (b) =>
          p.x >= item.x + b.x &&
          p.x < item.x + b.x + b.w &&
          p.y >= item.y + b.y &&
          p.y < item.y + b.y + b.h,
      ),
  );
}
