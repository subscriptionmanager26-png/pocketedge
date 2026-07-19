const UPSTREAM =
  'https://zweqxjeuwwfrlpbuuayg.supabase.co/storage/v1/object/public/asset-logos';

/**
 * Same-origin logo proxy with long CDN/browser cache.
 * Upstream Storage sends cache-control: no-cache which makes lists feel slow.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parts = req.query.path;
  const relative = Array.isArray(parts) ? parts.join('/') : String(parts ?? '');
  if (!relative || relative.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/${relative}`, {
      method: req.method,
      headers: { Accept: 'image/*' },
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400, immutable'
    );
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buffer);
  } catch (error) {
    res.status(502).json({ error: error.message || 'Failed to fetch asset logo' });
  }
}
