#!/usr/bin/env node
/**
 * Produces one evidence-bound market explainer per stock after the NSE close.
 * News is read from the nifty-total-market-news GitHub repository. The
 * generated explanations live in the stock-news Supabase project; price
 * history lives in the PocketEdge market-data project.
 */

const NEWS_WINDOW_DAYS = 7;
const PRICE_WINDOW_DAYS = 10;
const MISTRAL_DELAY_MS = 2_000;
const UPSERT_BATCH_SIZE = 500;
const DEFAULT_NEWS_API_URL =
  'https://api.github.com/repos/subscriptionmanager26-png/nifty-total-market-news/contents/data/stories.jsonl';

const ANALYST_INSTRUCTIONS = `You are an experienced equity market journalist.

Explain today's stock price movement using ONLY the news provided.
Do not use outside knowledge or invent explanations.

The move you must explain is the net daily figure given under "Price move to explain (authoritative)". This is the single source of truth for both the size and the direction of the move.

Ignore ALL price levels, percentages, and directional language written inside the news itself (e.g. "fell in early trade", "down 2% intraday", "opened lower", "hit a 52-week high"). Those may describe intraday swings, a different session, or unrelated context — they are NOT the move you are explaining, and must never override or contradict the authoritative figure.

Do not explain intraday volatility. Explain only the net daily move, and make sure the direction of your explanation (up vs down) matches the sign of the authoritative figure.

Before writing:

1. Rank the news by relevance.
   - Prefer the most recent, market-moving news.
   - Give higher weight to earnings, guidance, large investor buying/selling, regulatory actions, major contracts, or management changes.
   - Ignore routine or stale updates unless they are the best explanation.

2. Select ONE primary explanation.
   Do not summarize every news item. Mention another news item only if it materially changes the interpretation.

3. Decide whether the news:
   - reasonably explains the move,
   - does not explain the move, or
   - contradicts the move.

Respond in exactly this format:

## What happened?

State only today's net price movement, using the authoritative figure — never a number quoted in the news.

---

## Why did it happen?

If the news explains the move:
- Lead with the strongest explanation.
- Explain why investors would react (news → investor interpretation → price move).
- End with "**However, ...**" only if there is an important counterpoint.

If the news does not explain the move:
- Say that none of the available news convincingly explains today's move and that investors should watch for further announcements.

If the news contradicts the move:
- Explain that the available news points in the opposite direction and that the market may be reacting to information or expectations not yet public.

Style:
- Write like Reuters or Bloomberg.
- Be concise (under 120 words).
- Avoid vague phrases like "could be seen as" or "likely contributed."
- Prefer phrases like "The strongest explanation appears to be..." or "Investors seem to be reacting to..."
- Never provide investment advice.`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseArgs(argv) {
  const args = { provider: 'mistral', tickers: [] };
  for (const arg of argv) {
    if (arg.startsWith('--provider=')) args.provider = arg.slice('--provider='.length);
    if (arg.startsWith('--tickers=')) {
      args.tickers = arg
        .slice('--tickers='.length)
        .split(',')
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean);
    }
  }
  if (!['mistral', 'openai'].includes(args.provider)) {
    throw new Error('--provider must be mistral or openai.');
  }
  return args;
}

function istDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function restHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function restJson(url, key, path, options = {}) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: restHeaders(key, options.headers),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const body = await response.text();
  return body.trim() ? JSON.parse(body) : null;
}

async function fetchAllTickers(newsUrl, newsKey) {
  const rows = await restJson(
    newsUrl,
    newsKey,
    'mn_tickers?select=symbol,nse_symbol&order=symbol.asc&limit=5000'
  );
  return (rows ?? [])
    .map((row) => ({ ticker: String(row.nse_symbol || row.symbol || '').trim().toUpperCase() }))
    .filter((row) => row.ticker);
}

