// Development-only component harness. Not a Vite production entry point.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Workout } from "../src/Workout";
import { Catalog, Gyms } from "../src/Catalog";
import { Analytics, Journal } from "../src/Analytics";
import { Settings } from "../src/Settings";
import { initialModels } from "../src/catalog";
import {
  uuid,
  newExercise,
  localDate,
  sessionSchema,
  type Data,
} from "../src/domain";
import "../src/style.css";
const models = initialModels(),
  gym = {
    id: uuid(),
    name: "Fixture gym",
    location: "Test only",
    notes: "",
    rating: null,
    favorite: false,
    photo: null,
  };
const instances = models.map((m) => ({
  id: uuid(),
  gym_id: gym.id,
  model_id: m.id,
  rating: null,
  notes: "",
}));
function Harness() {
  const [data, setData] = useState<Data>({
      models,
      gyms: [gym],
      instances,
      templates: [],
      sessions: [],
    }),
    [page, setPage] = useState("Workout"),
    [dark, setDark] = useState(false);
  const save = async (table: string, value: any) =>
    setData((d) => ({
      ...d,
      [table]: [
        ...(d[table as keyof Data] as any[]).filter((x) => x.id !== value.id),
        value,
      ],
    }));
  return (
    <>
      <header style={{ padding: 12, background: "#f8dd91", color: "#222" }}>
        ISOLATED TEST FIXTURES — NO CLOUD CONNECTION{" "}
        <button
          onClick={() => {
            setDark(!dark);
            document.documentElement.dataset.theme = dark ? "light" : "dark";
          }}
        >
          Toggle theme
        </button>
      </header>
      <nav className="actions">
        {[
          "Workout",
          "Equipment",
          "Gyms",
          "Journal",
          "Analytics",
          "Settings",
        ].map((p) => (
          <button onClick={() => setPage(p)} key={p}>
            {p}
          </button>
        ))}
      </nav>
      <main>
        {page === "Workout" && (
          <Workout
            data={data}
            session={data.sessions.at(-1)}
            onSave={async (s) => {
              const parsed = sessionSchema.parse(s);
              const saved = { ...parsed, revision: s.revision + 1 };
              await save("sessions", saved);
              return saved;
            }}
            onDelete={async () => {}}
            onTemplate={async () => {}}
            busy={false}
          />
        )}{" "}
        {page === "Equipment" && (
          <Catalog
            data={data}
            save={save}
            user="fixture"
            busy={false}
            onHistory={() => setPage("Analytics")}
          />
        )}{" "}
        {page === "Gyms" && (
          <Gyms data={data} save={save} user="fixture" busy={false} />
        )}{" "}
        {page === "Journal" && (
          <Journal
            data={data}
            onOpen={() => setPage("Workout")}
            onDuplicate={() => {}}
          />
        )}
        {page === "Analytics" && <Analytics data={data} />}{" "}
        {page === "Settings" && (
          <Settings
            data={data}
            theme={dark ? "dark" : "light"}
            setTheme={(t) => {
              document.documentElement.dataset.theme = t;
              setDark(t === "dark");
            }}
            onImport={async (ss) =>
              setData((d) => ({ ...d, sessions: [...d.sessions, ...ss] }))
            }
            onBundle={async () => {}}
            save={save}
            busy={false}
          />
        )}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
