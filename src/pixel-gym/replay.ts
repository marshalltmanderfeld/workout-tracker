import { rows, type Session } from "../domain";
import { equipment } from "./equipment";
import { entrance, type Layout } from "./room";
function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/pull[ -]?downs?/g, "pulldown")
    .replace(/push[ -]?downs?/g, "pushdown")
    .replace(/raises\b/g, "raise")
    .replace(/curls\b/g, "curl")
    .replace(/rows\b/g, "row")
    .replace(/extensions\b/g, "extension")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function resolveStation(name: string, room: Layout) {
  const key = normalize(name);
  for (const item of room.placements) {
    const def = equipment.get(item.type);
    const station = def?.stations.find((s) =>
      s.exercises.some((alias) => normalize(alias) === key),
    );
    if (def && station)
      return {
        placement: item.id,
        station: station.id,
        label: def.name,
        pose: { x: item.x + station.pose.x, y: item.y + station.pose.y },
      };
  }
  return {
    placement: null,
    station: "floor",
    label: "Open floor",
    pose: entrance,
  };
}
export function replaySets(session: Session | undefined, room: Layout) {
  if (!session || session.status !== "completed") return [];
  return rows([session]).map(({ exercise, set }) => ({
    id: set.id,
    name: exercise.name,
    reps: set.reps,
    weight: set.weight,
    basis: exercise.config.load_basis,
    provisional: !set.verified,
    approximate: set.approximate,
    warmup: set.warmup,
    target: resolveStation(exercise.name, room),
  }));
}
