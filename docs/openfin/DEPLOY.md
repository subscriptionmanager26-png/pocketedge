# OpenFin deployment

OpenFin is the public open-data product surface for PocketEdge: product directory, fund holdings API docs, and community roadmap.

**Canonical URL:** https://openfin.pocketedge.in

OpenFin is **independent** from the PocketEdge social app (`www.pocketedge.in`). They share this Git repo and build, but deploy from **separate Vercel projects** so social production deploys cannot overwrite the OpenFin subdomain.

## Vercel projects

| Project | Domains | Production branch | Purpose |
|---------|---------|-------------------|---------|
| `openfin-pocketedge` | `openfin.pocketedge.in` | **`fix/openfin-subdomain`** | OpenFin only |
| `social-pocketedge` | `www.pocketedge.in`, `pocketedge.in` | `main` | Social app |

**Do not** attach `openfin.pocketedge.in` to `social-pocketedge`. Social team deploys to `main` must not control the OpenFin subdomain.

### Pin production branch (required)

In Vercel → **openfin-pocketedge** → Settings → Git → **Production Branch**, set:

`fix/openfin-subdomain`

Until OpenFin routing is merged to `main`, never point this project at `main` or social feature branches. A deploy from a branch without `OpenFinApp` ships the social SPA and `/` lands on `/feed`.

## Build guard

`scripts/verify-openfin-build.mjs` runs at the start of `npm run build`. When `VERCEL_PROJECT_NAME=openfin-pocketedge`, the build **fails** if:

- `src/OpenFinApp.jsx` or `src/lib/openfinHost.js` is missing
- `src/main.jsx` does not wire `isOpenFinHost()` → `OpenFinApp`

Social builds (`social-pocketedge`) skip this check.

## Routes

| Path | Page |
|------|------|
| `/` | Product directory |
| `/docs` | API documentation |
| `/roadmap` | Public kanban roadmap |

Legacy paths redirect:

- `www.pocketedge.in/openfin` → `openfin.pocketedge.in/`
- `www.pocketedge.in/openfin/api` → `openfin.pocketedge.in/docs`
- `openfin.pocketedge.in/openfin/*` → clean paths above
- `openfin.pocketedge.in/feed` (and other social paths) → `/` or www

## API

Fund holdings JSON API is served at `/api/v1/*` on **both** hosts:

- https://openfin.pocketedge.in/api/v1
- https://www.pocketedge.in/api/v1

No API key is required for read access.

## Environment variables

Set on **`openfin-pocketedge`** (and optionally on social for `/api/v1` on www):

- `OPENFIN_SUPABASE_URL` — e.g. `https://<ref>.supabase.co`
- `OPENFIN_SUPABASE_ANON_KEY` — anon key (public read on usage table)
- `OPENFIN_SUPABASE_SERVICE_ROLE_KEY` — service role (RPC increment only)

Do **not** use the PocketEdge social Supabase project for OpenFin analytics.

Apply migrations from `supabase/openfin/migrations/` to the OpenFin Supabase project.

## Deploy OpenFin

1. Merge OpenFin UI + API changes into **`fix/openfin-subdomain`** and push.
2. Vercel auto-deploys **`openfin-pocketedge`** from that branch.
3. Or manual: `npx vercel deploy --prod` with `.vercel/project.json` pointing at `openfin-pocketedge`.

Host-based app selection lives in `src/main.jsx` (`isOpenFinHost()` → `OpenFinApp`).

## Checklist before merging social work

- [ ] OpenFin files still present on the branch deployed to `openfin-pocketedge`
- [ ] `openfin.pocketedge.in` domain still on `openfin-pocketedge`, not `social-pocketedge`
- [ ] Production branch for `openfin-pocketedge` is still `fix/openfin-subdomain`

## Local development

- Main app: `npm run dev` → http://localhost:5173
- OpenFin UI: add `127.0.0.1 openfin.pocketedge.in` to `/etc/hosts`, then open http://openfin.pocketedge.in:5173

## Key files

- `src/lib/openfinHost.js` — host detection and URL helpers
- `src/OpenFinApp.jsx` — subdomain router
- `src/pages/marketing/OpenFinPage.jsx` — UI
- `scripts/verify-openfin-build.mjs` — blocks bad OpenFin deploys
- `api/_lib/openfinSupabaseServer.ts` — OpenFin Supabase env
- `public/data/openfin-roadmap.json` — roadmap kanban data
- `vercel.json` — legacy redirects and `/api/v1` rewrites
