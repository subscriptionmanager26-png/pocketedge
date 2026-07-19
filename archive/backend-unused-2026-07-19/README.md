# Archived unused backend (2026-07-19)

Removed from the **active production path** but kept in-repo so we can restore without archaeology.

## What moved here

| Path | Former location | Why unused |
|------|-----------------|------------|
| `api/equity-moving-averages.js` | `api/` | Main app uses `nse_dma_signals`, not live MA fetch |
| `lib/equity-moving-averages.mjs` | `lib/` | Same |
| `scripts/emit-*.mjs`, `apply-*.mjs` | `scripts/` | Superseded by `sync-social-market-assets.mjs` |
| `workflows/*openai*` | `.github/workflows/` | UI reads Mistral table only (`mn_daily_stock_explanations`) |
| `stock-news-migrations/*openai*` | `stock-news/migrations/` | OpenAI explanations table (not read by app) |
| `data/ibkr-*`, `ucits-*`, `justetf-*` | `data/` | Global-product leftovers after social/global split |
| `untracked-local/` | repo root (never git-tracked) | Old `portfolio-onboarding/`, `ticker-search-mock/`, large IBKR/UCITS dumps |

Also stripped from production (recover via git history of this commit):

- Vite `/api/equity-moving-averages` middleware in `vite.config.js`
- Dead helpers `classifySecurityForm`, `fetchLatestStockExplanation`
- Live DB RPCs (see migration `drop_unused_orphan_rpcs`): `archive_social_portfolio`, `get_creator_profile`, `upsert_creator_profile`

**Left in place on purpose:** `replace_nse_dma_signals`, `app_members` / `user_referrals` + referral RPCs (historical data; README allow-list).

## Restore

### Files

```bash
# From repo root — restore a single artifact
git mv archive/backend-unused-2026-07-19/api/equity-moving-averages.js api/
git mv archive/backend-unused-2026-07-19/lib/equity-moving-averages.mjs lib/
# …same pattern for scripts/, workflows/, data/, stock-news-migrations/

# Or revert the whole cleanup commit
git revert <cleanup-commit-sha>
```

After restoring the MA API, re-add the Vite middleware block from that commit’s parent (search `equity-moving-averages` in `vite.config.js` history).

### Database RPCs

Re-apply the function definitions from:

- `supabase/migrations/20260710150000_social_portfolios_local_drafts_only.sql` (`archive_social_portfolio`)
- Creator RPCs were pre-migration leftovers (no source migration in this repo); restore from DB backup / prior dump if needed.

### OpenAI explanations cron

```bash
git mv archive/backend-unused-2026-07-19/workflows/*.yml .github/workflows/
```

Script still supports `--provider=openai` in `scripts/generate-daily-stock-explanations.mjs`.
