# Verification and remaining work

## Verified locally

- Production TypeScript + Vite build succeeds under Node 24.22.1.
- **11 unit tests** pass: invalid dates/weights/reps/RIR, zero versus unknown weight, confirmed/provisional accounting, pulley/instance comparisons, previous matching performance, week/month/year/lifetime totals, repeat-session snapshots, JSON roundtrip, CSV escaping, 21 unrated seed models, named imports with unidentified equipment.
- **28 PostgreSQL checks** pass against PGlite using migration 001 and 003: create gyms/models/instances/templates, model ratings across gyms, separate machine condition ratings, active sessions, set logging/editing, exercise reorder/removal, recovery, revision conflicts, rollback, completion, historical snapshots, distinct cable configurations, idempotent imports, provisional record exclusion, anonymous denial, and second-user read/update/delete/foreign-key/RPC isolation.
- Browser component harness: started an open workout, added a lateral raise, logged a synthetic 45 lb × 12 set, completed it, and observed one set in each applicable analytics total plus 540 lb·reps for that exact configuration. Fixture numbers are not user history.
- Desktop layout visually inspected. Setup gate rendered successfully without backend configuration.

## Not yet verified

- Hosted Supabase email signup/confirmation/sign-in/sign-out.
- Live cloud saving across devices and refresh/closure recovery through the hosted REST service.
- Supabase Storage upload and signed-photo policies (migration 002 depends on hosted Storage).
- iPhone Safari, Add to Home Screen, mobile keyboard behavior and 390px layout. A development-only responsive harness is included, but the resumed cloud browser was unavailable, so mobile QA is not claimed.
- A live GitHub Pages deployment and the final hosted URL.

The UI harness (`tests/ui.html`) uses synthetic in-memory data and is **not a production build entry point**. It must never be treated as proof that hosted authentication or cloud persistence works.

## Live acceptance checks after configuration

1. Run all migrations in an empty test Supabase project. Sign up and confirm two test users.
2. Seed the catalog as user A; create two gyms, link one model to each, rate the model and each physical machine separately.
3. Create a routine; start it; add/remove/reorder exercises; log and edit sets; refresh; sign out and back in; resume from a second device.
4. Try competing edits in two tabs. Confirm a stale revision shows a conflict, with no silent overwrite.
5. Finish a workout. Check previous performance and all date totals against a hand-counted fixture. Compare single and dual pulley configurations and verify isolation.
6. Import the same fixture twice; export full JSON; restore to a separate test user/project after checking IDs and photos. Confirm missing records are restored without replacing current edits.
7. Upload an image as A. Confirm B cannot read rows, invoke writes against A's sessions, or retrieve A's Storage object.
8. Repeat on phone and desktop in light/dark mode. Test a disconnected save: it must report failure and never claim synchronization.
9. Deploy Pages, open the URL actually returned by Actions, and repeat the primary logging flow. Delete only explicitly disposable test records; do not mix fixtures with personal history.

## Initial-release limitations

- Direct ChatGPT MCP access is not deployed or authorized. JSON preview/confirmation is the implemented integration.
- No offline edit synchronization, background sync or conflict merging; failed writes require retry/reload.
- No hosted project, credentials or Pages settings were supplied; deployment is not complete.
- One photo per model/gym; photo binaries are not included in JSON backups. Signed photo URLs require refresh after expiration.
- Workout data is normalized; exercise definitions and template plans use arrays/JSON snapshots rather than the fully normalized future catalog proposed in the brief.
- Profile table and measurements are extension points; profile/body measurement editing and nutrition tracking are not built.
- Analytics include date-filtered daily set/repetition/load/frequency/duration graphs, muscle attribution, exact-configuration records and equipment usage. Dedicated weekly/monthly aggregation charts, prior-period comparisons, rolling PR progression, statistical trend insights and average-weekly volume remain future work.
- Calendar supports selecting dated workouts; it is a month grid rather than a full scheduling calendar.
- No machine 1RM estimates. Unknown, assistance, approximate and provisional loads are not promoted into comparable load records.
- Whole history is loaded (with pagination to avoid server truncation). Large histories need server-side aggregation and incremental journal loading.

## Prioritized next steps

1. Connect Supabase, run hosted privacy/recovery smoke tests, configure Pages and verify iPhone use.
2. Review and import the separate recovered-history file; verify only the entries you can confirm.
3. Refine phone logging with actual gym use; add a rest timer, faster inline historical editing and password recovery.
4. Add weekly/monthly aggregation, prior-period comparisons and cautious trend detection.
5. Add normalized exercise definitions, multiple equipment photos and scalable server-side analytics.
6. Implement an OAuth-secured MCP service only after the core is live and the appropriate ChatGPT connection is available.
