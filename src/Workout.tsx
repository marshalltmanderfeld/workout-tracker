import { useEffect, useState } from "react";
import {
  Plus,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronRight,
  Timer,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  type Data,
  type Session,
  type Exercise,
  type SetEntry,
  uuid,
  localDate,
  newExercise,
  previousPerformance,
  duplicateSession,
  sessionSchema,
} from "./domain";
import { primaryFor } from "./catalog";
export function Workout({
  data,
  session,
  onSave,
  onTemplate,
  onDelete,
  busy,
}: {
  data: Data;
  session: Session | undefined;
  onSave: (s: Session) => Promise<Session>;
  onTemplate: (s: Session) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Session | undefined>(session),
    [selected, setSelected] = useState(0),
    [add, setAdd] = useState(""),
    [gym, setGym] = useState(data.gyms[0]?.id || ""),
    [inputs, setInputs] = useState<
      Record<
        string,
        {
          weight: string;
          reps: string;
          rir: string;
          warmup: boolean;
          notes: string;
        }
      >
    >(() => {
      try {
        return JSON.parse(
          localStorage.getItem("notebook-entry-" + session?.id) || "{}",
        );
      } catch {
        return {};
      }
    }),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<SetEntry | null>(null),
    [pending, setPending] = useState(false),
    [time, setTime] = useState(Date.now());
  useEffect(() => {
    setDraft(session);
  }, [session?.id, session?.revision]);
  useEffect(() => {
    const t = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const e = draft?.exercises[selected],
    previous =
      draft && e ? previousPerformance(data.sessions, draft, e) : undefined;
  const field = e
    ? inputs[e.id] || {
        weight: previous?.exercise.sets.at(-1)?.weight?.toString() || "",
        reps: previous?.exercise.sets.at(-1)?.reps.toString() || "",
        rir: "",
        warmup: false,
        notes: "",
      }
    : null;
  function input(key: string, value: string | boolean) {
    if (e && field) {
      const next = { ...inputs, [e.id]: { ...field, [key]: value } };
      setInputs(next);
      try {
        localStorage.setItem(
          "notebook-entry-" + draft?.id,
          JSON.stringify(next),
        );
      } catch {}
    }
  }
  async function commit(next: Session) {
    setPending(true);
    setError("");
    try {
      const saved = await onSave(next);
      setDraft(saved);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setPending(false);
    }
  }
  async function action(next: Session) {
    try {
      await commit(next);
    } catch {}
  }
  function editExercise(patch: Partial<Exercise>) {
    if (draft && e)
      void action({
        ...draft,
        exercises: draft.exercises.map((x) =>
          x.id === e.id ? { ...x, ...patch } : x,
        ),
      });
  }
  async function start(template?: Data["templates"][number]) {
    const g = data.gyms.find((x) => x.id === gym);
    if (!g) return setError("Create or select a gym first.");
    const s: Session = {
      id: uuid(),
      name: template?.name || "Open workout",
      date: localDate(),
      started_at: new Date().toISOString(),
      ended_at: null,
      gym_id: g.id,
      gym_name: g.name,
      status: "active",
      notes: "",
      source: "",
      import_key: null,
      revision: 0,
      template_id: template?.id || null,
      exercises:
        template?.exercises.map((e) => ({
          ...e,
          id: uuid(),
          instance_id:
            data.instances.find(
              (i) => i.model_id === e.model_id && i.gym_id === g.id,
            )?.id || null,
          sets: [],
          skipped: false,
        })) || [],
    };
    await action(s);
  }
  async function log() {
    if (!draft || !e || !field) return;
    try {
      const set: SetEntry = {
        id: uuid(),
        weight: field.weight === "" ? null : Number(field.weight),
        reps: Number(field.reps),
        rir: field.rir === "" ? null : Number(field.rir),
        warmup: field.warmup,
        completed: true,
        verified: true,
        approximate: false,
        notes: field.notes,
      };
      const next = sessionSchema.parse({
        ...draft,
        exercises: draft.exercises.map((x) =>
          x.id === e.id ? { ...x, sets: [...x.sets, set] } : x,
        ),
      });
      await commit(next);
      input("notes", "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  const locked = pending || busy;
  const ordered = [...data.templates].sort((a, b) => a.position - b.position);
  const last = data.sessions
    .filter((s) => s.status === "completed" && s.template_id)
    .sort((a, b) =>
      (b.ended_at || b.date).localeCompare(a.ended_at || a.date),
    )[0];
  const nextIndex = last
    ? Math.max(
        0,
        (ordered.findIndex((t) => t.id === last.template_id) + 1) %
          Math.max(1, ordered.length),
      )
    : 0;
  const rotation = [
    ...ordered.slice(nextIndex),
    ...ordered.slice(0, nextIndex),
  ];
  if (!draft)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR NEXT SESSION</p>
            <h1>Make today count.</h1>
            <p>Your rotation follows you. No fixed weekdays required.</p>
          </div>
        </div>
        <div className="grid two">
          <section className="card hero">
            <span className="pill">
              <Timer size={14} /> READY WHEN YOU ARE
            </span>
            <h2>
              A fresh start.
              <br />
              One set at a time.
            </h2>
            <p>
              Choose a routine or start an open workout. Every logged set saves
              to your private account.
            </p>
            <label>
              Where are you training?
              <select value={gym} onChange={(e) => setGym(e.target.value)}>
                {data.gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={locked}
              onClick={() => start()}
            >
              <Plus size={18} /> Start open workout
            </button>
          </section>
          <section className="card">
            <p className="eyebrow">YOUR ROTATION</p>
            <h2>Pick up where you left off</h2>
            {!data.templates.length ? (
              <div className="empty">
                Create your first routine by saving a workout as a template, or
                import a routine in Settings.
              </div>
            ) : (
              rotation.map((t, i) => (
                <button
                  className="routine"
                  key={t.id}
                  disabled={locked}
                  onClick={() => start(t)}
                >
                  <span>
                    <b>
                      {t.name}
                      {i === 0 ? " · Up next" : ""}
                    </b>
                    <small>
                      {t.exercises.length} exercises
                      {t.scheduled_date ? ` · Planned ${t.scheduled_date}` : ""}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {draft.status === "active" ? "IN PROGRESS" : "SESSION DETAILS"} ·{" "}
            {draft.gym_name}
          </p>
          <h1>{draft.name}</h1>
          <p>
            {draft.date} ·{" "}
            {draft.started_at && draft.status === "active"
              ? Math.max(
                  0,
                  Math.floor(
                    (time - new Date(draft.started_at).getTime()) / 60000,
                  ),
                ) + " min elapsed"
              : draft.status}{" "}
            ·{" "}
            {draft.exercises.reduce(
              (n, x) => n + x.sets.filter((s) => s.completed).length,
              0,
            )}{" "}
            sets logged
          </p>
        </div>
        <div className="actions">
          <button disabled={locked} onClick={() => onTemplate(draft)}>
            <Save size={16} /> Save as routine
          </button>
          {draft.status === "active" && (
            <button
              className="primary"
              disabled={locked}
              onClick={() => {
                if (confirm("Finish and save this workout?"))
                  void action({
                    ...draft,
                    status: "completed",
                    ended_at: new Date().toISOString(),
                  });
              }}
            >
              <Check size={16} /> Finish workout
            </button>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
          <p>
            Your failed change was not saved. Retry or reload to resolve a
            conflict.
          </p>
        </div>
      )}
      <div className="workout-layout">
        <aside className="card exercise-list">
          <div className="section-title">
            <h3>Session plan</h3>
            <span>{draft.exercises.length}</span>
          </div>
          {draft.exercises.map((x, i) => (
            <button
              className={"exercise-tab " + (i === selected ? "selected" : "")}
              key={x.id}
              onClick={() => setSelected(i)}
            >
              <span className="number">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <b>{x.name}</b>
                <small>
                  {x.skipped ? "Skipped" : `${x.sets.length} sets`} ·{" "}
                  {x.equipment_name}
                </small>
              </span>
            </button>
          ))}
          <label>
            Add exercise
            <select
              value={add}
              onChange={(event) => setAdd(event.target.value)}
            >
              <option value="">Choose equipment…</option>
              {data.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.name} · {m.model}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!add || locked}
            onClick={() => {
              const m = data.models.find((x) => x.id === add)!;
              const next = newExercise(
                m,
                data.instances.find(
                  (i) => i.model_id === m.id && i.gym_id === draft.gym_id,
                ),
              );
              next.primary = primaryFor(next.name, next.primary);
              void action({ ...draft, exercises: [...draft.exercises, next] });
              setSelected(draft.exercises.length);
              setAdd("");
            }}
          >
            <Plus size={16} /> Add to session
          </button>
        </aside>
        <section className="card logger">
          {e && field ? (
            <>
              <div className="section-title">
                <span className="eyebrow">
                  EXERCISE {selected + 1} / {draft.exercises.length}
                </span>
                <div className="actions">
                  <button
                    aria-label="Move exercise up"
                    disabled={locked || selected === 0}
                    onClick={() => {
                      const a = [...draft.exercises];
                      [a[selected - 1], a[selected]] = [
                        a[selected],
                        a[selected - 1],
                      ];
                      void action({ ...draft, exercises: a });
                      setSelected(selected - 1);
                    }}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label="Move exercise down"
                    disabled={locked || selected === draft.exercises.length - 1}
                    onClick={() => {
                      const a = [...draft.exercises];
                      [a[selected], a[selected + 1]] = [
                        a[selected + 1],
                        a[selected],
                      ];
                      void action({ ...draft, exercises: a });
                      setSelected(selected + 1);
                    }}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
              <h2>{e.name}</h2>
              <p>
                {e.equipment_name}{" "}
                <span className="pill">{e.primary.join(" · ")}</span>
              </p>
              <details>
                <summary>Exercise & equipment configuration</summary>
                <div className="grid two">
                  <label>
                    Movement
                    <select
                      disabled={locked || e.sets.length > 0}
                      value={e.name}
                      onChange={(event) =>
                        editExercise({
                          name: event.target.value,
                          primary: primaryFor(
                            event.target.value,
                            data.models.find((m) => m.id === e.model_id)
                              ?.primary || [],
                          ),
                        })
                      }
                    >
                      {Array.from(
                        new Set([
                          e.name,
                          ...(data.models.find((m) => m.id === e.model_id)
                            ?.exercises || []),
                        ]),
                      ).map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Physical machine
                    <select
                      disabled={locked || e.sets.length > 0}
                      value={e.instance_id || ""}
                      onChange={(event) =>
                        editExercise({
                          instance_id: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Not specified</option>
                      {data.instances
                        .filter(
                          (i) =>
                            i.model_id === e.model_id &&
                            i.gym_id === draft.gym_id,
                        )
                        .map((i, n) => (
                          <option value={i.id} key={i.id}>
                            Machine {n + 1} {i.notes.slice(0, 40)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Pulleys
                    <select
                      disabled={locked || e.sets.length > 0}
                      value={e.config.pulley}
                      onChange={(event) =>
                        editExercise({
                          config: {
                            ...e.config,
                            pulley: event.target.value as any,
                          },
                        })
                      }
                    >
                      {["none", "single", "dual"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Load means
                    <select
                      disabled={locked || e.sets.length > 0}
                      value={e.config.load_basis}
                      onChange={(event) =>
                        editExercise({
                          config: {
                            ...e.config,
                            load_basis: event.target.value as any,
                          },
                        })
                      }
                    >
                      {[
                        "stack",
                        "per_stack",
                        "combined",
                        "total",
                        "added_plates",
                        "assistance",
                        "unknown",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  {(["attachment", "position", "notes"] as const).map((k) => (
                    <label key={k}>
                      {k}
                      <input
                        disabled={locked || e.sets.length > 0}
                        defaultValue={e.config[k]}
                        key={e.id + k}
                        onBlur={(event) => {
                          if (event.target.value !== e.config[k])
                            editExercise({
                              config: { ...e.config, [k]: event.target.value },
                            });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <small>
                  Setup is locked after the first set. Add another exercise
                  entry to change machines or setup. Stack markings are not
                  measured handle resistance.
                </small>
              </details>
              <div className="previous">
                <div className="section-title">
                  <b>
                    <RotateCcw size={14} /> Previous comparable attempt
                  </b>
                  <small>{previous?.session.date || "A new baseline"}</small>
                </div>
                {previous ? (
                  <div className="previous-sets">
                    {previous.exercise.sets
                      .filter((s) => s.completed)
                      .map((s, i) => (
                        <span key={s.id}>
                          Set {i + 1}{" "}
                          <b>
                            {s.weight ?? "?"} lb × {s.reps}
                          </b>
                          {!s.verified && " · provisional"}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p>No matching exercise, machine and configuration yet.</p>
                )}
              </div>
              <div className="set-inputs">
                <label>
                  WEIGHT <span>lb</span>
                  <input
                    aria-label="Weight in pounds"
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={field.weight}
                    onChange={(event) => input("weight", event.target.value)}
                    placeholder="—"
                  />
                </label>
                <span className="multiply">×</span>
                <label>
                  REPS
                  <input
                    aria-label="Repetitions"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={field.reps}
                    onChange={(event) => input("reps", event.target.value)}
                    placeholder="—"
                  />
                </label>
                <label className="rir">
                  RIR <span>optional</span>
                  <input
                    aria-label="Reps in reserve"
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={field.rir}
                    onChange={(event) => input("rir", event.target.value)}
                    placeholder="—"
                  />
                </label>
              </div>
              <div className="actions">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={field.warmup}
                    onChange={(event) => input("warmup", event.target.checked)}
                  />{" "}
                  Warm-up set
                </label>
                <input
                  aria-label="Set note"
                  placeholder="Optional set note"
                  value={field.notes}
                  onChange={(event) => input("notes", event.target.value)}
                />
              </div>
              <button
                className="primary log-set"
                disabled={locked || e.skipped}
                onClick={log}
              >
                <Plus size={20} />
                {pending ? "Saving…" : `Log set ${e.sets.length + 1}`}
              </button>
              <div className="section-title">
                <h3>Logged sets</h3>
                <small>Saved to your account</small>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Weight</th>
                      <th>Reps</th>
                      <th>RIR</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {e.sets.map((s, i) => (
                      <tr key={s.id}>
                        <td>
                          {i + 1}
                          {s.warmup ? " W" : ""}
                        </td>
                        <td>{s.weight ?? "Unknown"} lb</td>
                        <td>{s.reps}</td>
                        <td>{s.rir ?? "—"}</td>
                        <td>
                          {s.verified ? "Confirmed" : "Provisional"}
                          {s.approximate ? " · approximate" : ""}
                        </td>
                        <td>
                          <button
                            disabled={locked}
                            onClick={() => setEditing({ ...s })}
                          >
                            Edit
                          </button>
                          <button
                            aria-label={`Delete set ${i + 1}`}
                            disabled={locked}
                            onClick={() => {
                              if (confirm("Delete this set?"))
                                editExercise({
                                  sets: e.sets.filter((x) => x.id !== s.id),
                                });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!e.sets.length && (
                  <div className="empty">Your first set starts the story.</div>
                )}
              </div>
              <div className="actions spread">
                <button
                  disabled={locked}
                  onClick={() => editExercise({ skipped: !e.skipped })}
                >
                  {e.skipped ? "Restore exercise" : "Skip exercise"}
                </button>
                <button
                  disabled={locked}
                  onClick={() => {
                    if (confirm("Remove this exercise and all its sets?")) {
                      void action({
                        ...draft,
                        exercises: draft.exercises.filter((x) => x.id !== e.id),
                      });
                      setSelected(0);
                    }
                  }}
                >
                  Remove exercise
                </button>
                <button
                  disabled={selected === draft.exercises.length - 1}
                  onClick={() => setSelected(selected + 1)}
                >
                  Next exercise <ChevronRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <Plus size={32} />
              <h2>Build your session</h2>
              <p>
                Add a machine or exercise from the session plan to start
                logging.
              </p>
            </div>
          )}
        </section>
      </div>
      <details className="card">
        <summary>Full session & details</summary>
        <div className="grid two">
          <label>
            Workout name
            <input
              defaultValue={draft.name}
              key={draft.id + "name"}
              onBlur={(event) => {
                if (event.target.value !== draft.name)
                  void action({ ...draft, name: event.target.value });
              }}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={draft.date}
              disabled={locked}
              onChange={(event) =>
                void action({ ...draft, date: event.target.value })
              }
            />
          </label>
          <label>
            Session notes
            <textarea
              key={draft.id + "notes"}
              defaultValue={draft.notes}
              onBlur={(event) => {
                if (event.target.value !== draft.notes)
                  void action({ ...draft, notes: event.target.value });
              }}
            />
          </label>
        </div>
        {draft.exercises.map((x) => (
          <p key={x.id}>
            <b>{x.name}</b> ·{" "}
            {x.skipped
              ? "Skipped"
              : x.sets
                  .map((s) => `${s.weight ?? "?"} lb × ${s.reps}`)
                  .join(" / ") || "No sets yet"}
          </p>
        ))}
        {draft.source && <p>Source: {draft.source}</p>}
        <button
          className="danger"
          disabled={locked}
          onClick={() => {
            if (confirm("Permanently delete this workout and its sets?"))
              void onDelete(draft.id);
          }}
        >
          <Trash2 size={16} /> Delete workout
        </button>
      </details>
      {editing && e && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit set"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const next = sessionSchema.parse({
                  ...draft,
                  exercises: draft.exercises.map((x) =>
                    x.id === e.id
                      ? {
                          ...x,
                          sets: x.sets.map((t) =>
                            t.id === editing.id ? editing : t,
                          ),
                        }
                      : x,
                  ),
                });
                await commit(next);
                setEditing(null);
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            <h2>Edit set</h2>
            <div className="grid two">
              <label>
                Weight (lb; blank if unknown)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editing.weight ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      weight:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Repetitions
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={editing.reps}
                  onChange={(event) =>
                    setEditing({ ...editing, reps: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                RIR (optional)
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={editing.rir ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      rir:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Notes
              <textarea
                value={editing.notes}
                onChange={(event) =>
                  setEditing({ ...editing, notes: event.target.value })
                }
              />
            </label>
            {(["warmup", "verified", "approximate", "completed"] as const).map(
              (k) => (
                <label className="checkbox" key={k}>
                  <input
                    type="checkbox"
                    checked={editing[k]}
                    onChange={(event) =>
                      setEditing({ ...editing, [k]: event.target.checked })
                    }
                  />
                  {k === "verified"
                    ? "I have verified this historical entry"
                    : k}
                </label>
              ),
            )}
            <div className="actions">
              <button className="primary" disabled={locked}>
                Save changes
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
