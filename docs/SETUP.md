# Connect your private database and publish

## 1. Supabase

1. Create a project in your own Supabase account. Keep the database password private.
2. In SQL Editor, run these files in order, each once:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_photos.sql`
   - `supabase/migrations/003_bundle.sql`
3. Keep email confirmation enabled under Authentication's email provider.
4. Under Authentication → URL Configuration, set the Site URL to your eventual GitHub Pages project URL, including `/workout-tracker/`. Add the same exact URL to allowed redirect URLs. Add `http://localhost:5173/` only if developing locally.
5. Find your project URL and **publishable** API key. The publishable key is intended for browser applications. Never use an `sb_secret_` key, service-role key, database password or AI API key in Vite variables.
6. For a personal-only deployment, create/confirm your account, then disable new signups if desired. RLS isolates each user's rows even if signups remain open. Configure production email delivery if Supabase's built-in email limits affect confirmation messages.

## 2. GitHub repository variables

In this repository: Settings → Secrets and variables → Actions → Variables, create:

| Name                            | Value                                   |
| ------------------------------- | --------------------------------------- |
| `VITE_SUPABASE_URL`             | Your Supabase HTTPS project URL         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your public `sb_publishable_…` key      |
| `VITE_BASE_PATH`                | `/workout-tracker/` (optional; default) |

These values are embedded in the frontend. Privacy comes from authentication and RLS, not hiding the public key.

## 3. GitHub Pages

This repository is private. GitHub Pages for private personal repositories requires an eligible plan (for example GitHub Pro). GitHub Free supports Pages for public repositories. Do not change visibility automatically; choose whether to keep the private repository on an eligible plan or approve a different hosting arrangement.

Once eligible:

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Actions → **Deploy GitHub Pages** → **Run workflow** on `main`.
3. Wait for build and deploy jobs to finish successfully. Open the actual URL returned by the deployment job; do not treat the expected URL as proof of publication.
4. Sign up, confirm your email and sign in.
5. Click **Set up my equipment**. This inserts only equipment and the placeholder gym, atomically. It does not create historical workouts.
6. Run the live acceptance checks in `VERIFICATION.md` before relying on the application at the gym.

Deployment is manual until setup and publication are intentionally enabled. Subsequent code pushes run validation automatically, but do not publish unexpectedly.

## iPhone installation

Open the deployed HTTPS URL in Safari → Share → Add to Home Screen. The manifest and icons support standalone display. The service worker does not cache private API responses or promise offline editing. Stay connected when logging.

## Official references consulted

- https://vite.dev/guide/static-deploy.html
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/redirect-urls
- https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
