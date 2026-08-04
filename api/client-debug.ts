export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    const payload = await request.json();
    console.log('[client-debug]', JSON.stringify(payload));
  } catch (error) {
    console.log('[client-debug] parse-error', String(error));
  }
  return new Response(null, { status: 204 });
}