async function fetchRecentNewsFromGitHub(fromDate) {
  const token = process.env.NIFTY_NEWS_REPO_TOKEN;
  const response = await fetch(process.env.NEWS_GITHUB_API_URL || DEFAULT_NEWS_API_URL, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub news fetch ${response.status}: ${await response.text()}`);
  const cutoff = Date.parse(`${fromDate}T00:00:00Z`);
  const byTicker = new Map();
  for (const line of (await response.text()).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      console.warn('Skipping malformed GitHub news JSONL record.');
      continue;
    }
    const timestamp = row.published_iso ?? row.fetched_at;
    if (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp) < cutoff) continue;
    const ticker = String(row.symbol ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const items = byTicker.get(ticker) ?? [];
    // Pass the full article body (stored in `description`); no truncation.
    items.push({
      id: row.id,
      title: String(row.title ?? '').trim(),
      article: String(row.description ?? row.short_description ?? '').trim(),
      published_at: timestamp,
      date: String(timestamp).slice(0, 10),
      source: row.provider?.name ?? row.provider?.id ?? null,
      link: row.link ?? null,
    });
    byTicker.set(ticker, items);
  }
  for (const [ticker, items] of byTicker) {
    byTicker.set(
      ticker,
      items.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    );
  }
  return byTicker;
}

async function fetchPriceHistory(marketUrl, marketKey, tickers, fromDate) {
  const prices = new Map();
  const unique = [...new Set(tickers.map(({ ticker }) => ticker))];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    const encoded = batch.map((ticker) => `"${ticker.replaceAll('"', '')}"`).join(',');
    const params = new URLSearchParams({
      select: 'asset_key,as_of_date,close_price,previous_close,change_pct',
      asset_type: 'eq.stock',
      asset_key: `in.(${encoded})`,
      as_of_date: `gte.${fromDate}`,
      order: 'as_of_date.desc',
    });
    const rows = await restJson(marketUrl, marketKey, `social_market_price_history?${params}`);
    for (const row of rows ?? []) {
      const key = String(row.asset_key ?? '').trim().toUpperCase();
      const history = prices.get(key) ?? [];
      if (history.length < 3) {
        history.push({
          date: row.as_of_date,
          close: Number(row.close_price),
          previousClose: row.previous_close == null ? null : Number(row.previous_close),
          changePct: row.change_pct == null ? null : Number(row.change_pct),
        });
      }
      prices.set(key, history);
    }
  }
  return prices;
}

