# PocketEdge security model

## What appears in the browser (expected)

| Item | Where | Secret? |
|------|--------|---------|
| Supabase **anon** key | JS bundle + `apikey` header on `*.supabase.co` | No — publishable; RLS must enforce access |
| User **access JWT** | `Authorization` header when logged in | Session credential — protect from XSS |
| PostHog project token | Analytics requests | No — project ingest key |
| Supabase project URL | JS / preconnect | No |

Anon and service_role JWTs from the same project often share the **same JWT header** (first segment). That is normal and does **not** mean service_role is exposed. Decode the payload: `role` must be `anon` or `authenticated`, never `service_role`.

## What must NEVER appear in the browser

| Item | Used only on |
|------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel API routes, edge functions, GitHub Actions |
| `CRON_SECRET` | Vercel cron → `/api/cron/*` |
| `GITHUB_DISPATCH_TOKEN` | Vercel cron + Supabase edge `dispatch-github-workflow` |
| Edge job tokens (`x-*-refresh-token`, `x-dispatch-token`) | `pg_cron` → edge functions only |

## Auth session

- Session is stored in **localStorage** (primary) so large Supabase sessions are not truncated.
- A cookie mirror is written only when the encoded session fits under ~3.2KB (cross-subdomain OAuth handoff).
- Oversized/corrupt cookies are ignored and cleared so they cannot override a good localStorage session.
- `/api/boot` reads the cookie when present; otherwise the client hydrates from localStorage after load.
- Full httpOnly-only auth requires a Backend-for-Frontend; not enabled yet.

## Portfolio privacy

- Direct `SELECT` on `social_portfolios` is **owner-only** (RLS).
- Non-owners receive **redacted** holdings (weights / return %) via RPCs.
- Public share/OG pages use `get_public_portfolio_share` (redacted), not raw table reads.

## Reporting issues

Do not post service role keys or PATs in issues or chat logs.
