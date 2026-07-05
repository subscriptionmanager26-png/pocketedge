#!/usr/bin/env python3
"""Scrape UCITS instruments from ucits.info (Paasa screener)."""

import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'data'
BASE_URL = 'https://ucits.info/'

QUERY = {
    'ix_preset': 'S&P 500',
    'limit': 100,
    'sortBy': 'symbol',
    'sortOrder': 'asc',
}


def fetch_page(page: int) -> str:
    params = '&'.join(
        [
            f'page={page}',
            'ix_preset=S%26P+500',
            'limit=100',
            'sortBy=symbol',
            'sortOrder=asc',
        ]
    )
    url = f'{BASE_URL}?{params}'
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (compatible; PocketEdge/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read().decode('utf-8', errors='replace')


def clean_cell(html: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', html)
    return re.sub(r'\s+', ' ', text).strip()


def parse_rows(html: str) -> list[dict]:
    rows = re.findall(r'<tr class="group[^"]*">.*?</tr>', html, re.S)
    parsed = []

    for row in rows:
        cells = re.findall(r'<td class="([^"]*)"[^>]*>(.*?)</td>', row, re.S)
        if len(cells) < 18:
            continue

        symbol = clean_cell(cells[1][1])
        name = clean_cell(cells[2][1])
        exchange = clean_cell(cells[17][1])
        domicile = clean_cell(cells[18][1]) if len(cells) > 18 else ''

        if not symbol or not name:
            continue

        parsed.append(
            {
                'symbol': symbol,
                'name': name,
                'exchange': exchange,
                'domicile': domicile,
            }
        )

    return parsed


def main() -> None:
    all_rows = []
    seen = set()

    for page in range(1, 31):
        html = fetch_page(page)
        rows = parse_rows(html)
        if not rows:
            raise RuntimeError(f'No rows parsed on page {page}')

        added = 0
        for row in rows:
            key = (row['symbol'], row['exchange'])
            if key in seen:
                continue
            seen.add(key)
            all_rows.append(row)
            added += 1

        print(f'page {page:02d}: parsed {len(rows)} rows, added {added}, total {len(all_rows)}')
        time.sleep(0.35)

    all_rows.sort(key=lambda row: (row['symbol'], row['exchange']))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_json = DATA_DIR / 'ucits-info-instruments.json'
    out_manifest = DATA_DIR / 'ucits-info-manifest.json'

    manifest = {
        'source': BASE_URL,
        'pages': 30,
        'perPage': 100,
        'instrumentCount': len(all_rows),
        'uniqueSymbols': len({row['symbol'] for row in all_rows}),
        'scrapedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }

    out_json.write_text(json.dumps(all_rows, indent=2))
    out_manifest.write_text(json.dumps(manifest, indent=2))

    print(f'Saved {len(all_rows)} instruments to {out_json}')


if __name__ == '__main__':
    main()
