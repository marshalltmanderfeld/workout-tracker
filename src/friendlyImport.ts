import { z } from "zod";
import {
  type Data,
  type Session,
  uuid,
  sessionSchema,
  configSchema,
  setSchema,
} from "./domain";
import { primaryFor } from "./catalog";
const sourceSchema = z.object({
  schema_version: z.literal(1),
  format: z.literal("named-workouts"),
  sessions: z
    .array(
      z.object({
        import_key: z.string().min(1).max(200),
        name: z.string().min(1),
        date: z.iso.date(),
        source: z.string().min(1),
        notes: z.string().default(""),
        exercises: z
          .array(
            z.object({
              equipment_name: z.string().min(1),
              model: z.string().min(1),
              exercise: z.string().min(1),
              config: configSchema,
              sets: z
                .array(
                  setSchema
                    .omit({ id: true })
                    .extend({ verified: z.boolean().default(false) }),
                )
                .min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(500),
});
export function resolveNamedWorkouts(raw: unknown, data: Data): Session[] {
  const parsed = sourceSchema.parse(raw);
  return parsed.sessions.map((s) =>
    sessionSchema.parse({
      id: uuid(),
      name: s.name,
      date: s.date,
      status: "completed",
      gym_id: null,
      gym_name: "Not recorded",
      started_at: null,
      ended_at: null,
      source: s.source,
      notes: s.notes,
      import_key: s.import_key,
      revision: 0,
      exercises: s.exercises.map((e) => {
        const matches = data.models.filter(
          (m) => m.name === e.equipment_name && m.model === e.model,
        );
        if (matches.length !== 1)
          throw Error(
            `Expected one exact equipment match for ${e.equipment_name} (${e.model}); found ${matches.length}. Update the import or catalog; nothing has been imported.`,
          );
        const m = matches[0];
        return {
          id: uuid(),
          model_id: m.id,
          instance_id: null,
          name: e.exercise,
          equipment_name: m.name,
          primary: primaryFor(e.exercise, m.primary),
          secondary: m.secondary,
          config: e.config,
          sets: e.sets.map((set) => ({ ...set, id: uuid() })),
        };
      }),
    }),
  );
}
export function resolveNamedBundle(raw: unknown, data: Data) {
  const input = raw as { equipment?: unknown[] };
  const additions = (input.equipment || []).map((item) => {
    const x = z
      .object({
        name: z.string().min(1),
        model: z.string().min(1),
        category: z.string().min(1),
        primary: z.array(z.string()),
        exercises: z.array(z.string()).min(1),
        notes: z.string(),
      })
      .parse(item);
    const matches = data.models.filter(
      (m) => m.name === x.name && m.model === x.model,
    );
    if (matches.length > 1) throw Error("Ambiguous equipment: " + x.name);
    return (
      matches[0] || {
        ...x,
        id: uuid(),
        manufacturer: "Unidentified",
        nickname: "",
        secondary: [],
        rating: null,
        comfort: null,
        adjustability: null,
        movement: null,
        favorite: false,
        photo: null,
      }
    );
  });
  const combined = {
    ...data,
    models: [
      ...data.models,
      ...additions.filter((a) => !data.models.some((m) => m.id === a.id)),
    ],
  };
  return {
    schema_version: 1,
    models: combined.models,
    gyms: data.gyms,
    instances: data.instances,
    templates: [],
    sessions: resolveNamedWorkouts(raw, combined),
  };
}
