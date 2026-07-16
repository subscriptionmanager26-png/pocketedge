import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchNseAllIndices } from './lib/nse-indices-fetch.mjs';
import { fetchNseStocksTraded } from './lib/nse-stocks-fetch.mjs';
import { fetchMovingAveragesForSymbols } from './lib/equity-moving-averages.mjs';
import { socialServiceWorkerPlugin } from './vite.sw-plugin.js';

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
    },
  };
}

function mockDataProdPlugin(isProd) {
  const prodFile = path.resolve(__dirname, 'src/data/mockData.prod.js');
  return {
    name: 'mock-data-prod',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!isProd || !importer) return null;
      if (source.includes('mockData.prod')) return null;
      // Only remap the demo fixtures module — keep other paths alone.
      const base = source.replace(/\\/g, '/').split('/').pop() ?? '';
      if (base !== 'mockData' && base !== 'mockData.js') return null;
      return prodFile;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    plugins: [react(), nseApiPlugin(), socialServiceWorkerPlugin(), mockDataProdPlugin(isProd)],
    envDir: path.resolve(__dirname, '..'),
    server: { port: 5175, strictPort: true, open: false },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'supabase';
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (id.includes('tesseract')) return 'ocr';
            if (id.includes('/xlsx/')) return 'spreadsheet';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
