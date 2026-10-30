import { useEffect, useState } from "react";
import { Dumbbell, Star, Plus, MapPin, Search, Heart } from "lucide-react";
import {
  type Data,
  type Model,
  type Gym,
  type Instance,
  uuid,
  rows,
  muscles,
} from "./domain";
import { photoURL, uploadPhoto } from "./api";
export function Photo({ path }: { path: string | null }) {
  const [url, setURL] = useState("");
  useEffect(() => {
    setURL("");
    if (path)
      photoURL(path)
        .then(setURL)
        .catch(() => {});
  }, [path]);
  return url ? (
    <img className="equipment-photo" alt="Equipment photo" src={url} />
  ) : (
    <div className="equipment-photo placeholder">
      <Dumbbell size={42} strokeWidth={1} />
      <span>PHOTO TO COME</span>
    </div>
  );
}
export function Stars({
  value,
  onChange,
}: {
  value: number | null;
  onChange?: (n: number | null) => void;
}) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            title={`${n} stars`}
            aria-label={`${n} stars`}
            onClick={() => onChange(n === value ? null : n)}
          >
            <Star
              size={18}
              fill={n <= (value ?? 0) ? "currentColor" : "none"}
            />
          </button>
        ) : (
          <Star
            key={n}
            size={14}
            fill={n <= (value ?? 0) ? "currentColor" : "none"}
          />
        ),
      )}
      {value === null && <small>Unrated</small>}
    </span>
  );
}
export function Catalog({
  data,
  save,
  user,
  busy,
  onHistory,
}: {
  data: Data;
  save: (table: string, value: any) => Promise<void>;
  user: string;
  busy: boolean;
  onHistory: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [edit, setEdit] = useState<Model | null>(null),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const all = rows(data.sessions.filter((s) => s.status === "completed"));
  const list = data.models.filter(
    (m) =>
      `${m.name} ${m.model} ${m.manufacturer} ${m.nickname} ${m.primary.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "All" || m.category === category),
  );
  const update = (patch: Partial<Model>) =>
    edit && setEdit({ ...edit, ...patch });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">KNOW YOUR EQUIPMENT</p>
          <h1>Equipment library</h1>
          <p>One model. Every gym. All your experience in one place.</p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEdit({
              id: uuid(),
              name: "",
              manufacturer: "",
              model: "",
              category: "Custom",
              nickname: "",
              primary: [],
              secondary: [],
              exercises: [],
              notes: "",
              rating: null,
              comfort: null,
              adjustability: null,
              movement: null,
              favorite: false,
              photo: null,
            })
          }
        >
          <Plus size={16} /> Add equipment
        </button>
      </div>
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search equipment"
            placeholder="Search machines, muscles, manufacturers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Equipment category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["All", ...new Set(data.models.map((m) => m.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span>{list.length} models</span>
      </div>
      <div className="equipment-grid">
        {list.map((m) => {
          const used = all.filter((x) => x.exercise.model_id === m.id);
          return (
            <article className="card equipment" key={m.id}>
              <Photo path={m.photo} />
              <div className="equipment-content">
                <div className="section-title">
                  <span className="eyebrow">
                    {m.manufacturer} · {m.model}
                  </span>
                  <button
                    aria-label="Toggle favorite"
                    disabled={busy}
                    onClick={() =>
                      save("models", { ...m, favorite: !m.favorite })
                    }
                  >
                    <Heart
                      size={17}
                      fill={m.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <h3>{m.nickname || m.name}</h3>
                <p>{m.primary.join(" · ")}</p>
                <Stars value={m.rating} />
                <div className="equipment-foot">
                  <span>
                    {new Set(used.map((x) => x.session.id)).size} workouts ·{" "}
                    {used.length} sets
                  </span>
                  <button onClick={() => setEdit(m)}>Details</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Equipment details"
          >
            <div className="section-title">
              <h2>{edit.name || "New equipment"}</h2>
              <button
                disabled={busy || uploading}
                onClick={() => setEdit(null)}
              >
                Close
              </button>
            </div>
            <p>
              Search existing models before adding another. Similar names are
              never merged automatically.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await save("models", edit);
                  setEdit(null);
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <div className="grid two">
                {(["name", "manufacturer", "model", "nickname"] as const).map(
                  (k) => (
                    <label key={k}>
                      {k}
                      <input
                        required={k === "name"}
                        value={edit[k]}
                        onChange={(e) => update({ [k]: e.target.value })}
                      />
                    </label>
                  ),
                )}
                <label>
                  Category
                  <select
                    value={edit.category}
                    onChange={(e) => update({ category: e.target.value })}
                  >
                    {[
                      "Machine",
                      "Cable",
                      "Bench",
                      "Dumbbells",
                      "EZ curl bars",
                      "Smith machines",
                      "Attachments",
                      "Custom",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Supported exercises (comma separated)
                  <input
                    required
                    value={edit.exercises.join(",")}
                    onChange={(e) =>
                      update({ exercises: e.target.value.split(",") })
                    }
                  />
                </label>
                <label>
                  Primary muscles
                  <select
                    multiple
                    value={edit.primary}
                    onChange={(e) =>
                      update({
                        primary: Array.from(e.target.selectedOptions).map(
                          (x) => x.value,
                        ),
                      })
                    }
                  >
                    {muscles.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Secondary muscles
                  <select
                    multiple
                    value={edit.secondary}
                    onChange={(e) =>
                      update({
                        secondary: Array.from(e.target.selectedOptions).map(
                          (x) => x.value,
                        ),
                      })
                    }
                  >
                    {muscles.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Setup and personal notes
                <textarea
                  value={edit.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
              <div className="grid two">
                {(
                  ["rating", "comfort", "adjustability", "movement"] as const
                ).map((k) => (
                  <label key={k}>
                    {k === "rating" ? "Overall preference" : k}
                    <Stars
                      value={edit[k]}
                      onChange={(n) => update({ [k]: n })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Upload a private photo (JPG / PNG / WebP, up to 5 MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploading(true);
                      try {
                        update({ photo: await uploadPhoto(file, user) });
                      } catch (err) {
                        setError(String(err));
                      } finally {
                        setUploading(false);
                      }
                    }
                  }}
                />
              </label>
              <div className="actions">
                <button className="primary" disabled={busy || uploading}>
                  Save model
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onHistory(edit.id);
                    setEdit(null);
                  }}
                >
                  Workout history & records
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
export function Gyms({
  data,
  save,
  busy,
  user,
}: {
  data: Data;
  save: (table: string, value: any) => Promise<void>;
  busy: boolean;
  user: string;
}) {
  const [edit, setEdit] = useState<Gym | null>(null),
    [selected, setSelected] = useState(data.gyms[0]?.id || ""),
    [model, setModel] = useState(""),
    [condition, setCondition] = useState<Instance | null>(null),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const gym = data.gyms.find((g) => g.id === selected);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR TRAINING SPACES</p>
          <h1>My gyms</h1>
          <p>
            Shared model ratings. Separate notes for every physical machine.
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEdit({
              id: uuid(),
              name: "",
              location: "",
              notes: "",
              rating: null,
              favorite: false,
              photo: null,
            })
          }
        >
          <Plus size={16} /> Add gym
        </button>
      </div>
      <div className="grid two">
        {data.gyms.map((g) => (
          <section
            className={
              "card gym-card " + (selected === g.id ? "active-border" : "")
            }
            key={g.id}
          >
            <MapPin />
            <h2>{g.name}</h2>
            <p>{g.location || "Location not added"}</p>
            <Stars value={g.rating} />
            <p>{g.notes}</p>
            <div className="actions">
              <button onClick={() => setSelected(g.id)}>View inventory</button>
              <button onClick={() => setEdit(g)}>Edit gym</button>
            </div>
          </section>
        ))}
      </div>
      {gym && (
        <section className="card">
          <div className="section-title">
            <h2>{gym.name} inventory</h2>
            <span>
              {data.instances.filter((i) => i.gym_id === gym.id).length}{" "}
              machines
            </span>
          </div>
          <div className="actions">
            <select
              aria-label="Model to link"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">Link an existing model…</option>
              {data.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.model}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !model}
              onClick={async () => {
                await save("instances", {
                  id: uuid(),
                  gym_id: gym.id,
                  model_id: model,
                  notes: "",
                  rating: null,
                });
                setModel("");
              }}
            >
              <Plus size={16} /> Add physical machine
            </button>
          </div>
          {data.instances
            .filter((i) => i.gym_id === gym.id)
            .map((i) => {
              const m = data.models.find((m) => m.id === i.model_id);
              return (
                <div className="inventory-row" key={i.id}>
                  <Dumbbell />
                  <div>
                    <b>{m?.nickname || m?.name}</b>
                    <small>
                      Model preference: {m?.rating ?? "Unrated"} / 5 · This
                      machine’s condition: {i.rating ?? "Unrated"} / 5
                    </small>
                    <small>{i.notes || "No condition notes"}</small>
                  </div>
                  <button onClick={() => setCondition(i)}>Condition</button>
                </div>
              );
            })}
        </section>
      )}
      {edit && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-label="Edit gym"
            aria-modal="true"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save("gyms", edit);
                setSelected(edit.id);
                setEdit(null);
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            <h2>Gym details</h2>
            {error && <p className="error">{error}</p>}
            <label>
              Name
              <input
                required
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <label>
              Location
              <input
                value={edit.location}
                onChange={(e) => setEdit({ ...edit, location: e.target.value })}
              />
            </label>
            <label>
              Notes
              <textarea
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </label>
            <label>
              Gym rating
              <Stars
                value={edit.rating}
                onChange={(n) => setEdit({ ...edit, rating: n })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={edit.favorite}
                onChange={(e) =>
                  setEdit({ ...edit, favorite: e.target.checked })
                }
              />{" "}
              Favorite gym
            </label>
            <label>
              Gym photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploading(true);
                    try {
                      setEdit({
                        ...edit,
                        photo: await uploadPhoto(file, user),
                      });
                    } catch (err) {
                      setError(String(err));
                    } finally {
                      setUploading(false);
                    }
                  }
                }}
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={busy || uploading}>
                Save gym
              </button>
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {condition && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={async (e) => {
              e.preventDefault();
              await save("instances", condition);
              setCondition(null);
            }}
          >
            <h2>This machine’s condition</h2>
            <Stars
              value={condition.rating}
              onChange={(n) => setCondition({ ...condition, rating: n })}
            />
            <label>
              Maintenance & condition notes
              <textarea
                value={condition.notes}
                onChange={(e) =>
                  setCondition({ ...condition, notes: e.target.value })
                }
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={busy}>
                Save condition
              </button>
              <button type="button" onClick={() => setCondition(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
