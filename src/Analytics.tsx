import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  Layers,
  CalendarDays,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  type Data,
  type Session,
  rows,
  confirmed,
  periodStart,
  localDate,
  stats,
  comparisonKey,
  muscles,
} from "./domain";
export function Analytics({
  data,
  initialModel = "",
}: {
  data: Data;
  initialModel?: string;
}) {
  const [period, setPeriod] = useState("month"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(localDate()),
    [model, setModel] = useState(initialModel),
    [exercise, setExercise] = useState(""),
    [config, setConfig] = useState(""),
    [gym, setGym] = useState(""),
    [secondary, setSecondary] = useState(false),
    [warmup, setWarmup] = useState(false),
    [metric, setMetric] = useState("sets"),
    [selectedWeight, setSelectedWeight] = useState("");
  const total = data.sessions.filter((s) => s.status === "completed");
  const scope =
    period === "current"
      ? data.sessions.filter((s) => s.status === "active")
      : total;
  const from = period === "custom" ? start : periodStart(period);
  const to = period === "custom" ? end : localDate();
  const sessions = scope.filter(
    (s) =>
      (!from || s.date >= from) &&
      (!to || s.date <= to) &&
      (!gym || s.gym_id === gym),
  );
  const options = rows(total).filter(
    (r) =>
      (!model || r.exercise.model_id === model) &&
      (!exercise || r.exercise.name === exercise),
  );
  const filtered = rows(sessions).filter(
    (r) =>
      confirmed(r.set) &&
      (warmup || !r.set.warmup) &&
      (!model || r.exercise.model_id === model) &&
      (!exercise || r.exercise.name === exercise) &&
      (!config || comparisonKey(r.exercise) === config),
  );
  const configurations = [
    ...new Map(
      options.map((r) => [comparisonKey(r.exercise), r.exercise]),
    ).entries(),
  ];
  const canCompare = !!config;
  const chartMap = new Map<
    string,
    {
      date: string;
      sets: number;
      reps: number;
      volume: number;
      weight: number;
      duration: number;
      frequency: number;
    }
  >();
  for (const s of sessions) {
    const r = filtered.filter((x) => x.session.id === s.id);
    if (!r.length) continue;
    const old = chartMap.get(s.date) || {
      date: s.date,
      sets: 0,
      reps: 0,
      volume: 0,
      weight: 0,
      duration: 0,
      frequency: 0,
    };
    old.sets += r.length;
    old.reps += r.reduce((n, x) => n + x.set.reps, 0);
    old.volume += canCompare
      ? r.reduce((n, x) => n + (x.set.weight ?? 0) * x.set.reps, 0)
      : 0;
    old.weight = Math.max(
      old.weight,
      ...r.filter((x) => x.set.weight !== null).map((x) => x.set.weight!),
    );
    old.duration +=
      s.started_at && s.ended_at
        ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
          60000
        : 0;
    old.frequency++;
    chartMap.set(s.date, old);
  }
  const chart = [...chartMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const muscleData = muscles
    .map((name) => ({
      name,
      primary: filtered.filter(
        (x) => !x.set.warmup && x.exercise.primary.includes(name),
      ).length,
      secondary: filtered.filter(
        (x) =>
          !x.set.warmup &&
          !x.exercise.primary.includes(name) &&
          x.exercise.secondary.includes(name),
      ).length,
    }))
    .filter((x) => x.primary || x.secondary);
  const eligible = filtered.filter(
    (x) =>
      !x.set.warmup &&
      x.set.weight !== null &&
      x.exercise.config.load_basis !== "unknown" &&
      x.exercise.config.load_basis !== "assistance",
  );
  const maxWeight = eligible.length
    ? Math.max(...eligible.map((x) => x.set.weight!))
    : null;
  const maxVolume = eligible.length
    ? Math.max(...eligible.map((x) => x.set.weight! * x.set.reps))
    : null;
  const summary = stats(total);
  const week = stats(
      total.filter(
        (s) => s.date >= periodStart("week") && s.date <= localDate(),
      ),
    ),
    month = stats(
      total.filter(
        (s) => s.date >= periodStart("month") && s.date <= localDate(),
      ),
    ),
    year = stats(
      total.filter(
        (s) => s.date >= periodStart("year") && s.date <= localDate(),
      ),
    );
  const repChart = chart.map((c) => ({
    date: c.date,
    reps: Math.max(
      0,
      ...filtered
        .filter(
          (x) =>
            x.session.date === c.date &&
            String(x.set.weight) === selectedWeight,
        )
        .map((x) => x.set.reps),
    ),
  }));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIGGER PICTURE</p>
          <h1>Your work, made visible.</h1>
          <p>Real sessions. Meaningful comparisons. Progress at your pace.</p>
        </div>
        <span className="pill">
          <Activity size={14} /> CONFIRMED DATA ONLY
        </span>
      </div>
      <div className="stat-grid">
        {[
          [Layers, "Lifetime sets", summary.sets],
          [CalendarDays, "This week", week.sets],
          [Activity, "This month", month.sets],
          [TrendingUp, "This year", year.sets],
        ].map(([Icon, label, n]: any) => (
          <section className="card stat" key={label}>
            <Icon size={19} />
            <small>{label}</small>
            <strong>{n}</strong>
            <span>completed sets, including warm-ups</span>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="section-title">
          <h2>Explore your training</h2>
          <span>{filtered.length} selected sets</span>
        </div>
        <div className="filters">
          <select
            aria-label="Time range"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {[
              ["current", "Current workout"],
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
              ["year", "This year"],
              ["all", "Lifetime"],
              ["custom", "Custom dates"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
          {period === "custom" && (
            <>
              <input
                aria-label="Start date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <input
                aria-label="End date"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </>
          )}
          <select
            aria-label="Filter gym"
            value={gym}
            onChange={(e) => setGym(e.target.value)}
          >
            <option value="">All gyms</option>
            {data.gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setConfig("");
            }}
          >
            <option value="">All equipment</option>
            {data.models.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name} · {m.model}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter exercise"
            value={exercise}
            onChange={(e) => {
              setExercise(e.target.value);
              setConfig("");
            }}
          >
            <option value="">All exercises</option>
            {[...new Set(options.map((r) => r.exercise.name))].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            aria-label="Comparable configuration"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
          >
            <option value="">All setups · set counts only</option>
            {configurations.map(([key, e], i) => (
              <option key={key} value={key}>
                {e.name} · {e.equipment_name} · {e.config.pulley} ·{" "}
                {e.config.load_basis} · {e.config.attachment} ·{" "}
                {e.config.position} · setup {i + 1}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={warmup}
              onChange={(e) => setWarmup(e.target.checked)}
            />{" "}
            Include warm-ups
          </label>
        </div>
        <div className="actions">
          <select
            aria-label="Chart metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {[
              ["sets", "Sets"],
              ["reps", "Repetitions"],
              ["frequency", "Workouts"],
              ["duration", "Duration (minutes)"],
              ...(canCompare
                ? [
                    ["weight", "Highest marked load (lb)"],
                    ["volume", "Volume load (lb × reps)"],
                  ]
                : []),
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <small>
            Load graphs require one exact configuration. Unknown loads
            contribute no volume.
          </small>
        </div>
        {chart.length ? (
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey={
                    !canCompare && ["weight", "volume"].includes(metric)
                      ? "sets"
                      : metric
                  }
                  fill="#8571da"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty">
            <TrendingUp size={32} />
            <h3>A little work today. A clearer picture tomorrow.</h3>
            <p>Confirmed sets will appear here after you log a workout.</p>
          </div>
        )}
      </section>
      <div className="grid two">
        <section className="card">
          <div className="section-title">
            <h2>Where your sets go</h2>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={secondary}
                onChange={(e) => setSecondary(e.target.checked)}
              />{" "}
              Secondary
            </label>
          </div>
          <p>
            Direct working sets go to each primary target. Secondary involvement
            is separate; muscle totals are not added together as a total workout
            count.
          </p>
          {muscleData.length ? (
            <div
              className="chart"
              style={{ height: Math.max(250, muscleData.length * 30) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={muscleData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={115}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="primary" fill="#5fa89c" radius={[0, 4, 4, 0]} />
                  {secondary && <Bar dataKey="secondary" fill="#bfc9c6" />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty">
              Log working sets to see muscle coverage.
            </div>
          )}
        </section>
        <section className="card">
          <Trophy size={24} />
          <h2>Personal records</h2>
          {canCompare && eligible.length ? (
            <>
              <div className="record">
                <span>Heaviest marked load</span>
                <b>{maxWeight} lb</b>
              </div>
              <div className="record">
                <span>Highest set volume</span>
                <b>{maxVolume?.toLocaleString()} lb·reps</b>
              </div>
              <div className="record">
                <span>Highest session volume</span>
                <b>
                  {Math.max(
                    ...sessions.map((s) =>
                      eligible
                        .filter((x) => x.session.id === s.id)
                        .reduce((n, x) => n + x.set.weight! * x.set.reps, 0),
                    ),
                  ).toLocaleString()}{" "}
                  lb·reps
                </b>
              </div>
              <div className="record">
                <span>Most sets in one session</span>
                <b>
                  {Math.max(
                    ...sessions.map(
                      (s) =>
                        eligible.filter((x) => x.session.id === s.id).length,
                    ),
                  )}
                </b>
              </div>
              <label>
                Repetitions at load
                <select
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                >
                  <option value="">Select load</option>
                  {[...new Set(eligible.map((x) => x.set.weight))]
                    .sort((a, b) => a! - b!)
                    .map((w) => (
                      <option key={w} value={String(w)}>
                        {w} lb
                      </option>
                    ))}
                </select>
              </label>
              {selectedWeight && (
                <div className="chart small">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={repChart}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line dataKey="reps" stroke="#8571da" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <small>
                Records within the selected date range. Provisional,
                approximate, unknown and assistance loads are excluded. Machine
                one-rep-max estimates are intentionally omitted.
              </small>
            </>
          ) : (
            <div className="empty">
              Select one equipment configuration with confirmed working sets to
              see comparable records.
            </div>
          )}
          <hr />
          <h3>Training notes</h3>
          {["Side deltoids", "Biceps", "Triceps", "Abdominals"].map((m) => (
            <p key={m}>
              <b>{m}:</b> {muscleData.find((x) => x.name === m)?.primary || 0}{" "}
              direct working sets in this selection.
            </p>
          ))}
          <p className="muted">
            Low set counts describe the selected records, not recovery needs or
            muscle growth. More sessions are needed before interpreting trends.
          </p>
        </section>
      </div>
      <section className="card">
        <h2>Equipment usage</h2>
        {data.models
          .map((m) => ({
            m,
            count: filtered.filter((x) => x.exercise.model_id === m.id).length,
          }))
          .filter((x) => x.count)
          .sort((a, b) => b.count - a.count)
          .map(({ m, count }) => (
            <button
              className="routine"
              key={m.id}
              onClick={() => {
                setModel(m.id);
                setConfig("");
              }}
            >
              <b>{m.name}</b>
              <span>
                {count} sets <Chevron />
              </span>
            </button>
          ))}
      </section>
    </>
  );
}
function Chevron() {
  return <span>→</span>;
}
export function Journal({
  data,
  onOpen,
  onDuplicate,
}: {
  data: Data;
  onOpen: (s: Session) => void;
  onDuplicate: (s: Session) => void;
}) {
  const [q, setQ] = useState(""),
    [gym, setGym] = useState(""),
    [muscle, setMuscle] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [calendar, setCalendar] = useState(false),
    [month, setMonth] = useState(localDate().slice(0, 7));
  const sessions = data.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        (!gym || s.gym_id === gym) &&
        (!from || s.date >= from) &&
        (!to || s.date <= to) &&
        (!muscle || s.exercises.some((e) => e.primary.includes(muscle))) &&
        `${s.name} ${s.notes} ${s.exercises.map((e) => e.name + " " + e.equipment_name).join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EVERY SESSION HAS A STORY</p>
          <h1>Workout journal</h1>
          <p>
            Your history stays intact when routines and equipment names change.
          </p>
        </div>
        <button onClick={() => setCalendar(!calendar)}>
          <CalendarDays size={16} />
          {calendar ? "Timeline" : "Calendar"}
        </button>
      </div>
      <div className="filters">
        <input
          aria-label="Search workouts"
          placeholder="Search workouts, exercises, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          value={gym}
          aria-label="Gym filter"
          onChange={(e) => setGym(e.target.value)}
        >
          <option value="">Every gym</option>
          {data.gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Muscle filter"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">Every muscle</option>
          {muscles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          aria-label="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {calendar && (
        <section className="card">
          <input
            type="month"
            aria-label="Calendar month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <div className="calendar">
            {Array.from(
              {
                length: new Date(
                  Number(month.slice(0, 4)),
                  Number(month.slice(5)),
                  0,
                ).getDate(),
              },
              (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <div key={i}>
                    <b>{i + 1}</b>
                    {sessions
                      .filter((s) => s.date === date)
                      .map((s) => (
                        <button key={s.id} onClick={() => onOpen(s)}>
                          {s.name}
                        </button>
                      ))}
                  </div>
                );
              },
            )}
          </div>
        </section>
      )}
      {!sessions.length ? (
        <div className="card empty">
          <CalendarDays size={36} />
          <h2>Your journal starts here</h2>
          <p>
            Complete a workout, or review and import your earlier sessions in
            Settings.
          </p>
        </div>
      ) : (
        sessions.map((s) => (
          <article className="card journal-entry" key={s.id}>
            <div className="journal-date">
              <b>{s.date.slice(8)}</b>
              <span>
                {new Date(s.date + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div>
              <h2>{s.name}</h2>
              <p>
                {s.gym_name} · {s.exercises.length} exercises ·{" "}
                {rows([s]).length} sets
              </p>
              <small>{s.exercises.map((e) => e.name).join(" · ")}</small>
              {rows([s]).some((x) => !x.set.verified) && (
                <span className="pill">Provisional records</span>
              )}
            </div>
            <div className="actions">
              <button onClick={() => onOpen(s)}>View / edit</button>
              <button onClick={() => onDuplicate(s)}>Repeat</button>
            </div>
          </article>
        ))
      )}
    </>
  );
}
