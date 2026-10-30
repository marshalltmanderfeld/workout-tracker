# ChatGPT import and export contract

## Workflow

1. In Settings, export the catalog for ChatGPT. It supplies exact model, instance and gym IDs.
2. Give ChatGPT the catalog and this specification. Ask it to structure **completed** workouts only, with unknown values left null and uncertain entries marked unverified/approximate.
3. In Settings → Review & import, choose Workout JSON, upload/paste, then Validate & preview.
4. Inspect every date, exercise, load basis, gym and set. Click Confirm import only after review.
5. Correct or verify historical sets through Journal → View/edit → Edit set.

There is no active direct ChatGPT-to-database connection. Custom MCP integrations are supported by OpenAI in eligible configurations, but require a separately deployed authenticated server, OAuth and connection authorization. This account/session has no authorized Supabase integration. The implemented fallback is deliberately complete and independent of MCP.

## Machine-readable schemas

- `workout-import.schema.json` — wrapper and full workout records.
- `routine-import.schema.json` — one reusable template.
- `backup.schema.json` — complete additive backup restore.

The source of truth for validation is `src/domain.ts`. The app validates before import; SQL constraints/RLS validate persistent ownership and numeric ranges. Files are limited to 10 MB and imports to 500 sessions. Split larger histories into batches with stable IDs/import keys.

A workout import wraps `sessions` with `schema_version: 1`. Each session needs:

- Stable UUID `id`, `name`, ISO calendar `date`, `status` (`completed` or `active`).
- `gym_id` matching the user's catalog, or null; snapshot `gym_name` ("Not recorded" when unknown).
- Optional ISO UTC `started_at` and `ended_at`; null when not established. Never fabricate a time from a date.
- `source` preserving provenance; stable `import_key` for external records; `revision: 0` for a new import.
- `exercises`, each with a stable UUID, exact `model_id`, optional `instance_id`, movement `name`, snapshot `equipment_name`, primary/secondary muscle arrays, configuration, and sets.
- Each set: stable UUID, nullable numeric `weight` in pounds, integer positive `reps`, nullable RIR, `warmup`, `completed`, `verified`, `approximate` and `notes`.

Configuration fields:

| Field        | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `pulley`     | `none`, `single`, `dual`                                                           |
| `load_basis` | `stack`, `per_stack`, `combined`, `total`, `added_plates`, `assistance`, `unknown` |
| `attachment` | Exact attachment identity or empty if unspecified                                  |
| `position`   | Pulley height/position or empty if unspecified                                     |
| `notes`      | Mechanically relevant setup details                                                |

No conversion from selected stack weight to true handle force is performed. Per-stack loads are not multiplied into undocumented totals. Different physical machines remain separate in comparison keys.

## Named historical workouts

The separately supplied recovered-history file uses `format: "named-workouts"`. Choose **Named historical workouts** in Settings. It matches exact equipment `name` + `model`, with no fuzzy merging. It carries stable import keys, provenance and provisional sets. An explicit `equipment` array can define an unidentified historical setup; the review step and atomic bundle import add it without claiming it is a verified existing machine. Gym and times stay unknown in this format.

All recovered historical entries are provisional. A later clarification about one plate count must not silently rewrite an uncertain recorded set. Added plate weight must never become assumed total bar weight.

## Backup restore

Choose Full backup to restore JSON from Settings. Restore is **additive**: it adds missing models, gyms, instances, templates and sessions; existing IDs and import keys are skipped. It does not undo current edits. A conflicting second active session rejects the transaction. Use a fresh account/project for a full disaster recovery and verify counts before deleting an old database. Photo references are exported, but photo binary files and Auth users are not; export those separately in Supabase.

## Suggested ChatGPT instruction

“Use my attached catalog and the workout-import JSON schema to format the completed workout I describe. Do not invent values or treat recommendations as completed sets. Use stable UUIDs and an import key. Preserve unknown loads as null, uncertain entries as verified=false, and the documented load basis. Show a short human-readable summary for me to review, followed by JSON for the app's confirmation workflow.”
