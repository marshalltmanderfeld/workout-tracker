import { sessionSchema, type Data, type Session } from "./domain";

// Per-entry copy. This adapter deliberately has no database or localStorage dependency.
export function practiceStore(source: Data) {
  const data = structuredClone(source);
  const photos = new Set<string>();
  function addSessions(sessions: Session[]) {
    let count = 0;
    for (const s of sessions) {
      if (
        data.sessions.some(
          (old) =>
            old.id === s.id ||
            (s.import_key && old.import_key === s.import_key),
        )
      )
        continue;
      data.sessions.push(structuredClone(s));
      count++;
    }
    return count;
  }
  return {
    loadData: async () => structuredClone(data),
    async saveSession(value: Session) {
      const session = sessionSchema.parse(value);
      const index = data.sessions.findIndex((s) => s.id === session.id);
      if ((data.sessions[index]?.revision ?? 0) !== session.revision)
        throw Error("Workout changed. Refresh and retry.");
      const saved = { ...session, revision: session.revision + 1 };
      if (index < 0) data.sessions.push(saved);
      else data.sessions[index] = saved;
      return structuredClone(saved);
    },
    async upsert(table: string, value: { id: string }) {
      const list = data[table as keyof Data] as { id: string }[];
      const index = list.findIndex((v) => v.id === value.id);
      if (index < 0) list.push(structuredClone(value));
      else list[index] = structuredClone(value);
    },
    async removeSession(id: string) {
      data.sessions = data.sessions.filter((s) => s.id !== id);
    },
    importSessions: async (sessions: Session[]) => addSessions(sessions),
    async importBundle(bundle: Partial<Data>) {
      for (const table of [
        "models",
        "gyms",
        "instances",
        "templates",
      ] as const) {
        const list = data[table] as { id: string }[];
        for (const item of bundle[table] || [])
          if (!list.some((v) => v.id === item.id))
            list.push(structuredClone(item));
      }
      return addSessions(bundle.sessions || []);
    },
    async uploadPhoto(file: File) {
      const url = URL.createObjectURL(file);
      photos.add(url);
      return url;
    },
    dispose() {
      photos.forEach((url) => URL.revokeObjectURL(url));
      photos.clear();
    },
  };
}
