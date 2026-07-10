import { fetchNseAllIndices } from '../lib/nse-indices-fetch.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await fetchNseAllIndices();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch NSE indices' });
  }
}
