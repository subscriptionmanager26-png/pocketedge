# IBKR fetch ladder analysis

**Date:** 2026-07-09  
**Project:** pocketedge (Supabase)  
**Data window:** 2026-06-23 → 2026-07-09 (35 completed universe fetch runs)  
**Sources:** `ibkr_fetch_ladder_ticker_summary`, `ibkr_fetch_ladder_results` (last 7 days raw), `universe_price_fetch_runs`

---

## Executive summary

- **95.4%** of ticker-fetch attempts get a price.
- **Step 3 (`preflight_1`)** is the main workhorse — **47.4%** of all priced tickers.
- **Step 1** is negligible (**0.01%**); step 2 is a second no-preflight pass that recovers **31.7%** (IBKR snapshot flakiness, not different logic).
- Failures cluster by **venue** (FWB, SWB, TASE, MOEX, OTC) — not random.
- **1,962 tickers** never price after 3+ runs (blacklist candidates).
- **UCITS** fails slightly **less** than non-UCITS (3.3% vs 4.6%).

---

## Headline numbers

| Metric | Value |
|---|---|
| Completed fetch runs | 35 |
| Ticker-fetch attempts (runs table) | ~2.26M |
| Overall success rate | **95.4%** |
| Overall failure rate | **4.6%** (~52k in archived window) |
| Tickers always priced (5+ runs, 0 fails) | **65,575** |
| Tickers never priced (3+ runs, 100% fail) | **1,962** |
| Yahoo rescue (step 5) | **7.8%** of priced tickers |

---

## Step distribution (what works)

| Step | Label | Share of priced tickers |
|---|---|---|
| 1 | `no_preflight_initial` | **0.01%** |
| 2 | `no_preflight_retry` | **31.7%** |
| 3 | `preflight_1` | **47.4%** |
| 4 | `preflight_2` | **13.1%** |
| 5 | `yahoo_backup` | **7.8%** |

Step labels live in `lib/ladder-steps.js` (not stored per ladder row).

### Why step 2 works when step 1 “doesn’t”

Steps 1 and 2 use **identical** IBKR snapshot config (`preflightCount: 0`). Step 2 is a **second pass** on misses only. IBKR field `31` is often empty on the first snapshot and populated on retry — plus batch failures, rate limits, and time delay between full-universe passes.

---

## Fetch slot comparison

| Slot | Avg missing % | Step 3 share | Yahoo share |
|---|---|---|---|
| **overnight** | **2.8%** | 33% | **17%** |
| **us_close** | **6.1%** | **50%** | 11% |

`us_close` needs more preflight (steps 3–4) and still fails more — likely market-hours / liquidity timing.

---

## Best venues (low failure)

| Exchange | Fail % | Notes |
|---|---|---|
| ARCA | **0.06%** | Excellent |
| SEHK | **0.43%** | |
| TWSE | **0.35%** | |
| NYSE | **0.79%** | |
| NASDAQ | **0.85%** | |
| LSEETF | **0.76%** | |

### US liquid (NASDAQ / NYSE / ARCA) step mix

| Step | Share of priced |
|---|---|
| Step 2 only | **48.7%** |
| Step 3 | **35.0%** |
| Step 4 | **10.3%** |
| Yahoo (5) | **6.0%** |

---

## Worst venues (high failure)

| Exchange | Fail % | Volume (runs) | Yahoo share of priced |
|---|---|---|---|
| MOEX | **27.5%** | 1,624 | 0.3% |
| SWB | **25.2%** | 10,383 | 0.7% |
| TASE | **22.0%** | 17,248 | 10.2% |
| FWB | **16.2%** | 55,095 | 0.2% |
| OTCLNKECN | **7.4%** | 89,543 | **25.4%** |

### Worst countries (by fail %)

| Country | Fail % |
|---|---|
| Israel | **22.2%** |
| Germany | **11.7%** |
| Switzerland | **11.2%** |
| UAE | **11.0%** |

---

## UCITS vs non-UCITS

| Segment | Fail % | Yahoo % of priced |
|---|---|---|
| UCITS | **3.3%** | 6.5% |
| Non-UCITS | **4.6%** | 7.8% |

UCITS pricing is slightly **better** than the broad universe.

---

## Yahoo backup gap

Of **56,556** raw failures (last 7 days):

- **23,610 (42%)** have a row in `instrument_yahoo_mappings` but still failed.

Yahoo candidacy today is narrow (has `yahoo_symbol` OR US OTC/NASDAQ/NYSE/ARCA). Many mapped internationals never reach Yahoo backup.

---

## Chronic dead tickers (1,962)

Always fail (100% over 3+ runs). Top venues:

| Exchange | Chronic fail tickers |
|---|---|
| FWB | 314 |
| OTCLNKECN | 273 |
| TASE | 267 |
| SWB | 147 |
| BVME.ETF | 97 |

---

## Recommendations (next fetch improvements)

1. **Fold step 1 into step 2** — no separate stage; optional inline double-tap per batch.
2. **Exchange-aware ladder**
   - US liquid: step 2 → Yahoo; skip 3–4 for speed.
   - International illiquid: start at step 3.
   - Germany: step 3 → Yahoo with ISIN mapping; else mark unpriceable.
   - OTC: step 2 → Yahoo early.
3. **Expand Yahoo** for tickers with mappings that still fail IBKR (42% of failures).
4. **Blacklist ~1,962 chronic failures** — stop burning fetch time; flag for NAV.
5. **Slot tuning** — lean on Yahoo more overnight; keep preflight longer for `us_close`.

---

## Storage changes (same date)

See migration `20260709120000_ladder_slim_and_ticker_summary.sql`:

- Slimmed `ibkr_fetch_ladder_results` (dropped `symbol`, `success_step_label`, `last_price`, `created_at`).
- Added `ibkr_fetch_ladder_ticker_summary` (per-ticker cumulative stats).
- **7-day raw retention** with archive via `archive_ibkr_fetch_ladder_results()` / `scripts/summarize-ladder-results.mjs`.
- `instrument_price_history` **unchanged** (NAV backfill preserved).

### One-time archive (2026-07-09)

| | Count |
|---|---|
| Raw rows archived → summary | **1,131,364** |
| Tickers in summary table | **80,656** |
| Raw rows deleted | **1,131,364** |

---

## Queries for follow-up

```sql
-- Worst tickers by failures
select conid, exchange_id, total_runs, total_failures, total_priced,
       step_1, step_2, step_3, step_4, step_5
from ibkr_fetch_ladder_ticker_summary
order by total_failures desc
limit 20;

-- Step mix (cumulative)
select sum(step_1), sum(step_2), sum(step_3), sum(step_4), sum(step_5), sum(total_failures)
from ibkr_fetch_ladder_ticker_summary;

-- Chronic failures
select conid, exchange_id, total_runs
from ibkr_fetch_ladder_ticker_summary
where total_failures = total_runs and total_runs >= 3
order by total_runs desc;
```

---

*Generated from production Supabase analysis. Re-run after major ladder or universe changes.*
