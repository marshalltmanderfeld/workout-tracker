import { describe, expect, it } from "vitest";
import { emptyData, sessionSchema, uuid, workoutError } from "../src/domain";
import { practiceStore } from "../src/practice";
const workout = () =>
  sessionSchema.parse({
    id: uuid(),
    name: "Open workout",
    exercises: [],
    gym_id: null,
    date: "2026-11-01",
    status: "active",
    started_at: "2026-11-02T01:02:03.123456+00:00",
  });
describe("workout recovery", () => {
  it("accepts database timestamps and compares the actual instants", () => {
    const s = workout();
    expect(s.started_at).toBe("2026-11-02T01:02:03.123Z");
    expect(
      sessionSchema.parse({ ...s, ended_at: "2026-11-01T20:02:03.124-05:00" })
        .ended_at,
    ).toBe("2026-11-02T01:02:03.124Z");
    const invalid = sessionSchema.safeParse({ ...s, started_at: "yesterday" });
    if (invalid.success) throw Error("Expected invalid timestamp");
    expect(workoutError(invalid.error)).toBe(
      "Check the started at value and try again.",
    );
  });
  it("isolates session saves, deletes, imports and gym edits from account data", async () => {
    const s = workout(),
      source = { ...emptyData, sessions: [s] },
      original = structuredClone(source);
    const sandbox = practiceStore(source);
    const saved = await sandbox.saveSession({ ...s, status: "completed" });
    expect(saved.revision).toBe(1);
    await expect(sandbox.saveSession(s)).rejects.toThrow();
    await sandbox.removeSession(s.id);
    await sandbox.importBundle({
      sessions: [saved],
      gyms: [
        {
          id: uuid(),
          name: "Practice",
          location: "",
          notes: "",
          rating: null,
          favorite: false,
          photo: null,
        },
      ],
    });
    expect(await sandbox.importSessions([saved])).toBe(0);
    expect((await sandbox.loadData()).gyms).toHaveLength(1);
    expect(source).toEqual(original);
    expect(await practiceStore(source).loadData()).toEqual(original);
  });
});
