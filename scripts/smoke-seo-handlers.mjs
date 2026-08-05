/** Local smoke test for SEO edge handlers against public/ static data. */
const origin = process.env.SEO_ORIGIN || 'http://127.0.0.1:5055';

function botRequest(urlPath) {
  return new Request(`https://www.pocketedge.in${urlPath}`, {
    headers: {
      'user-agent': 'Googlebot',
      'x-forwarded-host': origin.replace(/^https?:\/\//, ''),
      'x-forwarded-proto': 'http',
    },
  });
}

async function main() {
  const briefMod = await import('../api/seo/brief/[symbol].ts');
  {
    const res = await briefMod.default(botRequest('/business-model/RELIANCE'), {
      params: { symbol: 'RELIANCE' },
    });
    const html = await res.text();
    console.log(
      'BRIEF',
      res.status,
      html.includes('Executive summary'),
      html.includes('application/ld+json'),
      (html.match(/<title>(.*?)<\/title>/) || [])[1]
    );
  }

  const equityMod = await import('../api/_lib/handleEquitySeo.ts');
  {
    const res = await equityMod.handleEquitySeoRequest(
      botRequest('/stock/RELIANCE'),
      { params: { symbol: 'RELIANCE' } },
      'stock'
    );
    const html = await res.text();
    console.log('STOCK', res.status, html.includes('Business model brief'), html.includes('ld+json'));
  }

  const fundMod = await import('../api/seo/fund/[schemeCode].ts');
  {
    const res = await fundMod.default(botRequest('/fund/103490'), {
      params: { schemeCode: '103490' },
    });
    const html = await res.text();
    console.log(
      'FUND selective',
      res.status,
      html.includes('Top holdings'),
      html.includes('noindex'),
      html.includes('AUM') || html.includes('Expense')
    );
  }

  {
    const search = await (await fetch(`${origin}/data/markets/mutual-funds-search.json`)).json();
    const row = (search.items || []).find((r) => {
      const name = String(r.name || '').toLowerCase();
      return /\bregular\b/.test(name) || /\bidcw\b/.test(name);
    });
    const code = String(row?.schemeCode || row?.id || '');
    if (code) {
      const res = await fundMod.default(botRequest(`/fund/${code}`), {
        params: { schemeCode: code },
      });
      const html = await res.text();
      console.log('FUND noindex', code, res.status, html.includes('noindex'));
    } else {
      console.log('FUND noindex skip');
    }
  }

  const indexMod = await import('../api/seo/index/[indexId].ts');
  {
    const search = await (await fetch(`${origin}/data/markets/indices-search.json`)).json();
    const id = String(search.items?.[0]?.id || search.items?.[0]?.symbol || '');
    const res = await indexMod.default(botRequest(`/index/${id}`), { params: { indexId: id } });
    const html = await res.text();
    console.log('INDEX', id, res.status, html.includes('ld+json'));
  }

  const commodityMod = await import('../api/seo/commodity/[commodityId].ts');
  {
    const search = await (await fetch(`${origin}/data/markets/commodities-search.json`)).json();
    const id = String(search.items?.[0]?.id || search.items?.[0]?.symbol || '');
    const res = await commodityMod.default(botRequest(`/commodity/${id}`), {
      params: { commodityId: id },
    });
    const html = await res.text();
    console.log('COMMODITY', id, res.status, html.includes('ld+json'));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
