import { z } from "zod";
export const muscles = [
  "Front deltoids",
  "Side deltoids",
  "Rear deltoids",
  "Biceps",
  "Triceps",
  "Forearms",
  "Chest",
  "Upper chest",
  "Lats",
  "Upper/mid back",
  "Trapezius",
  "Abdominals",
  "Obliques",
  "Lower back",
  "Quadriceps",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Hip abductors",
  "Hip adductors",
];
export const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const id = z.uuid();
const short = z.string().trim().min(1).max(200);
const note = z.string().max(5000).default("");
const rating = z.number().int().min(1).max(5).nullable().default(null);
export const configSchema = z.object({
  pulley: z.enum(["none", "single", "dual"]).default("none"),
  load_basis: z
    .enum([
      "stack",
      "per_stack",
      "combined",
      "total",
      "added_plates",
      "assistance",
      "unknown",
    ])
    .default("stack"),
  attachment: z.string().max(200).default(""),
  position: z.string().max(200).default(""),
  notes: note,
});
export const setSchema = z.object({
  id,
  weight: z.number().min(0).max(10000).nullable(),
  reps: z.number().int().min(1).max(1000),
  rir: z.number().min(0).max(10).nullable().default(null),
  warmup: z.boolean().default(false),
  completed: z.boolean().default(true),
  verified: z.boolean().default(true),
  approximate: z.boolean().default(false),
  notes: note,
});
export const exerciseSchema = z.object({
  id,
  model_id: id,
  instance_id: id.nullable().default(null),
  name: short,
  equipment_name: short,
  primary: z.array(z.string()).max(20),
  secondary: z.array(z.string()).max(20).default([]),
  config: configSchema,
  skipped: z.boolean().default(false),
  notes: note,
  sets: z.array(setSchema).max(200),
});
export const sessionSchema = z
  .object({
    id,
    name: short,
    date: z.iso.date(),
    started_at: z.iso.datetime().nullable().default(null),
    ended_at: z.iso.datetime().nullable().default(null),
    gym_id: id.nullable(),
    gym_name: z.string().max(200).default("Not recorded"),
    status: z.enum(["active", "completed"]),
    notes: note,
    source: note,
    import_key: z.string().max(200).nullable().default(null),
    revision: z.number().int().min(0).default(0),
    template_id: id.nullable().default(null),
    exercises: z.array(exerciseSchema).max(100),
  })
  .refine((s) => !s.ended_at || !s.started_at || s.ended_at >= s.started_at, {
    message: "End time must follow start time",
  });
