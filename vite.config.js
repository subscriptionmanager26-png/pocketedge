import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { visualizer } from 'rollup-plugin-visualizer';
import { fetchNseStocksTraded } from './lib/nse-stocks-fetch.mjs';
import { fetchNseEtfLiveQuotes } from './lib/nse-etf-fetch.mjs';
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

      server.middlewares.use('/api/etf-live', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }
        try {
          const payload = await fetchNseEtfLiveQuotes();
          sendJson(res, 200, payload, 'public, s-maxage=30, stale-while-revalidate=60');
        } catch (error) {
          sendJson(res, 502, { error: error.message || 'Failed to fetch NSE ETF quotes' });
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

function assetLogosProxyPlugin() {
  const UPSTREAM =
    'https://zweqxjeuwwfrlpbuuayg.supabase.co/storage/v1/object/public/asset-logos';
  return {
    name: 'asset-logos-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/asset-logos/')) {
          next();
          return;
        }
        const relative = req.url.slice('/asset-logos/'.length).split('?')[0];
        if (!relative || relative.includes('..')) {
          res.statusCode = 400;
          res.end('Invalid path');
          return;
        }
        try {
          const upstream = await fetch(`${UPSTREAM}/${relative}`);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end();
            return;
          }
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png');
          res.setHeader(
            'Cache-Control',
            'public, max-age=86400, stale-while-revalidate=604800'
          );
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.end(buffer);
        } catch {
          res.statusCode = 502;
          res.end();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const analyze = Boolean(process.env.ANALYZE);

  return {
    plugins: [
      react(),
      nseApiPlugin(),
      assetLogosProxyPlugin(),
      socialServiceWorkerPlugin(),
      mockDataProdPlugin(isProd),
      analyze &&
        visualizer({
          filename: 'dist/stats.html',
          gzipSize: true,
          open: false,
        }),
    ].filter(Boolean),
    // Load `.env` from this app root (was `..` when social lived under a monorepo).
    envDir: __dirname,
    server: { port: 5175, strictPort: true, open: false },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              if (id.includes('marketDataApi')) return 'market-data';
              return undefined;
            }
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
