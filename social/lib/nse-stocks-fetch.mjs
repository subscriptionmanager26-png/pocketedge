import { createNseCookieSession, nseGet } from './nse-session.mjs';

const SEED_URL = 'https://www.nseindia.com/market-data/stocks-traded';

export async function fetchNseStocksTraded() {
  const session = await createNseCookieSession(SEED_URL);
  return nseGet('/api/live-analysis-stocksTraded', session);
}
