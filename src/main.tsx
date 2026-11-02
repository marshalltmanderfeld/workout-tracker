import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Dumbbell,
  NotebookPen,
  ChartNoAxesCombined,
  MapPin,
  Settings as SettingsIcon,
  LogOut,
  Cloud,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { db, importBundle } from "./api";
import {
  type Data,
  type Session,
  workoutError,
  emptyData,
  uuid,
  duplicateSession,
  modelSchema,
  gymSchema,
  instanceSchema,
  templateSchema,
} from "./domain";
import { initialModels } from "./catalog";
import { Workout } from "./Workout";
import { Catalog, Gyms } from "./Catalog";
import { Analytics, Journal } from "./Analytics";
import { Settings } from "./Settings";
import "./style.css";
import { practiceStore } from "./practice";
import * as live from "./api";
function App() {
  const [user, setUser] = useState<string | null>(null),
    [authReady, setAuthReady] = useState(!db),
    [liveData, setLiveData] = useState<Data>(emptyData),
    [practiceData, setPracticeData] = useState<Data>(emptyData),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [admin, setAdmin] = useState<{ id: string; name: string } | null>(null),
    [adminMode, setAdminMode] = useState(false),
    [sandbox, setSandbox] = useState<ReturnType<typeof practiceStore> | null>(
      null,
    ),
    [practiceTheme, setPracticeTheme] = useState("system"),
    [practiceName, setPracticeName] = useState<string | null>(null),
    [page, setPage] = useState("Workout"),
    [view, setView] = useState<string | null>(null),
    [modelFilter, setModelFilter] = useState(""),
    [theme, setTheme] = useState(
      localStorage.getItem("notebook-theme") || "system",
    );
  const testing = !!sandbox && !!user && admin?.id === user && adminMode;
  const store = testing ? sandbox : live;
  const data = testing ? practiceData : liveData;
  const setData = testing ? setPracticeData : setLiveData;
  const displayTheme = testing ? practiceTheme : theme;
  function switchMode(enable: boolean) {
    if (enable && adminMode && admin?.id === user) {
      setPracticeData(structuredClone(liveData));
      setSandbox(practiceStore(liveData));
      setPracticeTheme(theme);
      setPracticeName(null);
      setPage("Workout");
    } else {
      setSandbox(null);
      setPage("Settings");
    }
    setView(null);
    setError("");
    setNotice("");
    setModelFilter("");
    window.scrollTo(0, 0);
  }
  useEffect(() => () => sandbox?.dispose(), [sandbox]);
  const lock = useRef(false);
  const userRef = useRef<string | null>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        displayTheme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : displayTheme);
    apply();
    localStorage.setItem("notebook-theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, displayTheme]);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setUser(data.session?.user.id || null);
      setAuthReady(true);
    });
    const { data: s } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.id || null);
      setAuthReady(true);
    });
    return () => s.subscription.unsubscribe();
  }, []);
  async function reload() {
    const current = userRef.current;
    if (!current) return;
    setLoading(true);
    try {
      const next = await store.loadData();
      if (userRef.current === current) setData(next);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    userRef.current = user;
    setSandbox(null);
    setAdminMode(false);
    setAdmin(null);
    let current = true;
    if (user && db) {
      void db.auth
        .getUser()
        .then(({ data: { user: account } }) => {
          if (
            current &&
            account?.id === user &&
            account.app_metadata.workout_tracker_role === "admin"
          ) {
            setAdmin({
              id: user,
              name:
                account.app_metadata.workout_tracker_display_name || "Account",
            });
          }
        })
        .catch(() => {});
    }
    setLiveData(emptyData);
    setView(null);
    if (user) void reload();
    return () => {
      current = false;
    };
  }, [user]);
  async function run<T>(job: () => Promise<T>, reportError = true): Promise<T> {
    if (lock.current)
      throw Error("A save is already in progress. Please wait.");
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await job();
      setNotice(testing ? "Saved in Test mode" : "Saved to your account");
      return value;
    } catch (e) {
      const message = workoutError(e);
      if (reportError) setError(message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(s: Session, reportError = true) {
    return run(async () => {
      const saved = await store.saveSession(s);
      setData((d) => ({
        ...d,
        sessions: [...d.sessions.filter((x) => x.id !== s.id), saved],
      }));
      if (s.status === "completed") setView(s.id);
      return saved;
    }, reportError);
  }
  async function saveEntity(table: string, value: any) {
    const schemas: any = {
      models: modelSchema,
      gyms: gymSchema,
      instances: instanceSchema,
      templates: templateSchema,
    };
    const parsed = schemas[table].parse(value);
    return run(async () => {
      await store.upsert(table, parsed);
      setData((d) => ({
        ...d,
        [table]: [
          ...(d[table as keyof Data] as any[]).filter(
            (x) => x.id !== parsed.id,
          ),
          parsed,
        ],
      }));
    });
  }
  async function initialize() {
    if (testing) return;
    return run(async () => {
      const key = `notebook-init-${user}`;
      let payload = localStorage.getItem(key);
      if (!payload) {
        const models = initialModels();
        const gym = {
          id: uuid(),
          name: "My Current Gym",
          location: "",
          notes: "Placeholder gym — add your name and location when ready.",
          rating: null,
          favorite: true,
          photo: null,
        };
        payload = JSON.stringify({
          schema_version: 1,
          models,
          gyms: [gym],
          instances: models.map((m) => ({
            id: uuid(),
            gym_id: gym.id,
            model_id: m.id,
            notes: "",
            rating: null,
          })),
          templates: [],
          sessions: [],
        });
        localStorage.setItem(key, payload);
      }
      await importBundle(JSON.parse(payload));
      localStorage.removeItem(key);
      await reload();
    });
  }
  if (!authReady)
    return (
      <div className="gate">
        <h2>Opening your notebook…</h2>
      </div>
    );
  if (!user) return <Auth configured={!!db} error={error} />;
  const isAdmin = admin?.id === user;
  const active = data.sessions.find((s) => s.status === "active");
  const session = view ? data.sessions.find((s) => s.id === view) : active;
  const nav = [
    ["Workout", Dumbbell],
    ["Journal", NotebookPen],
    ["Analytics", ChartNoAxesCombined],
    ["Equipment", Dumbbell],
    ["Gyms", MapPin],
    ["Settings", SettingsIcon],
  ] as const;
  return (
    <div className="app" key={testing ? "test" : "normal"}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Workout");
            setView(null);
          }}
        >
          <span className="brand-mark">
            <Dumbbell size={23} />
          </span>
          <span>
            workout<span className="brand-sub">NOTEBOOK</span>
          </span>
        </a>
        <p className="nav-label">YOUR TRAINING</p>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              aria-current={page === label ? "page" : undefined}
              className={page === label ? "active" : ""}
              onClick={() => {
                setPage(label);
                window.scrollTo({ top: 0, behavior: "instant" });
                if (label === "Workout") setView(null);
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
              {label === "Workout" && active && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {isAdmin && (
            <p>
              <strong>{admin.name}</strong>{" "}
              <span className="pill">
                <ShieldCheck size={14} /> Admin
              </span>
            </p>
          )}
          <div className="private">
            <ShieldCheck size={17} />
            <span>
              Private training space<small>Made for your long game.</small>
            </span>
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              if (testing) return switchMode(false);
              const { error } = await db!.auth.signOut();
              if (!error) {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("notebook-entry-"))
                  .forEach((k) => localStorage.removeItem(k));
              }
              if (error) setError(error.message);
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          {testing && (
            <button disabled={busy} onClick={() => switchMode(false)}>
              Test mode · Exit
            </button>
          )}
          <span className="desktop-tagline">YOUR TRAINING. YOUR PACE.</span>
          <strong className="mobile-page-title">{page}</strong>
          <div className="actions">
            <button
              aria-label="Sign out"
              disabled={busy}
              onClick={async () => {
                if (testing) return switchMode(false);
                const r = await db!.auth.signOut();
                if (r.error) setError(r.error.message);
                else
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith("notebook-entry-"))
                    .forEach((k) => localStorage.removeItem(k));
              }}
            >
              <LogOut size={15} />
            </button>
            <span className="sync">
              <Cloud size={15} />
              {busy ? "Saving…" : loading ? "Loading…" : "Connected"}
            </span>
            <button
              title="Refresh data"
              aria-label="Refresh data"
              disabled={busy || loading}
              onClick={reload}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main>
          <div aria-live="polite">
            {error && <div className="error">{error}</div>}
            {notice && <div className="toast">{notice}</div>}
          </div>
          {page === "Settings" && (
            <AccountUsername
              key={user}
              user={user}
              practice={testing}
              temporaryName={practiceName}
              onPracticeName={setPracticeName}
            />
          )}
          {loading && !data.gyms.length ? (
            <div className="empty">Loading your training space…</div>
          ) : !data.models.length ? (
            <section className="card welcome">
              <p className="eyebrow">LET’S GET YOU SET UP</p>
              <h1>Your notebook is ready.</h1>
              <p>
                Add the 21 Nautilus equipment entries from your guide and a
                placeholder gym. No workout history or ratings will be invented.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => initialize().catch(() => {})}
              >
                Set up my equipment <ArrowRight size={18} />
              </button>
              <p>
                If the database tables are missing, run the migrations in the
                setup guide first.
              </p>
            </section>
          ) : (
            <>
              {page === "Workout" && (
                <Workout
                  key={session?.id || "new"}
                  data={data}
                  session={session}
                  busy={busy}
                  practice={testing}
                  onSave={(s) => save(s, false)}
                  onSaveModel={(model) => saveEntity("models", model)}
                  onTemplate={async (s) => {
                    const name = prompt("Routine name", s.name);
                    if (!name) return;
                    await saveEntity("templates", {
                      id: uuid(),
                      name,
                      position: data.templates.length,
                      scheduled_date: null,
                      exercises: s.exercises.map((e) => ({
                        ...e,
                        id: uuid(),
                        sets: [],
                      })),
                    });
                  }}
                  onDelete={(id) =>
                    run(async () => {
                      await store.removeSession(id);
                      setData((d) => ({
                        ...d,
                        sessions: d.sessions.filter((x) => x.id !== id),
                      }));
                      setView(null);
                    })
                  }
                />
              )}{" "}
              {page === "Journal" && (
                <Journal
                  data={data}
                  onOpen={(s) => {
                    setView(s.id);
                    setPage("Workout");
                  }}
                  onDuplicate={async (s) => {
                    if (active) {
                      setError(
                        "Finish your active workout before repeating another session.",
                      );
                      return;
                    }
                    const saved = await save(duplicateSession(s));
                    setView(saved.id);
                    setPage("Workout");
                  }}
                />
              )}
              {page === "Analytics" && (
                <Analytics data={data} initialModel={modelFilter} />
              )}{" "}
              {page === "Equipment" && (
                <Catalog
                  data={data}
                  save={saveEntity}
                  user={user}
                  busy={busy}
                  upload={store.uploadPhoto}
                  onHistory={(id) => {
                    setModelFilter(id);
                    setPage("Analytics");
                  }}
                />
              )}
              {page === "Gyms" && (
                <Gyms
                  upload={store.uploadPhoto}
                  data={data}
                  save={saveEntity}
                  busy={busy}
                  user={user}
                />
              )}{" "}
              {page === "Settings" && isAdmin && (
                <section className="card">
                  <div className="section-title">
                    <h2>{admin.name}</h2>
                    <span className="pill">
                      <ShieldCheck size={15} /> Admin
                    </span>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={adminMode}
                      onChange={(event) => {
                        if (testing) switchMode(false);
                        setAdminMode(event.target.checked);
                      }}
                    />{" "}
                    Admin mode
                  </label>
                  {adminMode && (
                    <>
                      <h3>Test mode</h3>
                      <p>
                        Try logging a workout with your equipment. Practice sets
                        disappear when you leave.
                      </p>
                      <button
                        disabled={loading || busy}
                        onClick={() => switchMode(!testing)}
                      >
                        {testing ? "Exit Test mode" : "Enter Test mode"}
                      </button>
                    </>
                  )}
                </section>
              )}
              {page === "Settings" && (
                <Settings
                  data={data}
                  theme={displayTheme}
                  setTheme={testing ? setPracticeTheme : setTheme}
                  busy={busy}
                  save={saveEntity}
                  onImport={(sessions) =>
                    run(async () => {
                      const count = await store.importSessions(sessions);
                      await reload();
                      setNotice(
                        `${count} sessions imported; duplicates skipped.`,
                      );
                    })
                  }
                  onBundle={(bundle) =>
                    run(async () => {
                      await store.importBundle(bundle);
                      await reload();
                    })
                  }
                />
              )}
            </>
          )}
        </main>
        <footer>
          Workout Notebook <span>Small steps. A lasting record.</span>
        </footer>
      </div>
    </div>
  );
}
function AccountUsername({
  user,
  practice,
  temporaryName,
  onPracticeName,
}: {
  user: string;
  practice: boolean;
  temporaryName: string | null;
  onPracticeName: (name: string) => void;
}) {
  const [saved, setSaved] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setMessage("");
    if (practice && temporaryName) {
      setSaved(temporaryName);
      setName(temporaryName);
      return;
    }
    void db!
      .from("account_handles")
      .select("display_username")
      .eq("user_id", user)
      .single()
      .then(({ data, error }) => {
        if (!current) return;
        if (error) setMessage("Couldn’t load your username.");
        else {
          setSaved(data.display_username);
          setName(data.display_username);
        }
      });
    return () => {
      current = false;
    };
  }, [user, attempt, practice, temporaryName]);
  return (
    <section className="card">
      <h2>{saved ? "@" + saved : "Username"}</h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const username = name.trim();
          if (
            !/^[A-Za-z0-9_]{3,24}$/.test(username) ||
            (/^lifter_[0-9]+$/i.test(username) &&
              username.toLowerCase() !== saved.toLowerCase())
          ) {
            setMessage(
              "Use 3–24 letters, numbers or underscores. Names like lifter_123 are reserved.",
            );
            return;
          }
          if (practice) {
            onPracticeName(username);
            setMessage("Saved in Test mode");
            return;
          }
          setBusy(true);
          try {
            const { error } = await db!
              .from("account_handles")
              .update({ username })
              .eq("user_id", user)
              .select("display_username")
              .single();
            if (error) {
              setMessage(
                error.code === "23505"
                  ? "That username is taken. Try another."
                  : "Couldn’t save your username. Try again.",
              );
              return;
            }
            setName(username);
            setSaved(username);
            setMessage("Username saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Username
          <input
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            disabled={!saved || busy}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <small>
          Your username displays as typed. Capitalization is optional when
          signing in.
        </small>
        <div>
          <button disabled={!saved || busy || name.trim() === saved}>
            Save username
          </button>
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      {!saved && message && (
        <button onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      )}
    </section>
  );
}
async function signInByUsername(identifier: string, password: string) {
  const { data, error } = await db!.functions.invoke("username-login", {
    body: {
      username: identifier.trim().replace(/^@/, "").toLowerCase(),
      password,
    },
  });
  if (error) {
    const status = error.context?.status;
    throw new Error(
      status === 401
        ? "Incorrect username or password."
        : status === 429
          ? "Too many attempts. Try again later."
          : "Username sign-in is temporarily unavailable. Try your email.",
    );
  }
  return db!.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
}
function Auth({
  configured,
  error: initialError,
}: {
  configured: boolean;
  error: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialError);
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Dumbbell />
          </span>
          <span>
            workout<span className="brand-sub">NOTEBOOK</span>
          </span>
        </div>
        <p className="eyebrow">BUILT FOR THE LONG GAME</p>
        <h1>
          Every set.
          <br />
          Every step.
          <br />
          <em>Your story.</em>
        </h1>
        <p>
          A quieter place to track your training.
          <br />
          Know your equipment. Notice your progress.
          <br />
          Keep a record that grows with you.
        </p>
        <div className="auth-features">
          <span>
            <Dumbbell />
            Workout first
          </span>
          <span>
            <ChartNoAxesCombined />
            Progress with context
          </span>
          <span>
            <ShieldCheck />
            Private by design
          </span>
        </div>
        <div className="abstract-bars">
          {[28, 42, 36, 56, 49, 72, 64, 87, 78, 100].map((h, i) => (
            <i key={i} style={{ height: h + "%" }} />
          ))}
        </div>
      </section>
      <section className="auth-panel">
        <div className="card">
          <p className="eyebrow">YOUR PERSONAL TRAINING SPACE</p>
          <h2>
            {configured
              ? signup
                ? "Start your notebook"
                : "Welcome back"
              : "One connection to go."}
          </h2>
          {configured ? (
            <>
              <p>
                {signup
                  ? "Create your account. You can customize your username in Settings."
                  : "Sign in to pick up where you left off."}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setMessage("");
                  try {
                    const result = signup
                      ? await db!.auth.signUp({
                          email: email.trim(),
                          password,
                          options: {
                            emailRedirectTo:
                              location.origin + import.meta.env.BASE_URL,
                          },
                        })
                      : email.trim().includes("@", 1)
                        ? await db!.auth.signInWithPassword({
                            email: email.trim(),
                            password,
                          })
                        : await signInByUsername(email, password);
                    if (result.error) throw result.error;
                    if (signup && !result.data.session)
                      setMessage(
                        "Check your email to confirm your account, then sign in.",
                      );
                  } catch (err) {
                    setMessage((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  {signup ? "Email" : "Username or email"}
                  <input
                    type={signup ? "email" : "text"}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoCorrect="off"
                    autoComplete={signup ? "email" : "username"}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <div>
                  <label htmlFor="account-password">Password</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      autoComplete={
                        signup ? "new-password" : "current-password"
                      }
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-controls="account-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <button className="primary full" disabled={busy}>
                  {busy ? "Connecting…" : signup ? "Create account" : "Sign in"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => {
                  setShowPassword(false);
                  setSignup(!signup);
                }}
              >
                {signup
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
            </>
          ) : (
            <>
              <p>
                The app is built for your private Supabase database. Connect it
                to enable sign-in, equipment setup and cloud-saved workouts.
              </p>
              <ol className="setup-list">
                <li>Create a Supabase project.</li>
                <li>Run the three database migrations from this repository.</li>
                <li>
                  Add the project URL and public publishable key to the GitHub
                  Actions variables.
                </li>
                <li>Run the deployment workflow after enabling Pages.</li>
              </ol>
              <a
                className="button primary full"
                href="https://github.com/marshalltmanderfeld/workout-tracker/blob/main/docs/SETUP.md"
                target="_blank"
                rel="noreferrer"
              >
                Open setup guide <ArrowRight size={18} />
              </a>
              <p className="muted">
                No workout data is stored by this setup screen. No service-role
                key is needed in the frontend.
              </p>
            </>
          )}
          {message && (
            <p role="status" className="error">
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {});
  });
