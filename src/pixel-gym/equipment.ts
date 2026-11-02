// Coordinates are in tiles, relative to the top-left of the placement.
export type Point = { x: number; y: number };
export type Box = Point & { w: number; h: number };
export type Station = {
  id: string;
  exercises: string[];
  approach: Point;
  pose: Point;
  animation: string;
};
type Shape = "rack" | "bench" | "cardio" | "press" | "cable";
export type Equipment = {
  id: string;
  name: string;
  shape: Shape;
  width: number;
  height: number;
  sprite: string | null;
  collision: Box[];
  stations: Station[];
};
function machine(
  id: string,
  name: string,
  shape: Shape,
  width: number,
  height: number,
  exercises: string[],
): Equipment {
  return {
    id,
    name,
    shape,
    width,
    height,
    sprite: null,
    collision: [{ x: 0, y: 0, w: width, h: height }],
    stations: [
      {
        id: "main",
        exercises,
        approach: { x: Math.floor(width / 2), y: height },
        pose: { x: Math.floor(width / 2), y: height - 1 },
        animation: id,
      },
    ],
  };
}
const cable = machine(
  "crossover",
  "Multi-station cable crossover",
  "cable",
  12,
  5,
  [],
);
cable.collision = [
  { x: 0, y: 0, w: 2, h: 5 },
  { x: 10, y: 0, w: 2, h: 5 },
  { x: 3, y: 2, w: 2, h: 3 },
  { x: 7, y: 2, w: 2, h: 3 },
];
cable.stations = [
  {
    id: "left-pulley",
    exercises: [
      "Cable lateral raise",
      "Cable curl",
      "Triceps pushdown",
      "Cable crossover",
    ],
    approach: { x: 0, y: 5 },
    pose: { x: 1, y: 4 },
    animation: "pull",
  },
  {
    id: "right-pulley",
    exercises: [
      "Cable fly",
      "Cable lateral raise",
      "Cable curl",
      "Triceps pushdown",
    ],
    approach: { x: 11, y: 5 },
    pose: { x: 10, y: 4 },
    animation: "pull",
  },
  {
    id: "pull-up-bar",
    exercises: ["Pull-up", "Chin-up"],
    approach: { x: 6, y: 1 },
    pose: { x: 6, y: 0 },
    animation: "pull-up",
  },
  {
    id: "pulldown",
    exercises: ["Lat pulldown", "Cable lat pulldown"],
    approach: { x: 4, y: 5 },
    pose: { x: 4, y: 4 },
    animation: "pulldown",
  },
  {
    id: "low-row",
    exercises: ["Cable row", "Seated cable row"],
    approach: { x: 8, y: 5 },
    pose: { x: 8, y: 4 },
    animation: "row",
  },
];
export const library = [
  machine("dumbbells", "Dumbbell rack", "rack", 19, 2, [
    "Dumbbell curl",
    "Hammer curl",
    "Dumbbell lateral raise",
  ]),
  machine("flat-bench", "Flat dumbbell bench", "bench", 4, 2, [
    "Dumbbell bench press",
  ]),
  machine("incline-bench", "Adjustable bench", "bench", 4, 2, [
    "Incline dumbbell press",
  ]),
  machine("treadmill", "Treadmill", "cardio", 3, 4, ["Treadmill"]),
  machine("stairs", "Stair climber", "cardio", 3, 4, ["Stair climber"]),
  machine("elliptical", "Elliptical", "cardio", 3, 4, ["Elliptical"]),
  machine("bike", "Stationary bike", "cardio", 3, 3, ["Stationary bike"]),
  machine("bench-press", "Bench press", "press", 5, 4, [
    "Bench press",
    "Barbell bench press",
  ]),
  machine("smith", "Smith machine", "press", 5, 4, [
    "Smith machine squat",
    "Smith bench press",
  ]),
  machine("squat-rack", "Squat rack", "press", 5, 4, [
    "Squat",
    "Barbell squat",
  ]),
  cable,
  ...[
    ["lateral", "Lateral raise", "Machine lateral raise"],
    ["shoulder", "Shoulder press", "Machine shoulder press"],
    ["chest", "Chest press", "Machine chest press"],
    ["preacher", "Preacher curl", "EZ-bar preacher curl"],
    ["triceps", "Triceps extension"],
    ["leg-press", "Leg press"],
    ["leg-extension", "Leg extension"],
    ["leg-curl", "Seated leg curl", "Leg curl"],
    ["fly", "Pec fly", "Reverse pec fly"],
    ["row", "Seated row"],
  ].map(([id, name, ...aliases]) =>
    machine(id, name, "press", 3, 3, [name, ...aliases]),
  ),
];
export const equipment = new Map(library.map((item) => [item.id, item]));
