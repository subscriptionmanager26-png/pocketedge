import { fetchNseEtfLiveQuotes } from '../lib/nse-etf-fetch.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await fetchNseEtfLiveQuotes();
    // Short CDN cache so the tracker can poll ~every minute without hammering NSE.
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({ error: error?.message || 'Failed to fetch NSE ETF quotes' });
  }
}
