import { describe, it, expect } from "vitest";
import {
  uuid,
  sessionSchema,
  comparisonKey,
  stats,
  periodStart,
  previousPerformance,
  duplicateSession,
  toCSV,
  importSchema,
  newExercise,
} from "../src/domain";
import { initialModels, primaryFor } from "../src/catalog";
const m = initialModels()[3],
  g = uuid();
function session(date = "2026-10-19") {
  return sessionSchema.parse({
    id: uuid(),
    name: "Test workout",
    date,
    gym_id: g,
    gym_name: "Test gym",
    status: "completed",
    exercises: [
      {
        ...newExercise(m, undefined),
        sets: [{ id: uuid(), weight: 50, reps: 10 }],
      },
    ],
  });
}
describe("private workout domain", () => {
  it("rejects invalid dates, loads, reps and RIR", () => {
    for (const patch of [
      { weight: -1 },
      { reps: 0 },
      { reps: 2.5 },
      { rir: 11 },
    ]) {
      const s = session();
      Object.assign(s.exercises[0].sets[0], patch);
      expect(() => sessionSchema.parse(s)).toThrow();
    }
    expect(() =>
      sessionSchema.parse({ ...session(), date: "2026-02-30" }),
    ).toThrow();
  });
  it("keeps unknown load distinct from zero", () => {
    const s = session();
    s.exercises[0].sets[0].weight = null;
    expect(sessionSchema.parse(s).exercises[0].sets[0].weight).toBeNull();
    s.exercises[0].sets[0].weight = 0;
    expect(sessionSchema.parse(s).exercises[0].sets[0].weight).toBe(0);
  });
  it("does not count provisional, skipped, incomplete or approximate sets as confirmed", () => {
    const s = session();
    s.exercises[0].sets.push({
      ...s.exercises[0].sets[0],
      id: uuid(),
      verified: false,
    });
    expect(stats([s]).sets).toBe(1);
    s.exercises[0].sets[0].approximate = true;
    expect(stats([s]).sets).toBe(0);
    s.exercises[0].skipped = true;
    expect(stats([s]).sets).toBe(0);
  });
  it("separates pulley setup, attachment, physical instance and load basis", () => {
    const e = session().exercises[0];
    for (const patch of [
      { pulley: "single" },
      { pulley: "dual" },
      { attachment: "Rope" },
      { load_basis: "per_stack" },
      { position: "High" },
    ]) {
      expect(
        comparisonKey({ ...e, config: { ...e.config, ...patch } as any }),
      ).not.toBe(comparisonKey(e));
    }
    expect(comparisonKey({ ...e, instance_id: uuid() })).not.toBe(
      comparisonKey(e),
    );
  });
  it("previous performance uses most recent matching setup before current date", () => {
    const a = session("2026-10-19"),
      b = session("2026-10-21"),
      active = session("2026-10-23");
    b.exercises[0].config.pulley = "dual";
    expect(
      previousPerformance([b, a], active, active.exercises[0])?.session.id,
    ).toBe(a.id);
  });
  it("calendar totals have Monday weeks and inclusive month/year boundaries", () => {
    const now = new Date(2026, 9, 29, 12);
    expect(periodStart("week", now)).toBe("2026-10-26");
    expect(periodStart("month", now)).toBe("2026-10-01");
    expect(periodStart("year", now)).toBe("2026-01-01");
    const ss = [
      "2025-12-31",
      "2026-01-01",
      "2026-10-01",
      "2026-10-26",
      "2026-10-29",
    ].map((d) => session(d));
    expect(stats(ss).sets).toBe(5);
    expect(
      stats(ss.filter((s) => s.date >= periodStart("week", now))).sets,
    ).toBe(2);
    expect(
      stats(ss.filter((s) => s.date >= periodStart("month", now))).sets,
    ).toBe(3);
    expect(
      stats(ss.filter((s) => s.date >= periodStart("year", now))).sets,
    ).toBe(4);
  });
  it("duplicate creates a plan without manufacturing completed sets", () => {
    const s = session(),
      copy = duplicateSession(s);
    expect(copy.id).not.toBe(s.id);
    expect(copy.exercises[0].id).not.toBe(s.exercises[0].id);
    expect(copy.exercises[0].sets).toEqual([]);
    expect(copy.revision).toBe(0);
    expect(copy.status).toBe("active");
  });
  it("round trips complete workout JSON with provenance", () => {
    const s = session();
    s.source = "Test fixture";
    s.import_key = "fixture-1";
    expect(
      importSchema.parse(
        JSON.parse(JSON.stringify({ schema_version: 1, sessions: [s] })),
      ).sessions[0],
    ).toEqual(s);
  });
  it("CSV escapes quotes and spreadsheet formulas", () => {
    const s = session();
    s.name = '=HYPERLINK("bad")';
    expect(toCSV([s])).toContain("'=HYPERLINK");
    expect(toCSV([s])).toContain('""bad""');
  });
  it("seeds exactly 21 equipment models with no invented personal ratings", () => {
    const ms = initialModels();
    expect(ms).toHaveLength(21);
    expect(ms.every((m) => m.rating === null)).toBe(true);
    expect(ms.some((m) => m.model.includes("unverified"))).toBe(true);
    expect(primaryFor("Reverse pec fly", ["Chest"])).toEqual(["Rear deltoids"]);
  });
});
import { resolveNamedBundle } from "../src/friendlyImport";
it("named history imports preserve uncertain equipment and provisional load", () => {
  const data = {
    models: initialModels(),
    gyms: [],
    instances: [],
    templates: [],
    sessions: [],
  };
  const raw = {
    schema_version: 1,
    format: "named-workouts",
    equipment: [
      {
        name: "Unknown bar",
        model: "Unidentified",
        category: "EZ curl bars",
        primary: ["Biceps"],
        exercises: ["Preacher curl"],
        notes: "Bar weight unknown",
      },
    ],
    sessions: [
      {
        import_key: "fixture-history",
        name: "Recovered",
        date: "2026-10-19",
        source: "Test only",
        exercises: [
          {
            equipment_name: "Unknown bar",
            model: "Unidentified",
            exercise: "Preacher curl",
            config: { load_basis: "added_plates" },
            sets: [{ weight: 20, reps: 10 }],
          },
        ],
      },
    ],
  };
  const bundle = resolveNamedBundle(raw, data);
  expect(bundle.models).toHaveLength(22);
  expect(bundle.sessions[0].gym_id).toBeNull();
  expect(bundle.sessions[0].exercises[0].sets[0].verified).toBe(false);
  expect(bundle.sessions[0].exercises[0].config.load_basis).toBe(
    "added_plates",
  );
});
