# Workout Notebook

A personal React + TypeScript workout tracker with Supabase Auth/PostgreSQL, private equipment photos, and a GitHub Pages deployment workflow. Temporary app name; change the brand in `src/main.tsx`, HTML title and manifest together.

## Status

Implementation and local tests are complete for the initial release. **Live Supabase configuration and GitHub Pages activation are still required.** An unconfigured build shows an honest setup screen, not a fake workout database. No personal workout history is committed to this repository.

- [Set up Supabase and deploy](docs/SETUP.md)
- [Use the tracker](docs/USER_GUIDE.md)
- [Import workouts from ChatGPT](docs/IMPORTS.md)
- [Database and security](docs/ARCHITECTURE.md)
- [Verification and remaining work](docs/VERIFICATION.md)

## Run locally

Use Node 24 (tested with 24.22.1). Exact dependency versions are committed in `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
# Fill in your Supabase project URL and PUBLIC publishable key.
npm run dev
```

```sh
npm test
npm run test:db
npm run build
```

`npm run test:db` applies real PostgreSQL migrations to an isolated PGlite database and checks transactions, constraints and row-level security with two different roles. It does not contact or populate your account.

## Included

Workout-first logging; session recovery from the database; previous matching performance; editable sets; optional RIR; warm-ups; skip/add/remove/reorder exercises; template rotation and optional dates; equipment master models and physical gym instances; 21 Nautilus seed models; model and condition ratings; private uploads; searchable journal and calendar; interactive filtered set/muscle/performance charts; comparable personal records; JSON/CSV exports; validated review-before-import; additive backup restore; light/dark/system modes; PWA metadata.

The application deliberately requires an internet connection to save. The database is authoritative; unlogged input fields are only a local convenience buffer, cleared on sign-out. No service-role or AI secret belongs in this project.

## Maintainability

- `src/domain.ts`: types, validation, date ranges, comparisons, CSV.
- `src/api.ts`: Supabase boundary and paginated retrieval.
- `src/Workout.tsx`: active and historical workout editing.
- `src/Catalog.tsx`: equipment and gym inventory management.
- `src/Analytics.tsx`: analytics and journal.
- `src/Settings.tsx`: routines, imports, exports, appearance.
- `src/friendlyImport.ts`: exact-name historical import resolver.
- `supabase/migrations/`: apply in numeric order, once.
- `tests/`: fixtures are synthetic and never part of your production data.

Do not make the repository public merely to enable Pages without reviewing the account/hosting choice first.
