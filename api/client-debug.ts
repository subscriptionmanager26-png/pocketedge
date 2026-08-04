export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('[client-debug]', JSON.stringify(payload ?? null));
  } catch (error) {
    console.log('[client-debug] parse-error', String(error));
  }
  res.status(204).end();
}
