# Daily Stock Summary — PocketEdge Daily Brief template

Production template is the **Daily Brief** card (`template.html`), based on
`pocketedge-brief (1).html`.

- **Font:** Inter only
- **Brand mark:** filled PocketEdge P logo (header + footer)
- **Stock logo:** `company.logoUrl` or ticker lettermark (`ABB` uses `assets/abb-logo.png`)

```bash
# Single
npm run render:daily-stock-summary -- \
  --data=scripts/daily-stock-summary/companies/ABB.json

# Batch 100+
npm run render:daily-stock-summary -- \
  --all \
  --from-csv=~/Downloads/mn_daily_stock_explanations_openai_rows.csv \
  --date=2026-07-17
```

Outputs: `scripts/daily-stock-summary/out/<TICKER>_<date>.png` (860px-wide card @ 2×).

See `companies/_template.json` for the company facts schema.
