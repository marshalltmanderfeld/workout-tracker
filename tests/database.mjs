import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
const db = new PGlite();
let checks = 0;
const check = (x, msg) => {
  assert.ok(x, msg);
  checks++;
  console.log("PASS", msg);
};
await db.exec(
  `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
await db.exec(await fs.readFile("supabase/migrations/001_initial.sql", "utf8"));
await db.exec(await fs.readFile("supabase/migrations/003_bundle.sql", "utf8"));
const a = id(),
  b = id();
await db.query("insert into auth.users values ($1),($2)", [a, b]);
async function asUser(user) {
  await db.exec(`reset role;set role authenticated;`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
await asUser(a);
const model = {
  id: id(),
  name: "Fixture machine",
  manufacturer: "Fixture",
  model: "Test",
  category: "Machine",
  nickname: "",
  primary: ["Side deltoids"],
  secondary: [],
  exercises: ["Lateral raise"],
  notes: "",
  rating: 4,
  comfort: null,
  adjustability: null,
  movement: null,
  favorite: false,
  photo: null,
};
const gyms = [1, 2].map((n) => ({
  id: id(),
  name: "Fixture gym " + n,
  location: "",
  notes: "",
  rating: null,
  favorite: false,
  photo: null,
}));
const instances = gyms.map((g, n) => ({
  id: id(),
  gym_id: g.id,
  model_id: model.id,
  notes: "Condition " + n,
  rating: n + 2,
}));
const template = {
  id: id(),
  name: "Test routine",
  position: 0,
  scheduled_date: null,
  exercises: [],
};
const bundle = {
  schema_version: 1,
  models: [model],
  gyms,
  instances,
  templates: [template],
  sessions: [],
};
await db.query("select import_bundle($1::jsonb)", [JSON.stringify(bundle)]);
check(
  (await db.query("select * from gyms")).rows.length === 2,
  "Create two gyms",
);
check(
  (await db.query("select * from instances")).rows.length === 2,
  "Link one model to two physical machines",
);
check(
  (await db.query("select rating from models")).rows[0].rating === 4,
  "Model-level preference shared",
);
check(
  (await db.query("select distinct rating from instances")).rows.length === 2,
  "Condition ratings remain separate",
);
check(
  (await db.query("select * from templates")).rows.length === 1,
  "Create workout template",
);
const e = {
  id: id(),
  model_id: model.id,
  instance_id: instances[0].id,
  name: "Lateral raise",
  equipment_name: "Snapshot name",
  primary: ["Side deltoids"],
  secondary: [],
  config: {
    pulley: "none",
    load_basis: "stack",
    attachment: "",
    position: "",
    notes: "",
  },
  skipped: false,
  notes: "",
  sets: [],
};
const s = {
  id: id(),
  name: "Fixture workout",
  date: "2026-10-19",
  started_at: "2026-10-19T12:00:00Z",
  ended_at: null,
  gym_id: gyms[0].id,
  gym_name: gyms[0].name,
  status: "active",
  notes: "",
  source: "Test fixture, not user history",
  import_key: null,
  revision: 0,
  template_id: template.id,
  exercises: [e],
};
async function save(s) {
  return (
    await db.query("select save_session($1::jsonb) as rev", [JSON.stringify(s)])
  ).rows[0].rev;
}
s.revision = await save(s);
check(s.revision === 1, "Start and persist active workout");
e.sets.push({
  id: id(),
  weight: 50,
  reps: 10,
  rir: null,
  warmup: false,
  completed: true,
  verified: true,
  approximate: false,
  notes: "",
});
s.revision = await save(s);
check(
  (await db.query("select reps from sets")).rows[0].reps === 10,
  "Log a set",
);
e.sets[0].reps = 12;
s.revision = await save(s);
check(
  (await db.query("select reps from sets")).rows[0].reps === 12,
  "Edit a set",
);
const e2 = {
  ...e,
  id: id(),
  config: { ...e.config, pulley: "dual" },
  sets: [],
};
s.exercises.unshift(e2);
s.revision = await save(s);
check(
  (await db.query("select id from session_exercises order by position")).rows[0]
    .id === e2.id,
  "Add/reorder exercises mid-session",
);
s.exercises.pop();
s.revision = await save(s);
check(
  (await db.query("select * from sets")).rows.length === 0,
  "Removing an exercise removes only its sets",
);
s.exercises.push(e);
s.revision = await save(s);
check(
  (await db.query("select * from sessions where status='active'")).rows
    .length === 1,
  "Recover unfinished cloud session",
);
await assert.rejects(() => save({ ...s, revision: 0 }), /Conflict/);
checks++;
console.log("PASS Stale update rejected");
const bad = structuredClone(s);
bad.exercises[1].sets[0].reps = 0;
await assert.rejects(() => save(bad));
check(
  (await db.query("select reps from sets")).rows[0].reps === 12,
  "Invalid set rolls back entire session transaction",
);
s.status = "completed";
s.ended_at = "2026-10-19T13:00:00Z";
s.revision = await save(s);
check(
  (await db.query("select status from sessions")).rows[0].status ===
    "completed",
  "Complete workout",
);
await db.query("update models set name='Changed' where id=$1", [model.id]);
check(
  (await db.query("select equipment_name from session_exercises limit 1"))
    .rows[0].equipment_name === "Snapshot name",
  "Historical snapshots survive catalog renames",
);
check(
  (await db.query("select distinct config from session_exercises")).rows
    .length === 2,
  "Single/default and dual configurations remain separate",
);
const imported = structuredClone(s);
imported.id = id();
imported.import_key = "test-source-1";
imported.exercises = imported.exercises.map((x) => ({
  ...x,
  id: id(),
  sets: x.sets.map((y) => ({ ...y, id: id(), verified: false })),
}));
for (let i = 0; i < 2; i++)
  await db.query("select import_sessions($1::jsonb)", [
    JSON.stringify([imported]),
  ]);
check(
  (await db.query("select * from sessions where import_key='test-source-1'"))
    .rows.length === 1,
  "Duplicate imports skipped",
);
check(
  (await db.query("select count(*)::int n from sets where verified")).rows[0]
    .n === 1,
  "Unverified imported sets excluded from records",
);
await asUser(b);
check(
  (await db.query("select * from sessions")).rows.length === 0,
  "Second user cannot read first user workouts",
);
check(
  (await db.query("select * from models")).rows.length === 0,
  "Second user cannot read first user equipment",
);
check(
  (
    await db.query("update sessions set name=$1 where id=$2 returning id", [
      "Attack",
      s.id,
    ])
  ).rows.length === 0,
  "Second user cannot update another user workout",
);
check(
  (await db.query("delete from sessions where id=$1 returning id", [s.id])).rows
    .length === 0,
  "Second user cannot delete another user workout",
);
await assert.rejects(() =>
  db.query("insert into gyms(id,user_id,name) values ($1,$2,$3)", [
    id(),
    a,
    "Attack",
  ]),
);
checks++;
console.log("PASS Forged owner rejected");
await assert.rejects(() =>
  db.query("insert into instances(id,gym_id,model_id) values ($1,$2,$3)", [
    id(),
    gyms[0].id,
    model.id,
  ]),
);
checks++;
console.log("PASS Cross-user foreign keys rejected");
await assert.rejects(() => save({ ...s, revision: 0 }));
checks++;
console.log("PASS RPC cannot overwrite another user session");
await db.exec("reset role;set role anon;");
await assert.rejects(() => db.query("select * from sessions"));
checks++;
console.log("PASS Anonymous reads denied");
await assert.rejects(() =>
  db.query("select save_session($1::jsonb)", [JSON.stringify(s)]),
);
checks++;
console.log("PASS Anonymous session RPC denied");
await asUser(a);
await db.query("select import_bundle($1::jsonb)", [JSON.stringify(bundle)]);
check(
  (await db.query("select * from models")).rows.length === 1,
  "Bundle restore is additive and idempotent",
);
await db.close();
console.log(
  `\n${checks} PostgreSQL checks passed using PGlite. Hosted Auth/Storage still require live smoke tests.`,
);
