import { fetchMovingAveragesForSymbols } from '../lib/equity-moving-averages.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const raw = String(req.query?.symbols ?? '').trim();
  const symbols = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    res.status(400).json({ error: 'symbols query required' });
    return;
  }

  try {
    const bySymbol = await fetchMovingAveragesForSymbols(symbols);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ bySymbol });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch moving averages' });
  }
}
