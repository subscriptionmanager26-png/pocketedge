const JUSTETF_PROFILE_URL = 'https://www.justetf.com/en/etf-profile.html?isin=';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJustEtfProfileHtml(isin, { delayMs = 150, retries = 3 } = {}) {
  if (!isin) return null;
  if (delayMs > 0) await sleep(delayMs);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(`${JUSTETF_PROFILE_URL}${encodeURIComponent(isin)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 429 || response.status === 403) {
      const backoff = 2500 * (attempt + 1);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) return null;
    return response.text();
  }

  return null;
}
