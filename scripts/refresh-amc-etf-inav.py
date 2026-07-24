#!/usr/bin/env python3
"""
Scrape AMC ETF iNAVs and upsert into social_market_assets.amc_inav.

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/refresh-amc-etf-inav.py

Optional:
  --dry-run   scrape only, print counts, skip upsert
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPER_DIR = ROOT / "scripts" / "lib" / "amc-etf-inav"
sys.path.insert(0, str(SCRAPER_DIR))

from run_unified_inav import UnifiedETFScraper  # noqa: E402


def env(*keys: str) -> str | None:
    for key in keys:
        val = os.environ.get(key)
        if val and val.strip():
            return val.strip()
    return None


def upsert_amc_inav(rows: list[dict], url: str, service_key: str) -> int:
    endpoint = f"{url.rstrip('/')}/rest/v1/rpc/bulk_upsert_etf_amc_inav"
    body = json.dumps({"p_rows": rows}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Prefer": "return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
        return int(json.loads(raw) if raw else 0)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    supabase_url = env("SUPABASE_URL", "VITE_SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_ROLE_KEY")
    if not dry_run and (not supabase_url or not service_key):
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    started = time.time()
    scraper = UnifiedETFScraper()
    df = scraper.get_all_etf_data(max_workers=26)
    if df is None or df.empty:
        print("No AMC iNAV rows scraped", file=sys.stderr)
        return 2

    synced_at = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    for _, row in df.iterrows():
        symbol = str(row.get("NSE_Symbol") or "").strip().upper()
        try:
            inav = float(row.get("INAV"))
        except (TypeError, ValueError):
            continue
        if not symbol or not (inav > 0):
            continue
        name = str(row.get("ETF") or symbol).strip() or symbol
        rows.append(
            {
                "asset_key": symbol,
                "name": name,
                "amc_inav": inav,
                "synced_at": synced_at,
            }
        )

    # De-dupe by symbol (last write wins)
    by_symbol = {r["asset_key"]: r for r in rows}
    rows = list(by_symbol.values())
    elapsed = round(time.time() - started, 1)
    print(f"scraped={len(rows)} amcs={df['AMC'].nunique()} elapsed_s={elapsed}")

    if dry_run:
        print("dry-run: skip upsert")
        return 0

    # Batch upserts to keep payload manageable
    total = 0
    batch_size = 200
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            total += upsert_amc_inav(batch, supabase_url, service_key)
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", errors="replace")[:500]
            print(f"upsert failed: {err.code} {detail}", file=sys.stderr)
            return 3

    print(f"upserted={total} synced_at={synced_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