export const importSchema = z.object({
  schema_version: z.literal(1),
  sessions: z.array(sessionSchema).min(1).max(500),
});
export type Config = z.infer<typeof configSchema>;
export type SetEntry = z.infer<typeof setSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Model = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: string;
  nickname: string;
  primary: string[];
  secondary: string[];
  exercises: string[];
  notes: string;
  rating: number | null;
  comfort: number | null;
  adjustability: number | null;
  movement: number | null;
  favorite: boolean;
  photo: string | null;
};
export type Gym = {
  id: string;
  name: string;
  location: string;
  notes: string;
  rating: number | null;
  favorite: boolean;
  photo: string | null;
};
export type Instance = {
  id: string;
  gym_id: string;
  model_id: string;
  notes: string;
  rating: number | null;
};
export type Template = {
  id: string;
  name: string;
  position: number;
  scheduled_date: string | null;
  exercises: Exercise[];
};
export type Data = {
  models: Model[];
  gyms: Gym[];
  instances: Instance[];
  templates: Template[];
  sessions: Session[];
};
export const emptyData: Data = {
  models: [],
  gyms: [],
  instances: [],
  templates: [],
  sessions: [],
};
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function comparisonKey(e: Exercise) {
  return JSON.stringify([
    e.model_id,
    e.instance_id,
    e.name.trim().toLowerCase(),
    e.config.pulley,
    e.config.load_basis,
    e.config.attachment.trim().toLowerCase(),
    e.config.position.trim().toLowerCase(),
    e.config.notes.trim(),
  ]);
}
export function confirmed(s: SetEntry) {
  return s.completed && s.verified && !s.approximate;
}
export function rows(sessions: Session[]) {
  return sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets
        .filter((set) => set.completed && !exercise.skipped)
        .map((set) => ({ session, exercise, set })),
    ),
  );
}
export function periodStart(period: string, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === "month") d.setDate(1);
  if (period === "year") {
    d.setMonth(0, 1);
  }
  return period === "all" ? "0001-01-01" : localDate(d);
}
export function stats(sessions: Session[]) {
  const r = rows(sessions).filter((x) => confirmed(x.set));
  return {
    sets: r.length,
    working: r.filter((x) => !x.set.warmup).length,
    reps: r.reduce((n, x) => n + x.set.reps, 0),
    sessions: new Set(r.map((x) => x.session.id)).size,
  };
}
export function previousPerformance(
  sessions: Session[],
  active: Session,
  e: Exercise,
) {
  return [...sessions]
    .filter(
      (s) =>
        s.id !== active.id && s.status === "completed" && s.date <= active.date,
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.started_at ?? "").localeCompare(a.started_at ?? ""),
    )
    .flatMap((s) =>
      s.exercises
        .filter((x) => comparisonKey(x) === comparisonKey(e))
        .map((x) => ({ session: s, exercise: x })),
    )[0];
}
export function newExercise(
  model: Model,
  instance: Instance | undefined,
  name = model.exercises[0] || model.name,
): Exercise {
  return {
    id: uuid(),
    model_id: model.id,
    instance_id: instance?.id ?? null,
    name,
    equipment_name: model.nickname || model.name,
    primary: model.primary,
    secondary: model.secondary,
    config: configSchema.parse({}),
    skipped: false,
    notes: "",
    sets: [],
  };
}
export function duplicateSession(s: Session): Session {
  return {
    ...s,
    id: uuid(),
    name: s.name,
    date: localDate(),
    started_at: new Date().toISOString(),
    ended_at: null,
    status: "active",
    source: "",
    import_key: null,
    revision: 0,
    exercises: s.exercises.map((e) => ({
      ...e,
      id: uuid(),
      sets: [],
      skipped: false,
    })),
  };
}
export function toCSV(sessions: Session[]) {
  const values = [
    [
      "session_id",
      "date",
      "workout",
      "gym",
      "exercise",
      "equipment",
      "configuration",
      "weight_lb",
      "reps",
      "rir",
      "warmup",
      "verified",
      "approximate",
      "notes",
      "source",
    ],
    ...rows(sessions).map(({ session: s, exercise: e, set }) => [
      s.id,
      s.date,
      s.name,
      s.gym_name,
      e.name,
      e.equipment_name,
      JSON.stringify(e.config),
      set.weight ?? "",
      set.reps,
      set.rir ?? "",
      set.warmup,
      set.verified,
      set.approximate,
      set.notes,
      s.source,
    ]),
  ];
  return values
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v)
              .replace(/^[=+@\-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
}
export const modelSchema = z.object({
  id,
  name: short,
  manufacturer: z.string().max(200),
  model: z.string().max(200),
  category: short,
  nickname: z.string().max(200),
  primary: z.array(z.string()),
  secondary: z.array(z.string()),
  exercises: z.array(short).min(1),
  notes: note,
  rating,
  comfort: rating,
  adjustability: rating,
  movement: rating,
  favorite: z.boolean(),
  photo: z.string().max(1000).nullable(),
});
export const gymSchema = z.object({
  id,
  name: short,
  location: z.string().max(500),
  notes: note,
  rating,
  favorite: z.boolean(),
  photo: z.string().max(1000).nullable(),
});
export const instanceSchema = z.object({
  id,
  gym_id: id,
  model_id: id,
  notes: note,
  rating,
});
export const templateSchema = z.object({
  id,
  name: short,
  position: z.number().int().min(0),
  scheduled_date: z.iso.date().nullable(),
  exercises: z.array(exerciseSchema).max(100),
});
export const backupSchema = z.object({
  schema_version: z.literal(1),
  models: z.array(modelSchema),
  gyms: z.array(gymSchema),
  instances: z.array(instanceSchema),
  templates: z.array(templateSchema),
  sessions: z.array(sessionSchema),
});
