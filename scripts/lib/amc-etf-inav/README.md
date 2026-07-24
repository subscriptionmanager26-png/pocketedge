# AMC ETF iNAV scraper

Vendored from `subscriptionmanager26-png/etf-inav` (`UnifiedETFScraper`).

Used by `scripts/refresh-amc-etf-inav.py` and `.github/workflows/refresh-amc-etf-inav.yml`
to write `social_market_assets.amc_inav` about once per minute during the NSE session
(via Supabase cron → GitHub workflow_dispatch).