function noRecentNewsRow(ticker, asOfDate) {
  return {
    ticker,
    as_of_date: asOfDate,
    status: 'no_recent_news',
    explanation:
      'No material news updates were identified for this stock in the past seven days, so there is no evidence-based market explanation to provide today.',
    confidence: null,
    price_context: [],
    news_context: [],
    // Must carry the same key set as generated/failed rows — PostgREST bulk
    // upsert requires every object in the array to have identical keys.
    input_context: {},
    model: null,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildUserMessage(ticker, prices, news) {
  // Compact markdown: each price block is "change" + "date"; each news block is
  // the full article followed by its date. Keeps the input token-lean.
  const fmtPct = (pct) => (pct == null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`);
  const latest = prices[0];
  const moveLine =
    latest && latest.changePct != null
      ? `${fmtPct(latest.changePct)} on ${latest.date}`
      : 'net move unavailable';
  const priceText = prices.length
    ? prices.map((row) => `${fmtPct(row.changePct) ?? 'change n/a'}\n${row.date}`).join('\n\n')
    : 'No recent price-change data available.';
  const newsText = news.length
    ? news
        .map((row) => `${[row.title, row.article].filter(Boolean).join('\n')}\n${row.date}`)
        .join('\n\n')
    : 'No news in the last seven days.';
  return `Stock: ${ticker}

## Price move to explain (authoritative)
${moveLine}

## Recent daily price changes (most recent first)
${priceText}

## News (most recent first)
${newsText}`;
}

function buildInputContext(ticker, prices, news) {
  return {
    system_prompt: ANALYST_INSTRUCTIONS,
    user_prompt: buildUserMessage(ticker, prices, news),
  };
}

async function explainWithMistral(apiKey, model, input) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 550,
      messages: [
        { role: 'system', content: ANALYST_INSTRUCTIONS },
        { role: 'user', content: input.user_prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Mistral ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const explanation = String(payload?.choices?.[0]?.message?.content ?? '').trim();
  if (!explanation) throw new Error('Mistral returned an empty explanation.');
  const confidence = explanation.match(/\*?\*?Confidence:\*?\*?\s*(High|Medium|Low)/i)?.[1] ?? null;
  return {
    explanation,
    confidence: confidence ? confidence[0].toUpperCase() + confidence.slice(1).toLowerCase() : null,
  };
}

async function explainWithOpenAi(apiKey, model, input) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions: input.system_prompt,
      input: input.user_prompt,
      // Minimal hidden reasoning + low verbosity for a short, journalistic
      // answer. No output cap — gpt-5-nano supports a very large output window.
      reasoning: { effort: 'minimal' },
      text: { verbosity: 'low' },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const explanation = String(
    payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .filter((item) => item.type === 'output_text')
        .map((item) => item.text)
        .join('') ??
      ''
  ).trim();
  if (!explanation) {
    const reason = payload.incomplete_details?.reason ?? payload.status ?? 'unknown';
    throw new Error(`OpenAI returned an empty explanation (status: ${reason}).`);
  }
  return { explanation, confidence: null };
}

async function upsertRows(newsUrl, newsKey, table, rows) {
  for (let offset = 0; offset < rows.length; offset += UPSERT_BATCH_SIZE) {
    await restJson(
      newsUrl,
      newsKey,
      `${table}?on_conflict=ticker,as_of_date`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(offset, offset + UPSERT_BATCH_SIZE)),
      }
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const newsUrl = requireEnv('STOCK_NEWS_SUPABASE_URL');
  const newsKey = requireEnv('STOCK_NEWS_SUPABASE_SERVICE_ROLE_KEY');
  const marketUrl = requireEnv('SUPABASE_URL');
  const marketKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = requireEnv(args.provider === 'openai' ? 'OPENAI_API_KEY' : 'MISTRAL_API_KEY');
  const model =
    args.provider === 'openai'
      ? process.env.OPENAI_MODEL || 'gpt-5-nano'
      : process.env.MISTRAL_MODEL || 'mistral-small-latest';
  // OpenAI explanations land in a separate table so they can be compared against
  // the Mistral output. Override with EXPLANATIONS_TABLE if needed.
  const table =
    process.env.EXPLANATIONS_TABLE ||
    (args.provider === 'openai'
      ? 'mn_daily_stock_explanations_openai'
      : 'mn_daily_stock_explanations');
  const asOfDate = istDate();
  const [tickers, newsByTicker] = await Promise.all([
    fetchAllTickers(newsUrl, newsKey),
    fetchRecentNewsFromGitHub(shiftDate(asOfDate, NEWS_WINDOW_DAYS)),
  ]);
  const selectedTickers = args.tickers.length
    ? tickers.filter(({ ticker }) => args.tickers.includes(ticker))
    : tickers;
  if (args.tickers.length && selectedTickers.length !== args.tickers.length) {
    const found = new Set(selectedTickers.map(({ ticker }) => ticker));
    console.warn(`Unknown test tickers: ${args.tickers.filter((ticker) => !found.has(ticker)).join(', ')}`);
  }
  const priceByTicker = await fetchPriceHistory(
    marketUrl,
    marketKey,
    selectedTickers,
    shiftDate(asOfDate, PRICE_WINDOW_DAYS)
  );
  const rows = [];
  let generated = 0;
  let failed = 0;
  for (const { ticker } of selectedTickers) {
    const news = newsByTicker.get(ticker) ?? [];
    if (!news.length) {
      rows.push(noRecentNewsRow(ticker, asOfDate));
      continue;
    }
    try {
      const prices = priceByTicker.get(ticker) ?? [];
      const input = buildInputContext(ticker, prices, news);
      const result =
        args.provider === 'openai'
          ? await explainWithOpenAi(apiKey, model, input)
          : await explainWithMistral(apiKey, model, input);
      rows.push({
        ticker,
        as_of_date: asOfDate,
        status: 'generated',
        explanation: result.explanation,
        confidence: result.confidence,
        price_context: prices,
        news_context: news,
        input_context: input,
        model: `${args.provider}:${model}`,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      generated += 1;
    } catch (error) {
      rows.push({
        ticker,
        as_of_date: asOfDate,
        status: 'failed',
        explanation: 'The daily market explanation could not be generated. Please check back later.',
        confidence: null,
        price_context: priceByTicker.get(ticker) ?? [],
        news_context: news,
        input_context: buildInputContext(ticker, priceByTicker.get(ticker) ?? [], news),
        model: `${args.provider}:${model}`,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      failed += 1;
      console.error(`${ticker}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, MISTRAL_DELAY_MS));
  }
  await upsertRows(newsUrl, newsKey, table, rows);
  console.log(
    JSON.stringify(
      {
        as_of_date: asOfDate,
        provider: args.provider,
        model,
        table,
        tracked_stocks: selectedTickers.length,
        generated,
        no_recent_news: rows.length - generated - failed,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
