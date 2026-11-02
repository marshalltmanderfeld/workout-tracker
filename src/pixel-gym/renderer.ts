import { equipment, type Equipment, type Point } from "./equipment";
import type { Layout } from "./room";
type Brush = (
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) => void;
function fixture(b: Brush, d: Equipment, x: number, y: number, t: number) {
  const w = d.width * t,
    h = d.height * t,
    metal = "#50636a",
    light = "#92a0a1",
    pad = "#b36c51",
    dark = "#28383e";
  const r: Brush = (a, c, v, z, color) => b(x + a, y + c, v, z, color);
  if (d.shape === "cable") {
    for (const tx of [0, w - 2 * t]) {
      r(tx, 0, 2 * t, h, metal);
      r(tx + 3, 3, 2 * t - 6, h - 6, dark);
      for (let sy = 10; sy < h - 8; sy += 8) r(tx + 6, sy, t, 3, light);
      r(tx + t, 20, 5, 17, pad);
    }
    r(t, 0, w - 2 * t, 8, metal);
    r(t, 0, w - 2 * t, 3, light);
    r(5 * t, 7, 2 * t, 5, dark);
    for (const sx of [3 * t, 7 * t]) {
      r(sx, 7, 3, 2 * t, light);
      r(sx, 2 * t, 2 * t, 8, metal);
      r(sx + 6, 2 * t + 10, t, 15, pad);
      r(sx + 5, 4 * t, 22, 7, dark);
    }
    return;
  }
  r(2, h - 6, w - 4, 6, "#b6a997");
  r(4, 5, w - 8, h - 12, metal);
  if (d.shape === "rack") {
    r(2, 3, w - 4, 5, light);
    for (let k = 8; k < w - 12; k += 20) {
      r(k, 11, 16, 3, light);
      r(k, 7, 5, 12, dark);
      r(k + 11, 7, 5, 12, dark);
    }
  } else if (d.shape === "bench") {
    r(8, 7, w - 16, h - 16, pad);
    r(13, 5, 4, h - 12, dark);
  } else if (d.shape === "cardio") {
    r(8, 12, w - 16, h - 22, dark);
    r(10, 4, w - 20, 7, "#85aaa4");
    for (let i = 22; i < h - 12; i += 9) r(13, i, w - 26, 2, light);
  } else {
    r(6, 4, w - 12, 5, light);
    r(8, 8, 5, h - 19, dark);
    r(w - 13, 8, 5, h - 19, dark);
    r(w / 2 - 7, 14, 14, 12, pad);
    r(w / 2 - 9, h - 17, 18, 7, pad);
  }
}
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: Layout,
  actor: Point,
  highlight: string | null,
  collisions: boolean,
) {
  const t = room.tile,
    W = room.width * t,
    H = room.height * t;
  ctx.imageSmoothingEnabled = false;
  const b: Brush = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  b(0, 0, W, H, "#b9ad9c");
  for (let y = 0; y < room.height; y++)
    for (let x = 0; x < room.width; x++)
      b(x * t, y * t, t - 1, t - 1, (x + y) % 2 === 0 ? "#d4c9b6" : "#d8cebc");
  b(0, 0, W, 4 * t, "#6e7976");
  b(0, 4 * t - 6, W, 6, "#475753");
  b(0, 0, t, H, "#646f6c");
  b(W - t, 0, t, H, "#646f6c");
  b(0, H - t, W, t, "#475753");
  for (let x = 9 * t; x < 30 * t; x += 3 * t) {
    b(x, 6, 3 * t - 3, 3 * t, "#b5d2cc");
    b(x + 3, 9, 3 * t - 9, 3, "#dce7d8");
  }
  const layers = room.placements.flatMap((p) => {
    const d = equipment.get(p.type);
    if (!d) return [];
    return [
      { depth: p.y + d.height, draw: () => fixture(b, d, p.x * t, p.y * t, t) },
    ];
  });
  layers.push({
    depth: actor.y + 1,
    draw: () => {
      const x = actor.x * t,
        y = (actor.y + 1) * t - 24;
      b(x + 2, y + 20, 13, 4, "#6e756a");
      b(x + 4, y + 1, 9, 8, "#be9070");
      b(x + 3, y, 10, 3, "#473b37");
      b(x + 2, y + 8, 12, 9, "#336d70");
      b(x, y + 10, 3, 7, "#be9070");
      b(x + 13, y + 10, 3, 7, "#be9070");
      b(x + 3, y + 17, 4, 7, "#334049");
      b(x + 9, y + 17, 4, 7, "#334049");
    },
  });
  layers.sort((a, b) => a.depth - b.depth).forEach((layer) => layer.draw());
  for (const p of room.placements) {
    const d = equipment.get(p.type)!;
    if (collisions)
      for (const c of d.collision)
        b((p.x + c.x) * t, (p.y + c.y) * t, c.w * t, c.h * t, "#b7394544");
    if (p.id === highlight) {
      ctx.strokeStyle = "#176559";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        p.x * t - 2,
        p.y * t - 2,
        d.width * t + 4,
        d.height * t + 4,
      );
    }
  }
}
