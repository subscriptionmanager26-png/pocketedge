# PocketEdge performance budget

Targets for Markets, Portfolio, and Profile (logged-in, warm cache):

| Metric | Target |
|--------|--------|
| Warm tab switch p95 | ≤200ms to list/content paint |
| Cold start data (edge `/api/boot`) | ≤200ms on fast connections |
| Cold start interactive | ≤500ms |

## Instrumentation

- `performance.mark` events: `pe_auth_ready`, `pe_bootstrap_done`, `pe_tab_paint_{tab}`, `pe_data_ready_{tab}`
- PostHog event: `page_load_timing` (deferred capture after idle)

## Client caches

- `pe_social_bootstrap_v1` — profile + feed (15 min, sessionStorage)
- `pe_tab_cache_v1` — portfolios, markets preview, profile graph (15 min, sessionStorage)
- In-memory TTL via `queryCache.js` — portfolios 45s, market assets 30s

## Build checks

```bash
npm run build
npm run check:bundle
```

Budgets (gzip): `index` ≤110KB, `react-vendor` ≤55KB, `vendor` ≤130KB, `supabase` ≤70KB.

## Edge bootstrap

`index.html` starts `fetch('/api/boot')` before JS parse. Authenticated responses hydrate profile, feed, portfolios, markets preview, and follow counts via `bootstrap_app_v2` (fallback: parallel RPCs).

## Local profiling

1. Chrome DevTools → Performance → record tab switch after warm visit
2. Network → disable cache → hard reload → measure `/api/boot` + first tab RPCs
3. `ANALYZE=1 npm run build` → open `dist/stats.html`

## PostHog p95 alerts

Create an insight on event `page_load_timing`:

- **Markets / Portfolio / Profile warm paint:** filter `property tab` ∈ `{markets, portfolio, profile}` and `property phase` = `tab_paint`; aggregate p95 of `duration_ms`.
- **Cold bootstrap:** filter `property phase` = `bootstrap_done`; p95 of `duration_ms`.

Set [Alerts](https://eu.posthog.com/project/201627/alerts) when p95 exceeds 200ms (warm) or 500ms (bootstrap) for 24h.
