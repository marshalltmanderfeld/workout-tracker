import { expect, it } from "vitest";
import { initialModels } from "../src/catalog";
import { newExercise, sessionSchema, uuid } from "../src/domain";
import { equipment } from "../src/pixel-gym/equipment";
import {
  defaultRoom as room,
  entrance,
  isBlocked,
} from "../src/pixel-gym/room";
import { replaySets, resolveStation } from "../src/pixel-gym/replay";

it("keeps all equipment on the floor and all approach tiles reachable from the entrance", () => {
  const queue = [entrance],
    reached = new Set([entrance.x + "," + entrance.y]),
    footprint = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy },
        key = n.x + "," + n.y;
      if (!reached.has(key) && !isBlocked(room, n)) {
        reached.add(key);
        queue.push(n);
      }
    }
  }
  for (const p of room.placements) {
    const d = equipment.get(p.type)!;
    for (let x = p.x; x < p.x + d.width; x++)
      for (let y = p.y; y < p.y + d.height; y++) {
        expect(
          x >= 1 && x < room.width - 1 && y >= 4 && y < room.height - 1,
        ).toBe(true);
        const key = x + "," + y;
        expect(footprint.has(key)).toBe(false);
        footprint.add(key);
      }
    for (const s of d.stations)
      expect(reached.has(p.x + s.approach.x + "," + (p.y + s.approach.y))).toBe(
        true,
      );
  }
});
it("uses distinct stations on one cable assembly and falls back on an empty floor", () => {
  const a = resolveStation("Lat Pulldowns", room),
    b = resolveStation("Seated Cable Rows", room);
  expect(a.placement).toBeTruthy();
  expect(a.placement).toBe(b.placement);
  expect(a.pose).not.toEqual(b.pose);
  expect(
    resolveStation("Lat pulldown", { ...room, placements: [] }).pose,
  ).toEqual(entrance);
});
it("reads only completed sets in order across gyms, preserving uncertain data", () => {
  const e = newExercise(initialModels()[0], undefined, "Cable lateral raises");
  const s = sessionSchema.parse({
    id: uuid(),
    name: "Travel workout",
    gym_name: "Hotel",
    gym_id: uuid(),
    date: "2026-10-19",
    status: "completed",
    exercises: [
      {
        ...e,
        sets: [
          { id: uuid(), weight: null, reps: 8, verified: false },
          { id: uuid(), weight: 20, reps: 5, completed: false },
          { id: uuid(), weight: 15, reps: 10 },
        ],
      },
      {
        ...e,
        id: uuid(),
        skipped: true,
        sets: [{ id: uuid(), weight: 15, reps: 10 }],
      },
    ],
  });
  const before = JSON.stringify(s),
    frames = replaySets(s, room);
  expect(frames.map((f) => [f.weight, f.reps])).toEqual([
    [null, 8],
    [15, 10],
  ]);
  expect(frames[0].provisional).toBe(true);
  expect(replaySets({ ...s, gym_id: uuid(), gym_name: "Home" }, room)).toEqual(
    frames,
  );
  expect(replaySets({ ...s, status: "active" }, room)).toEqual([]);
  expect(JSON.stringify(s)).toBe(before);
});
