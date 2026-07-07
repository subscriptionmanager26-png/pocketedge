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

Runs on **http://localhost:5175** (main app uses 5173).

**Auth:** First visit shows the marketing landing page. Sign up → 5-step onboarding → feed. Use `?skipAuth=1` to bypass auth during development.

## Deploy to Vercel

**Live:** https://social.pocketedge.in

**Design guide:** https://design.pocketedge.in · rules in [`DESIGN.md`](./DESIGN.md)

Vercel project: `social-pocketedge` (root directory `social`, same GitHub repo as main app).

Manual deploy from this directory:

```bash
npm exec --package=vercel@54.20.0 -- vercel deploy --prod --yes
```

Pushes to `main` also auto-deploy via the linked GitHub repo.

## Sharing code with main app

Today this app is standalone. As features grow, prefer:

- `packages/shared/` for auth helpers, types, and API clients
- Or Vite aliases into `../src/` for early experiments (tighter coupling)

Supabase, PostHog, and design tokens can be wired the same way as the main app.
