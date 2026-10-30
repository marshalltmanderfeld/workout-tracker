import { createClient } from "@supabase/supabase-js";
import { type Data, type Session, sessionSchema, uuid } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const db =
  url && key && !url.includes("YOUR_PROJECT") ? createClient(url, key) : null;
function client() {
  if (!db) throw new Error("Supabase is not configured yet.");
  return db;
}
export async function loadData(): Promise<Data> {
  const names = [
    "models",
    "gyms",
    "instances",
    "templates",
    "sessions",
    "session_exercises",
    "sets",
  ];
  const results = await Promise.all(
    names.map(async (table) => {
      let all: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await client()
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
      }
      return all;
    }),
  );
  const [models, gyms, instances, templates, sessions, exercises, sets] =
    results;
  return {
    models: models.map(({ primary_muscles, ...m }) => ({
      ...m,
      primary: primary_muscles,
    })),
    gyms,
    instances,
    templates,
    sessions: sessions.map((s) => ({
      ...s,
      exercises: exercises
        .filter((e) => e.session_id === s.id)
        .sort((a, b) => a.position - b.position)
        .map(({ primary_muscles, ...e }) => ({
          ...e,
          primary: primary_muscles,
          sets: sets
            .filter((x) => x.exercise_id === e.id)
            .sort((a, b) => a.position - b.position)
            .map((x) => ({
              ...x,
              weight: x.weight === null ? null : Number(x.weight),
              rir: x.rir === null ? null : Number(x.rir),
            })),
        })),
    })),
  };
}
export async function saveSession(s: Session) {
  const parsed = sessionSchema.parse(s);
  const { data, error } = await client().rpc("save_session", {
    payload: parsed,
  });
  if (error) throw error;
  return { ...parsed, revision: data as number };
}
export async function upsert(table: string, value: any) {
  const allowed: Record<string, string[]> = {
    models: [
      "id",
      "name",
      "manufacturer",
      "model",
      "category",
      "nickname",
      "primary",
      "secondary",
      "exercises",
      "notes",
      "rating",
      "comfort",
      "adjustability",
      "movement",
      "favorite",
      "photo",
    ],
    gyms: ["id", "name", "location", "notes", "rating", "favorite", "photo"],
    instances: ["id", "gym_id", "model_id", "notes", "rating"],
    templates: ["id", "name", "position", "scheduled_date", "exercises"],
  };
  if (!allowed[table]) throw new Error("Unsupported table");
  const clean = Object.fromEntries(
    Object.entries(value).filter(([k]) => allowed[table].includes(k)),
  );
  if (table === "models") {
    clean.primary_muscles = clean.primary;
    delete clean.primary;
  }
  const { error } = await client().from(table).upsert(clean);
  if (error) throw error;
}
export async function removeSession(id: string) {
  const { error } = await client().from("sessions").delete().eq("id", id);
  if (error) throw error;
}
export async function importSessions(sessions: Session[]) {
  const { data, error } = await client().rpc("import_sessions", {
    payload: sessions.map((s) => sessionSchema.parse(s)),
  });
  if (error) throw error;
  return data as number;
}
export async function uploadPhoto(file: File, user: string) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5242880
  )
    throw new Error("Choose a JPG, PNG or WebP smaller than 5 MB.");
  const path = `${user}/${uuid()}.${file.type.split("/")[1]}`;
  const { error } = await client()
    .storage.from("equipment-photos")
    .upload(path, file);
  if (error) throw error;
  return path;
}
export async function photoURL(path: string) {
  const { data, error } = await client()
    .storage.from("equipment-photos")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importBundle(payload: unknown) {
  const { data, error } = await client().rpc("import_bundle", { payload });
  if (error) throw error;
  return data as number;
}
