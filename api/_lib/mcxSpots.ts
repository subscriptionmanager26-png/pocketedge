/** MCX spot-market fetch + day-change helpers (Node / Vercel). */

const MCX_SEED = 'https://www.mcxindia.com/market-data/spot-market-price';
const MCX_API = 'https://www.mcxindia.com/GetSpotMarketPrice?culture=en';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type McxSpotItem = {
  id: string;
  location: string;
  spotPrice: number | null;
  change: number | null;
  date: string | null;
};

export function dateInIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** MCX session Mon–Fri 09:00–23:30 IST. */
export function isMcxSession(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '99');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '99');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 && mins <= 23 * 60 + 30;
}

export function parseMcxDate(formatted: string | null, fallback: string): string {
  if (!formatted) return fallback;
  const parsed = Date.parse(`${formatted} UTC`);
  if (!Number.isFinite(parsed)) return fallback;
  return dateInIst(new Date(parsed));
}

export async function fetchMcxSpotPrices(): Promise<McxSpotItem[]> {
  const home = await fetch(MCX_SEED, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  // Cookie optional — API often works without it; seed may 403 from some clouds.
  let cookie = '';
  if (home.ok) {
    const getSetCookie = (home.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
      cookie = getSetCookie.call(home.headers)
        .map((c) => c.split(';')[0])
        .join('; ');
    } else {
      const setCookie = home.headers.get('set-cookie') ?? '';
      cookie = setCookie
        .split(',')
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
    }
  }

  const res = await fetch(MCX_API, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      Referer: MCX_SEED,
    },
  });
  if (!res.ok) throw new Error(`MCX spot fetch failed: ${res.status}`);

  const payload = await res.json();
  return (payload?.Data?.Data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.enSymbol ?? row.symbol ?? ''),
    location: String(row.enlocation ?? row.location ?? 'NA'),
    spotPrice: row.todaysSpotPrice != null ? Number(row.todaysSpotPrice) : null,
    change: row.change != null ? Number(row.change) : null,
    date: row.FormattedDate != null ? String(row.FormattedDate) : null,
  }));
}

export type ExistingQuote = {
  price: number | null;
  asOfDate: string | null;
  previousClose: number | null;
};

export function commodityDayChange({
  price,
  asOfDate,
  existing,
}: {
  price: number;
  asOfDate: string;
  existing: ExistingQuote | undefined;
}) {
  let previousClose: number | null = null;
  if (existing?.asOfDate && existing.asOfDate !== asOfDate && Number.isFinite(existing.price)) {
    previousClose = existing.price;
  } else if (Number.isFinite(existing?.previousClose)) {
    previousClose = existing!.previousClose;
  }
  if (previousClose == null || previousClose === 0) {
    return { previousClose: null as number | null, changePct: null as number | null };
  }
  return {
    previousClose,
    changePct: ((price - previousClose) / previousClose) * 100,
  };
}
