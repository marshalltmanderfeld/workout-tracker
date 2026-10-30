# Everyday use

## Log a workout

1. Sign in, choose a gym and start an open workout or routine. If a workout is already active, it opens for recovery.
2. Add equipment from the Session plan. Select the movement and equipment configuration **before logging its first set**. For cable work, record single/dual pulleys, load basis, attachment and pulley position. For Gravitron assistance, choose `assistance`; for added plates only, choose `added_plates`.
3. Enter weight and repetitions. RIR and notes are optional. Leave weight blank if unknown. Mark warm-ups as appropriate.
4. Tap **Log set**. Wait for the save to complete. The table contains only successfully saved sets; failures are explicit. The previous comparable session is shown only when model, physical instance, movement and setup match.
5. Move between exercises freely, add another, reorder, skip, or remove with confirmation. Add a new entry to substitute equipment or change a setup after logging sets. An old entry's configuration stays fixed to protect its meaning.
6. Use **Full session & details** to inspect the whole session, change date/name or add notes.
7. **Finish workout** saves its end time. **Save as routine** preserves the plan without manufacturing historical sets.

Completed historical workouts remain editable from Journal. Use the set editor to correct values or verify imported records. Deletions require confirmation. Export a backup before large corrections.

## Routines

Create and edit routines in Settings or save an actual session as a template. Order the rotation; optionally assign a date. Home marks the routine after the last completed template as Up next. You can still choose any routine. Templates store plans separately from session snapshots, so future template changes do not rewrite the past.

## Equipment and gyms

Search the Equipment library before creating a new model. Model preferences, notes and favorites follow that model to every gym. Each gym inventory links the model to a distinct physical machine, with separate condition ratings/notes. Add a second physical instance when the gym has multiple copies. Condition notes identify them in the logger.

Upload actual model photos only. Missing pictures use a neutral placeholder, not a misleading similar machine. The calf-raise branding and F3PC revision remain unverified. Field-guide assessments are setup notes, not personal star ratings.

A machine may support multiple exercises. Select the movement in the logger. Primary targets for multi-function machines are adjusted for supported named movements; review custom model muscle choices yourself.

## Read analytics

Headline totals include completed, confirmed sets including warm-ups. Chart defaults count confirmed working sets. Provisional, approximate and incomplete sets are excluded from confirmed statistics. Muscle panels attribute working sets to primary targets and show secondary involvement separately when selected. One compound set can appear for multiple primary targets; these per-muscle figures should not be summed as a workout total.

Use one exact configuration for load charts and records. Values reflect marked stack load, documented total, assistance or added plates according to the recorded basis; they are not measured handle resistance or proof of muscle growth. Assistance loads are excluded from heaviest-load records. Machine one-rep-max estimates are omitted. Date boundaries use your browser's local timezone and Monday-based weeks.

## Backups and ChatGPT

Settings exports complete JSON or set-level CSV. JSON contains the full relational catalog and import provenance; CSV is useful for external analysis but is not a full-fidelity restore format. Store JSON exports privately. Photos must be backed up separately from Supabase Storage.

Upload the catalog export to ChatGPT so it can use the exact model/gym IDs. Ask for JSON per `IMPORTS.md`, then review and confirm it in Settings. Direct ChatGPT database access has not been enabled.
