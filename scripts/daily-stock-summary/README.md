# Daily Stock Summary — PocketEdge Daily Brief

Two templates live here:

| Template | File | Output | Use case |
|----------|------|--------|----------|
| **Single-stock card** | `template.html` | PNG per ticker | Social posts, one stock per image |
| **Multi-stock digest** | `digest-template.html` | A4 PDF | Daily brief with 100+ stocks |

Shared branding: Inter font, black PocketEdge logo, solid `#FF6719`, website footer (`www.pocketedge.in`).

## Multi-stock digest PDF

Based on `pocketedge-brief (3).html`. One A4 page holds **8 stocks**; 100 stocks → ~13 pages.

### Data source (default)

Reads from Supabase table **`mn_daily_stock_explanations`** on the stock-news project (`imrcllmpldvjoyjyluhr`).

- Defaults to **today's date (IST)**
- If today has no rows (weekend/holiday), falls back to the latest available date

### Auth — no service role needed

Use **anon keys only** (read-only, RLS-scoped):

| Key | Project | Used for |
|-----|---------|----------|
| `VITE_STOCK_NEWS_SUPABASE_ANON_KEY` | stock-news (`imrcllmpldvjoyjyluhr`) | Daily explanations (`mn_daily_stock_explanations`) — public SELECT |
| *(none for logos)* | PocketEdge | Logos from public Storage URL pattern |

You do **not** need `SUPABASE_SERVICE_ROLE_KEY`. Logos use the public bucket:

`https://<project>.supabase.co/storage/v1/object/public/asset-logos/stock/{TICKER}/icon-256.png`

Company names come from `public/data/markets/stocks-search.json`.

### Commands

```bash
# Today (IST) from Supabase — no flags needed
npm run render:daily-brief-pdf

# Specific date
npm run render:daily-brief-pdf -- --date=2026-07-17

# Smoke test
npm run render:daily-brief-pdf -- --limit=24

# HTML only (inspect in browser)
npm run render:daily-brief-pdf -- --html-only

# Legacy CSV fallback
npm run render:daily-brief-pdf -- \
  --from-csv=~/Downloads/mn_daily_stock_explanations_openai_rows.csv \
  --date=2026-07-17
```

Outputs:
- `scripts/daily-stock-summary/out/daily-brief_<date>.html`
- `scripts/daily-stock-summary/out/daily-brief_<date>.pdf`

Requires `.env` with `VITE_STOCK_NEWS_SUPABASE_URL` and `VITE_STOCK_NEWS_SUPABASE_ANON_KEY`. Google Chrome must be installed for PDF export.

## Single-stock card

Based on `pocketedge-brief (1).html`. See `companies/_template.json` for the company facts schema.
