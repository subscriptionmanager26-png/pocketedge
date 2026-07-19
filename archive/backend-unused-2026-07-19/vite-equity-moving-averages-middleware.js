/**
 * Vite middleware removed from vite.config.js (nseApiPlugin) on 2026-07-19.
 * Requires: import { fetchMovingAveragesForSymbols } from './lib/equity-moving-averages.mjs';
 * and restoring archive/.../lib/equity-moving-averages.mjs + api/equity-moving-averages.js
 */
server.middlewares.use('/api/equity-moving-averages', async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const symbols = String(url.searchParams.get('symbols') ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (!symbols.length) {
      sendJson(res, 400, { error: 'symbols query required' });
      return;
    }
    const bySymbol = await fetchMovingAveragesForSymbols(symbols);
    sendJson(res, 200, { bySymbol }, 's-maxage=3600, stale-while-revalidate=86400');
  } catch (error) {
    sendJson(res, 502, {
      error: error.message || 'Failed to fetch moving averages',
    });
  }
});
