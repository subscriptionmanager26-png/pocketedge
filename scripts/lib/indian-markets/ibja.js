import { UA } from './constants.js';

export const IBJA_GOLD_999_KEY = 'IBJA-GOLD-999';
const IBJA_HOME = 'https://ibja.co/';

function parseInrNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[₹,\s]/g, '')
    .replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseIbjaDate(raw) {
  // IBJA uses DD/MM/YYYY
  const m = String(raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function pickById(html, id) {
  const re = new RegExp(
    `id=["']${id}["'][^>]*>([^<]*)<|id=["']${id}["'][^>]*value=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? '').trim();
}

/**
 * Fetch IBJA indicative retail gold jewellery rates from ibja.co.
 * Fine Gold (999) is published as ₹/gram (same unit as NSE SGB LTP).
 * Rates update around 12:00 IST daily (AM/PM sessions).
 */
export async function fetchIbjaGoldRates() {
  const res = await fetch(IBJA_HOME, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`IBJA fetch failed: ${res.status}`);
  const html = await res.text();

  const sessionLabel = pickById(html, 'lblHeaderTextForTimeUnit');
  const session = /\(PM\)/i.test(sessionLabel) ? 'PM' : 'AM';
  const asOfDate = parseIbjaDate(pickById(html, 'lblDate'));
  const fineGold999 = parseInrNumber(pickById(html, 'lblFineGold999'));

  if (fineGold999 == null) {
    throw new Error('IBJA Fine Gold (999) rate not found on page');
  }

  return {
    syncedAt: new Date().toISOString(),
    asOfDate,
    session,
    sessionLabel: sessionLabel || null,
    fineGold999PerGram: fineGold999,
    rates: {
      '999': fineGold999,
      '22KT': parseInrNumber(pickById(html, 'lblSellingPriceFor22KT')),
      '20KT': parseInrNumber(pickById(html, 'PriceFor20KT')),
      '14KT': parseInrNumber(pickById(html, 'PriceFor14KT')),
    },
    source: 'ibja',
    url: IBJA_HOME,
  };
}
