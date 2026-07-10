import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchNseAllIndices } from './lib/nse-indices-fetch.mjs';
import { fetchNseStocksTraded } from './lib/nse-stocks-fetch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sendJson(res, statusCode, payload, cacheControl) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(payload));
}

function nseApiPlugin() {
  return {
    name: 'nse-api',
    configureServer(server) {
      server.middlewares.use('/api/nse-indices', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const payload = await fetchNseAllIndices();
          sendJson(res, 200, payload, 's-maxage=15, stale-while-revalidate=30');
        } catch (error) {
          sendJson(res, 502, { error: error.message || 'Failed to fetch NSE indices' });
        }
      });

      server.middlewares.use('/api/nse-stocks-traded', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const payload = await fetchNseStocksTraded();
          sendJson(res, 200, payload, 's-maxage=900, stale-while-revalidate=1800');
        } catch (error) {
          sendJson(res, 502, { error: error.message || 'Failed to fetch NSE stocks traded' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), nseApiPlugin()],
  envDir: path.resolve(__dirname, '..'),
  server: { port: 5175, strictPort: true, open: false },
});
