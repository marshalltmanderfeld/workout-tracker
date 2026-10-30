# Architecture and data guarantees

## Frontend

React 19 / TypeScript / Vite 8, plain maintainable CSS, Lucide and Recharts. Node 24 is used in CI. Exact installed versions are locked in package-lock.json. GitHub Pages serves static assets only; Supabase supplies Auth, PostgreSQL and private image storage. No privileged backend secret is used by the frontend.

Vite base path is configurable through `VITE_BASE_PATH`. Navigation is in-app state instead of path routing, avoiding GitHub Pages deep-link 404 problems. The PWA shell has icons and a manifest; the service worker does not intercept API traffic or implement offline sync. A database-less build is a setup gate.

## Relations

| Table             | Purpose                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| profiles          | User display name/timezone extension point                                    |
| models            | Owner's master equipment catalog, model ratings, muscles, supported movements |
| gyms              | Gym profiles and ratings                                                      |
| instances         | Physical machine linked to a model and gym; condition notes/rating            |
| templates         | Reusable planned exercise snapshots, rotation order, optional calendar date   |
| sessions          | Actual session date, time, status, source/import key, gym snapshot, revision  |
| session_exercises | Ordered actual movements, immutable equipment/muscle/setup snapshots          |
| sets              | Ordered results, unknown load, RIR, warm-up, verification flags               |
| measurements      | Future body-weight records; no nutrition system yet                           |

The storage bucket holds private equipment/gym photos under the owner's UUID prefix. One photo per model/gym is supported initially. Workouts reference model and physical instance separately. Planned templates are JSON snapshots, while actual exercises and sets are normalized rows. Exercise definitions currently live in each model's supported-movement array; an independent normalized exercise-definition table is a future migration, not claimed as implemented.

## Security

- RLS is enabled on every personal table. `auth.uid() = user_id` policies apply to authenticated users. Anonymous table privileges are revoked.
- Composite foreign keys include user_id, preventing cross-owner parent links.
- RPCs are `SECURITY INVOKER`, use a fixed search path and require authenticated access. There is no security-definer bypass.
- `save_session` validates matching model/physical-instance/gym relationships, checks a revision, and writes session/exercises/sets in a single transaction. Bad sets roll back the transaction.
- A partial unique index allows one active workout per user. Import keys are unique per owner.
- Import RPCs lock per user, insert atomically, and skip existing session IDs/import keys. They do not replace current edits.
- Photo policies allow only the owner's directory, supported MIME types and files up to 5 MB. Signed read URLs expire after an hour; reload to refresh them. Storage policies require live Supabase verification.
- SQL numeric constraints back up frontend Zod validation. Free text is rendered as React text, not raw HTML. CSV exports guard common spreadsheet formula prefixes.

Auth access/refresh tokens use Supabase's browser persistence. Unlogged form fields use a local device buffer keyed by session ID; sign-out clears it. Do not use a shared browser profile for private training records. Completed sets and session state are not written to repository files or service-worker caches.

## Accurate comparisons

A comparison key combines equipment model, physical instance, movement, pulley mode, load basis, attachment, position and setup notes. No cross-machine weight equivalence is assumed. Confirmed totals require completed, verified, non-approximate sets on non-skipped exercises. Load records additionally require known non-assistance weights. Chart filters never turn uncertain history into confirmed records.

## Scaling and future integration

Data is paginated from Supabase (1,000 rows per request) so the default server cap does not silently truncate history. Currently the complete owner history is loaded in memory. Add server-side analytics and journal pagination before very large multiyear datasets become slow.

Future direct ChatGPT integration should expose narrow read/write endpoints through an OAuth-authenticated MCP server, derive the database user from the validated identity, enforce RLS, provide idempotency keys, and preview proposed writes before confirmation. Never give ChatGPT or a browser a service-role key. Do not claim an integration is active without testing its real authorization path.

References: Supabase RLS/API-key docs linked in SETUP.md; https://developers.openai.com/api/docs/mcp and https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt.
