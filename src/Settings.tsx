import { useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  FileJson,
  Sun,
  Moon,
  Monitor,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  type Data,
  type Session,
  type Template,
  importSchema,
  backupSchema,
  templateSchema,
  uuid,
  toCSV,
  newExercise,
  rows,
} from "./domain";
import { download } from "./api";
import { resolveNamedBundle } from "./friendlyImport";
export function Settings({
  data,
  theme,
  setTheme,
  onImport,
  onBundle,
  save,
  busy,
}: {
  data: Data;
  theme: string;
  setTheme: (s: string) => void;
  onImport: (s: Session[]) => Promise<void>;
  onBundle: (data: any) => Promise<void>;
  save: (table: string, value: any) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState(""),
    [review, setReview] = useState<any>(null),
    [error, setError] = useState(""),
    [kind, setKind] = useState("workouts"),
    [routine, setRoutine] = useState<Template | null>(null),
    [model, setModel] = useState("");
  function validate() {
    try {
      const raw = JSON.parse(text);
      let result: any;
      if (kind === "backup") result = backupSchema.parse(raw);
      else if (kind === "routine") result = templateSchema.parse(raw);
      else if (kind === "named") result = resolveNamedBundle(raw, data);
      else result = importSchema.parse(raw);
      const sessions = result.sessions || [];
      const models =
        kind === "backup" || kind === "named" ? result.models : data.models;
      const gyms = kind === "backup" ? result.gyms : data.gyms;
      const instances = kind === "backup" ? result.instances : data.instances;
      for (const s of sessions) {
        if (s.gym_id && !gyms.some((g: any) => g.id === s.gym_id))
          throw Error(
            `Unknown gym in ${s.name}. Use IDs from the catalog export.`,
          );
        for (const e of s.exercises) {
          if (!models.some((m: any) => m.id === e.model_id))
            throw Error(
              `Unknown equipment for ${e.name}. Use IDs from the catalog export.`,
            );
          if (
            e.instance_id &&
            !instances.some(
              (i: any) =>
                i.id === e.instance_id &&
                i.model_id === e.model_id &&
                i.gym_id === s.gym_id,
            )
          )
            throw Error(`Machine/gym mismatch for ${e.name}`);
        }
      }
      setReview(result);
      setError("");
    } catch (e) {
      setReview(null);
      setError(String(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>Settings & data</h1>
          <p>Your routines, your preferences, your history to keep.</p>
        </div>
      </div>
      <div className="grid two">
        <section className="card">
          <h2>Appearance</h2>
          <div className="segmented">
            {[
              [Sun, "light"],
              [Moon, "dark"],
              [Monitor, "system"],
            ].map(([Icon, value]: any) => (
              <button
                key={value}
                className={theme === value ? "active" : ""}
                onClick={() => setTheme(value)}
              >
                <Icon size={18} />
                {value}
              </button>
            ))}
          </div>
          <hr />
          <ShieldCheck />
          <h3>Private by design</h3>
          <p>
            Sign-in and row-level database policies scope data to your account.
            Logged changes save to Supabase. Failed writes are shown explicitly.
          </p>
          <p>
            No offline editing or automatic offline synchronization. Log sets
            while connected. Resume saved active sessions after signing in.
            Unlogged entry fields are kept on this device for convenience and
            cleared on sign-out.
          </p>
        </section>
        <section className="card">
          <h2>Keep a copy</h2>
          <p>
            Full JSON backups contain your catalog, gyms, routines,
            configurations, provenance and workouts. Photo files are separate.
          </p>
          <div className="stack">
            <button
              onClick={() =>
                download(
                  "workout-notebook-backup.json",
                  JSON.stringify({ schema_version: 1, ...data }, null, 2),
                )
              }
            >
              <Download size={18} /> Download full JSON backup
            </button>
            <button
              onClick={() =>
                download(
                  "workouts.csv",
                  toCSV(data.sessions),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={18} /> Export workout sets as CSV
            </button>
            <button
              onClick={() =>
                download(
                  "chatgpt-catalog.json",
                  JSON.stringify(
                    {
                      schema_version: 1,
                      models: data.models,
                      gyms: data.gyms,
                      instances: data.instances,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              <FileJson size={18} /> Export catalog for ChatGPT
            </button>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">FLEXIBLE, NOT FIXED</p>
            <h2>Your routine rotation</h2>
          </div>
          <button
            onClick={() =>
              setRoutine({
                id: uuid(),
                name: "",
                position: data.templates.length,
                scheduled_date: null,
                exercises: [],
              })
            }
          >
            <Plus size={16} /> Create routine
          </button>
        </div>
        {[...data.templates]
          .sort((a, b) => a.position - b.position)
          .map((t, i, all) => (
            <div className="routine" key={t.id}>
              <div>
                <b>
                  {i + 1}. {t.name}
                </b>
                <small>
                  {t.exercises.length} planned exercises ·{" "}
                  {t.scheduled_date || "Any day"}
                </small>
              </div>
              <div className="actions">
                <button
                  disabled={busy || i === 0}
                  aria-label="Move routine up"
                  onClick={async () => {
                    await save("templates", {
                      ...t,
                      position: all[i - 1].position,
                    });
                    await save("templates", {
                      ...all[i - 1],
                      position: t.position,
                    });
                  }}
                >
                  <ArrowUp size={15} />
                </button>
                <button onClick={() => setRoutine(t)}>Edit</button>
              </div>
            </div>
          ))}
      </section>
      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">CHATGPT → YOUR NOTEBOOK</p>
            <h2>Review & import</h2>
          </div>
          <Upload size={24} />
        </div>
        <p>
          Ask ChatGPT to use the documented JSON schema and IDs in your catalog
          export. Paste or upload the result here, inspect it, then confirm.
          Nothing imports automatically.
        </p>
        <select
          aria-label="Import type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setReview(null);
          }}
        >
          <option value="workouts">Workout JSON</option>
          <option value="named">Named historical workouts</option>
          <option value="routine">Routine JSON</option>
          <option value="backup">Full backup (add missing records)</option>
        </select>
        <input
          aria-label="Upload import JSON"
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 10000000) {
                setError("Maximum import size is 10 MB.");
                return;
              }
              setText(await f.text());
              setReview(null);
            }
          }}
        />
        <label>
          JSON data
          <textarea
            className="code-input"
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setReview(null);
            }}
            placeholder={'{"schema_version":1,"sessions":[…]}'}
          />
        </label>
        <button onClick={validate} disabled={!text.trim()}>
          Validate & preview
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {review && (
          <div className="import-review">
            <h3>Review proposed import</h3>
            {kind === "routine" ? (
              <p>
                {review.name}: {review.exercises.length} planned exercises
              </p>
            ) : (
              <>
                <p>
                  {review.sessions.length} sessions ·{" "}
                  {rows(review.sessions).length} sets ·{" "}
                  {rows(review.sessions).filter((x) => !x.set.verified).length}{" "}
                  provisional sets
                </p>
                {kind === "backup" && (
                  <p>
                    {review.models.length} equipment models ·{" "}
                    {review.gyms.length} gyms · {review.templates.length}{" "}
                    routines
                  </p>
                )}
                {review.sessions.map((s: Session) => (
                  <details key={s.id}>
                    <summary>
                      {s.date} · {s.name} · {s.exercises.length} exercises{" "}
                      {data.sessions.some(
                        (x) =>
                          x.id === s.id ||
                          (s.import_key && x.import_key === s.import_key),
                      )
                        ? "(already imported; skipped)"
                        : ""}
                    </summary>
                    <p>
                      Gym: {s.gym_name} · {s.status}
                    </p>
                    {s.exercises.map((e) => (
                      <p key={e.id}>
                        {e.name} / {e.equipment_name} / {e.config.pulley} /{" "}
                        {e.config.load_basis}:{" "}
                        {e.sets
                          .map(
                            (s) =>
                              `${s.weight ?? "?"} lb × ${s.reps}${s.verified ? "" : " (provisional)"}`,
                          )
                          .join("; ")}
                      </p>
                    ))}
                    <small>{s.source}</small>
                  </details>
                ))}
              </>
            )}
            <p>
              Existing sessions with the same ID or import key are skipped.
              Backups add missing records without replacing current edits.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                try {
                  if (kind === "backup" || kind === "named")
                    await onBundle(review);
                  else if (kind === "routine") await save("templates", review);
                  else await onImport(review.sessions);
                  setReview(null);
                  setText("");
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              Confirm import
            </button>
          </div>
        )}
      </section>
      {routine && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save("templates", templateSchema.parse(routine));
                setRoutine(null);
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            <h2>Routine builder</h2>
            <label>
              Name
              <input
                required
                value={routine.name}
                onChange={(e) =>
                  setRoutine({ ...routine, name: e.target.value })
                }
              />
            </label>
            <label>
              Optional scheduled date
              <input
                type="date"
                value={routine.scheduled_date || ""}
                onChange={(e) =>
                  setRoutine({
                    ...routine,
                    scheduled_date: e.target.value || null,
                  })
                }
              />
            </label>
            {routine.exercises.map((e, i) => (
              <div className="routine" key={e.id}>
                <span>
                  {i + 1}. {e.name} · {e.equipment_name}
                </span>
                <div className="actions">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const a = [...routine.exercises];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      setRoutine({ ...routine, exercises: a });
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRoutine({
                        ...routine,
                        exercises: routine.exercises.filter(
                          (x) => x.id !== e.id,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="actions">
              <select
                aria-label="Routine equipment"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">Choose equipment…</option>
                {data.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!model}
                onClick={() => {
                  setRoutine({
                    ...routine,
                    exercises: [
                      ...routine.exercises,
                      newExercise(
                        data.models.find((m) => m.id === model)!,
                        undefined,
                      ),
                    ],
                  });
                  setModel("");
                }}
              >
                Add
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="primary" disabled={busy}>
                Save routine
              </button>
              <button type="button" onClick={() => setRoutine(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
