import { useEffect, useRef, useState } from "react";
import type { Session } from "../domain";
import { defaultRoom as room, entrance } from "./room";
import { equipment } from "./equipment";
import { drawRoom } from "./renderer";
import { replaySets } from "./replay";
import "./pixel.css";
export function PixelGym({ sessions }: { sessions: Session[] }) {
  const workouts = sessions
    .filter((s) => s.status === "completed")
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.started_at || "").localeCompare(a.started_at || ""),
    );
  const [chosen, choose] = useState(""),
    [step, setStep] = useState(0),
    [inspect, setInspect] = useState(false),
    [picked, pick] = useState(room.placements[0].id);
  const session = workouts.find((s) => s.id === chosen) || workouts[0],
    frames = replaySets(session, room);
  const index = Math.min(step, Math.max(0, frames.length - 1)),
    frame = frames[index];
  const item = room.placements.find((p) => p.id === picked)!,
    def = equipment.get(item.type)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const actor = inspect ? entrance : frame?.target.pose || entrance;
  const highlight = inspect ? picked : frame?.target.placement || null;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx)
      drawRoom(ctx, room, { x: actor.x, y: actor.y }, highlight, inspect);
  }, [actor.x, actor.y, highlight, inspect]);
  return (
    <section className="pixel-page">
      <header>
        <h1>Pixel Gym</h1>
        <p>Your virtual training room</p>
      </header>
      <div className="pixel-layout">
        <figure>
          <canvas
            ref={canvas}
            width={room.width * room.tile}
            height={room.height * room.tile}
            aria-label="Top-down gym with a mirror and dumbbell rack, central cable crossover, and four training areas"
            onClick={(ev) => {
              if (!inspect) return;
              const r = ev.currentTarget.getBoundingClientRect();
              const x = ((ev.clientX - r.left) * room.width) / r.width,
                y = ((ev.clientY - r.top) * room.height) / r.height;
              const hit = room.placements.find((p) => {
                const d = equipment.get(p.type)!;
                return (
                  x >= p.x &&
                  x < p.x + d.width &&
                  y >= p.y &&
                  y < p.y + d.height
                );
              });
              if (hit) pick(hit.id);
            }}
          />
          <figcaption>
            {inspect
              ? "Tile inspection · shaded machine footprints"
              : frame
                ? frame.target.label
                : "Gym entrance"}
          </figcaption>
        </figure>
        <aside className="card">
          <div className="actions">
            <button aria-pressed={!inspect} onClick={() => setInspect(false)}>
              Workout preview
            </button>
            <button aria-pressed={inspect} onClick={() => setInspect(true)}>
              Inspect room
            </button>
          </div>
          {inspect ? (
            <>
              <h2>Room layout</h2>
              <label>
                Equipment
                <select value={picked} onChange={(e) => pick(e.target.value)}>
                  {room.placements.map((p) => (
                    <option key={p.id} value={p.id}>
                      {equipment.get(p.type)!.name} · {p.x}, {p.y}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {def.width} × {def.height} tiles · {def.stations.length}{" "}
                interaction {def.stations.length === 1 ? "station" : "stations"}
              </p>
              {def.stations.map((s) => (
                <p key={s.id}>
                  <b>{s.id === "main" ? def.name : s.id}</b>
                  <br />
                  {s.exercises.join(" · ")}
                </p>
              ))}
            </>
          ) : (
            <>
              <h2>Workout preview</h2>
              {session ? (
                <>
                  <label>
                    Completed workout
                    <select
                      value={session.id}
                      onChange={(e) => {
                        choose(e.target.value);
                        setStep(0);
                      }}
                    >
                      {workouts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.date} · {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {frame ? (
                    <div aria-live="polite">
                      <small>
                        Set {index + 1} of {frames.length}
                      </small>
                      <h3>{frame.name}</h3>
                      <p>
                        {frame.weight === null
                          ? "Weight unknown"
                          : frame.weight + " lb"}{" "}
                        × {frame.reps} reps · {frame.basis.replaceAll("_", " ")}
                        {frame.warmup ? " · warm-up" : ""}
                        {frame.provisional ? " · provisional" : ""}
                        {frame.approximate ? " · approximate" : ""}
                      </p>
                      <div className="actions">
                        <button
                          disabled={index === 0}
                          onClick={() => setStep(index - 1)}
                        >
                          Previous set
                        </button>
                        <button
                          disabled={index + 1 >= frames.length}
                          onClick={() => setStep(index + 1)}
                        >
                          Next set
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>This workout has no completed sets.</p>
                  )}
                </>
              ) : (
                <p>
                  Finish a workout to preview its sets here. You can inspect the
                  room now.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
