# social.pocketedge

Social surface for PocketEdge — a separate Vite + React app in the same monorepo as the main product.

## Local development

From the repo root:

```bash
npm install
npm run dev:social
```

Or from this directory:

```bash
npm install
npm run dev
```

Runs on **http://localhost:5174** (main app uses 5173).

## Deploy to Vercel

1. In Vercel, create a **new project** linked to the same GitHub repo (`subscriptionmanager26-png/pocketedge`).
2. Set **Root Directory** to `social`.
3. Framework preset: **Vite** (build/output are already in `social/vercel.json`).
4. Add domain **`social.pocketedge.in`** (or `social.pocketedge` if you use that zone).
5. Copy env vars from the main project as needed (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.) when social features need auth/data.

The main app at repo root continues to deploy from `/` unchanged.

## Sharing code with main app

Today this app is standalone. As features grow, prefer:

- `packages/shared/` for auth helpers, types, and API clients
- Or Vite aliases into `../src/` for early experiments (tighter coupling)

Supabase, PostHog, and design tokens can be wired the same way as the main app.
