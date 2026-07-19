import { fetchNseStocksTraded } from '../lib/nse-stocks-fetch.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await fetchNseStocksTraded();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch NSE stocks traded' });
  }
}
