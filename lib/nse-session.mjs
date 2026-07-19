const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export { UA };

export async function createNseCookieSession(seedUrl) {
  const seed = await fetch(seedUrl, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });

  const cookie = (seed.headers.getSetCookie?.() ?? [])
    .map((entry) => entry.split(';')[0])
    .join('; ');

  return { cookie, referer: seedUrl };
}

export async function nseGet(path, { referer, cookie }) {
  const response = await fetch(`https://www.nseindia.com${path}`, {
    headers: {
      'User-Agent': UA,
      Accept: '*/*',
      Referer: referer,
      Cookie: cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`NSE ${path} failed: ${response.status}`);
  }

  return response.json();
}
