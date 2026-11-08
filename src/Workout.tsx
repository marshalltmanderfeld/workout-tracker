import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronRight,
  Save,
  RotateCcw,
  Search,
  Pencil,
  X,
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
  workoutError,
  duplicateSession,
  sessionSchema,
} from "./domain";
import { primaryFor } from "./catalog";
export function Workout({
  data,
  session,
  onSave,
  practice = false,
  onSaveModel,
  onTemplate,
  onDelete,
  busy,
}: {
  practice?: boolean;
  data: Data;
  session: Session | undefined;
  onSave: (s: Session) => Promise<Session>;
  onSaveModel: (model: Data["models"][number]) => Promise<void>;
  onTemplate: (s: Session) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Session | undefined>(session),
    [selected, setSelected] = useState(0),
    [query, setQuery] = useState(""),
    [finderOpen, setFinderOpen] = useState(false),
    loggerRef = useRef<HTMLElement>(null),
    finderRef = useRef<HTMLDivElement>(null),
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
      if (practice) return {};
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
  const previousSets = previous?.exercise.sets.filter((s) => s.completed && !s.warmup) || [];
  const lastLogged = e?.sets.filter((s) => s.completed && !s.warmup).at(-1);
  const suggestion = lastLogged || previousSets[Math.min(e?.sets.filter((s) => s.completed && !s.warmup).length || 0, Math.max(0, previousSets.length - 1))];
  const field = e
    ? inputs[e.id] || {
        weight: suggestion?.weight?.toString() ?? "",
        reps: suggestion?.reps.toString() ?? "",
        rir: "",
        warmup: false,
        notes: "",
      }
    : null;
  function input(key: string, value: string | boolean) {
    if (e && field) {
      const next = { ...inputs, [e.id]: { ...field, [key]: value } };
      setInputs(next);
      if (practice) return;
      try {
        localStorage.setItem(
          "notebook-entry-" + draft?.id,
          JSON.stringify(next),
        );
      } catch {}
    }
  }
  const preparing =
    !!draft &&
    draft.status === "active" &&
    !draft.exercises.some((x) => x.sets.some((s) => s.completed));
  async function commit(next: Session) {
    if (!session && next.started_at === null) {
      setDraft(next);
      setError("");
      return next;
    }
    setPending(true);
    setError("");
    try {
      const saved = await onSave(next);
      setDraft(saved);
      return saved;
    } catch (err) {
      setError(workoutError(err));
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
  async function start(template?: Data["templates"][number], first?: Exercise) {
    const g = data.gyms.find((x) => x.id === gym);
    if (!g) return setError("Create or select a gym first.");
    const s: Session = {
      id: uuid(),
      name: template?.name || "Open workout",
      date: localDate(),
      started_at: null,
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
        })) || (first ? [first] : []),
    };
    setDraft(s);
    setError("");
    showLogger(0);
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
      const loggedAt = new Date();
      const next = sessionSchema.parse({
        ...draft,
        ...(preparing
          ? { started_at: loggedAt.toISOString(), date: localDate(loggedAt) }
          : {}),
        exercises: draft.exercises.map((x) =>
          x.id === e.id ? { ...x, sets: [...x.sets, set] } : x,
        ),
      });
      await commit(next);
      // Keep the newly logged load/reps ready for the next set, without wiping manual edits.
      setInputs((current) => {
        const updated = { ...current, [e.id]: { ...field, notes: "" } };
        if (!practice) {
          try { localStorage.setItem("notebook-entry-" + draft.id, JSON.stringify(updated)); } catch {}
        }
        return updated;
      });
    } catch (err) {
      setError(workoutError(err));
    }
  }
  useEffect(() => {
    if (!finderOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !finderRef.current?.contains(event.target)
      ) {
        setFinderOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [finderOpen]);
  const normalized = (text: string) =>
    text.toLowerCase().replace(/[\s-]+/g, "");
  const matches = (...values: string[]) =>
    values.some((value) => normalized(value).includes(normalized(query)));
  const inSession = (draft?.exercises || [])
    .map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => matches(exercise.name, exercise.equipment_name));
  const available = finderOpen && query.trim()
    ? data.models.flatMap((model) =>
        (model.exercises.length ? model.exercises : [model.name])
          .filter((name) =>
            matches(name, model.nickname, model.name, model.model),
          )
          .map((name) => ({ model, name })),
      )
    : [];
  function showLogger(index: number) {
    setSelected(index);
    setFinderOpen(false);
    setQuery("");
    finderRef.current?.querySelector("input")?.blur();
    requestAnimationFrame(() =>
      loggerRef.current?.scrollIntoView({ block: "start" }),
    );
  }
  async function addMovement(model: Data["models"][number], name: string) {
    if (pending || busy) return;
    const instance = data.instances.find(
      (i) =>
        i.model_id === model.id && i.gym_id === (draft ? draft.gym_id : gym),
    );
    const next = newExercise(model, instance, name);
    next.primary = primaryFor(name, next.primary);
    if (!draft) {
      await start(undefined, next);
      return;
    }
    try {
      await commit({ ...draft, exercises: [...draft.exercises, next] });
      showLogger(draft.exercises.length);
    } catch {
      /* commit displays the save error. */
    }
  }
  const typedName = query.trim();
  const exactSession = inSession.filter(
    ({ exercise }) => normalized(exercise.name) === normalized(typedName),
  );
  const exactCatalog = available.filter(
    ({ name }) => normalized(name) === normalized(typedName),
  );
  async function createMovement() {
    if (!typedName || busy || pending) return;
    if (!draft && !gym) return setError("Choose a gym first.");
    const model: Data["models"][number] = {
      id: uuid(),
      name: typedName,
      manufacturer: "",
      model: "",
      category: "Custom",
      nickname: "",
      primary: [],
      secondary: [],
      exercises: [typedName],
      notes: "",
      rating: null,
      comfort: null,
      adjustability: null,
      movement: null,
      favorite: false,
      photo: null,
    };
    try {
      await onSaveModel(model);
      await addMovement(model, typedName);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save this exercise. Please try again.",
      );
    }
  }
  function submitSearch() {
    if (!typedName || busy || pending) return;
    if (exactSession.length) {
      if (exactSession.length === 1) showLogger(exactSession[0].index);
      return;
    }
    if (exactCatalog.length) {
      if (exactCatalog.length === 1)
        void addMovement(exactCatalog[0].model, exactCatalog[0].name);
      return;
    }
    if (inSession.length || available.length) {
      if (
        inSession.length === 1 &&
        !available.some(
          ({ model, name }) =>
            model.id !== inSession[0].exercise.model_id ||
            name !== inSession[0].exercise.name,
        )
      )
        showLogger(inSession[0].index);
      else if (!inSession.length && available.length === 1)
        void addMovement(available[0].model, available[0].name);
      return;
    }
    void createMovement();
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
  const exerciseSearch = (
    <div
      className="exercise-finder"
      ref={finderRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setFinderOpen(false);
          event.currentTarget.querySelector("input")?.blur();
        }
      }}
    >
      <label htmlFor="movement-search"><Search size={15} /> Add an exercise</label>
      <input
        id="movement-search"
        type="search"
        enterKeyHint="go"
        maxLength={200}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submitSearch();
          }
        }}
        placeholder="Search to add a movement…"
        value={query}
        aria-expanded={finderOpen}
        aria-controls="movement-results"
        onFocus={() => setFinderOpen(true)}
        onClick={() => setFinderOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setFinderOpen(true);
        }}
      />
      {finderOpen && query.trim() && (
        <div id="movement-results" className="movement-results">

          {inSession.length > 0 && <h3>In this workout</h3>}
          {inSession.map(({ exercise, index }) => (
            <button
              className="routine"
              key={exercise.id}
              disabled={locked}
              onClick={() => showLogger(index)}
            >
              <span>
                <b>{exercise.name}</b>
                <small>
                  {exercise.equipment_name} · {exercise.sets.length} sets
                </small>
              </span>
              Open
            </button>
          ))}
          {available.length > 0 && <h3>Add to workout</h3>}
          {available.map(({ model, name }) => (
            <button
              className="routine"
              key={model.id + ":" + name}
              disabled={locked}
              onClick={() => addMovement(model, name)}
            >
              <span>
                <b>{name}</b>
                <small>{model.nickname || model.name}</small>
              </span>
              <span>+ Add</span>
            </button>
          ))}
          {typedName && !exactSession.length && !exactCatalog.length && (
            <button
              className="routine"
              disabled={locked}
              onClick={createMovement}
            >
              + Create “{typedName}” and add to workout
            </button>
          )}
        </div>
      )}
    </div>
  );
  if (!draft)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Log an exercise</h1>
            <p>
              Choose a movement. Your workout starts when you log your first
              set.
            </p>
          </div>
        </div>
        <section className="card">
          {exerciseSearch}
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
        </section>
        <details className="card">
          <summary>Use a saved routine</summary>
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
        </details>
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
            {preparing
              ? "FIRST SET"
              : draft.status === "active"
                ? "IN PROGRESS"
                : "SESSION DETAILS"}{" "}
            · {draft.gym_name}
          </p>
          <h1>{preparing ? "Log your first set" : draft.name}</h1>
          <p>
            {draft.date} ·{" "}
            {!preparing && draft.started_at && draft.status === "active"
              ? Math.max(
                  0,
                  Math.floor(
                    (time - new Date(draft.started_at).getTime()) / 60000,
                  ),
                ) + " min elapsed"
              : preparing
                ? "Ready to log"
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
          {!preparing && draft.status === "active" && (
            <button
              className="primary"
              disabled={locked}
              onClick={() => {
                if (
                  confirm(
                    practice
                      ? "Finish this test workout?"
                      : "Finish and save this workout?",
                  )
                )
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
          <p>Your change was not saved.</p>
        </div>
      )}
      <div className="workout-layout">
        <aside className="card movement-picker">
          <h3>Exercises in this workout</h3>
          <div className="workout-exercise-nav">
            {draft.exercises.map((x, index) => (
              <div className={`workout-exercise-nav-item ${selected === index ? "current" : ""}`} key={x.id}>
                <button type="button" onClick={() => showLogger(index)}>
                  <b>{x.name}</b>
                  <small>{x.sets.length} {x.sets.length === 1 ? "set" : "sets"}{x.skipped ? " · skipped" : ""}</small>
                </button>
                <button type="button" className="icon-remove" disabled={locked} aria-label={`Remove ${x.name}`} title="Remove exercise" onClick={() => {
                  if (!confirm(`Remove ${x.name} and its ${x.sets.length} saved sets?`)) return;
                  void action({ ...draft, exercises: draft.exercises.filter((item) => item.id !== x.id) });
                  setSelected((current) => Math.max(0, Math.min(current > index ? current - 1 : current, draft.exercises.length - 2)));
                }}><X size={16}/></button>
              </div>
            ))}
          </div>
          {exerciseSearch}
        </aside>
        <section ref={loggerRef} className="card logger">
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
                    <RotateCcw size={14} /> Last time · weights & reps
                  </b>
                  <small>{previous?.session.date || "A new baseline"}</small>
                </div>
                {previous ? (
                  <>
                    <p>
                      {previous.session.name} · {previous.session.gym_name}
                    </p>
                    <div className="previous-sets">
                      {previous.exercise.sets
                        .filter((s) => s.completed)
                        .map((s, i) => (
                          <span key={s.id}>
                            Set {i + 1}{" "}
                            <b>
                              {s.weight === null
                                ? "Unknown weight"
                                : `${s.weight} lb`}{" "}
                              × {s.reps}
                            </b>
                            {s.warmup && " · warm-up"}
                            {!s.verified && " · unverified"}
                            {s.approximate && " · approximate"}
                            {s.notes && <small>{s.notes}</small>}
                          </span>
                        ))}
                    </div>
                    {previous.exercise.notes && (
                      <p>{previous.exercise.notes}</p>
                    )}
                    <small>
                      Reference only · same exercise, machine and setup. Log
                      each new set below.
                    </small>
                  </>
                ) : (
                  <p>
                    No earlier completed sets for this exercise, machine and
                    setup yet.
                  </p>
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
                <small>
                  {practice ? "Test sets" : "Saved to your account"}
                </small>
              </div>
              <div className="table-wrap logged-set-list">
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
                            aria-label={`Edit set ${i + 1}`}
                            onClick={() => setEditing({ ...s })}
                          >
                            <Pencil size={15} /> Edit
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
                Use the search bar above to add an exercise and start logging.
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
        <div className="session-exercise-cards">
          {draft.exercises.map((x, index) => (
            <div className="session-exercise-card" key={x.id}>
              <div className="session-exercise-head">
                <div><b>{x.name}</b><small>{x.skipped ? "Skipped" : `${x.sets.length} sets logged`}</small></div>
                <div className="actions">
                  <button disabled={locked} onClick={() => { showLogger(index); loggerRef.current?.scrollIntoView({ block: "start" }); }}><Pencil size={15}/> Edit sets</button>
                  <button disabled={locked} className="icon-remove" title="Remove exercise" aria-label={`Remove ${x.name}`} onClick={() => {
                    if (!confirm(`Remove ${x.name} and all its sets?`)) return;
                    void action({ ...draft, exercises: draft.exercises.filter((item) => item.id !== x.id) });
                    setSelected(0);
                  }}><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="session-set-chips">
                {x.sets.length ? x.sets.map((set, i) => (
                  <button key={set.id} disabled={locked} title="Edit this set" onClick={() => { setSelected(index); setEditing({ ...set }); }}>
                    <small>SET {i + 1}{set.warmup ? " · WARM-UP" : ""}</small>
                    <strong>{set.weight === null ? "—" : `${set.weight} lb`} × {set.reps}</strong>
                    <Pencil size={13}/>
                  </button>
                )) : <small>No sets logged</small>}
              </div>
            </div>
          ))}
        </div>
        {draft.source && <p>Source: {draft.source}</p>}
        <button
          className="danger"
          disabled={locked}
          onClick={() => {
            if (preparing && !session) {
              setDraft(undefined);
              setSelected(0);
              setInputs({});
              return;
            }
            if (confirm("Permanently delete this workout and its sets?"))
              void onDelete(draft.id);
          }}
        >
          <Trash2 size={16} /> {preparing ? "Discard draft" : "Delete workout"}
        </button>
      </details>
      {editing && draft && (
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
                    x.sets.some((t) => t.id === editing.id)
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
                setError(workoutError(err));
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
