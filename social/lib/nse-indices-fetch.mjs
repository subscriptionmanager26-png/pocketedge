import { createNseCookieSession, nseGet } from './nse-session.mjs';

const SEED_URL = 'https://www.nseindia.com/market-data/live-market-indices';

export async function fetchNseAllIndices() {
  const session = await createNseCookieSession(SEED_URL);
  return nseGet('/api/allIndices', session);
}
