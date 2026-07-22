#!/usr/bin/env node
/**
 * Produces evidence-bound market explainers.
 *
 * Modes:
 *   price-move (default) — post-close stock explainers (7-day news, ≤3 bullets)
 *   macro — morning index / commodity / economics digests (36h news, ≤4 bullets)
 *
 * News is read from the stock-news Supabase project (`mn_news_items`). Price
 * history (price-move mode) lives in the PocketEdge market-data project.
 */

const NEWS_WINDOW_DAYS_DEFAULT = 7;
const PRICE_WINDOW_DAYS = 10;
const MISTRAL_DELAY_MS = Number(process.env.MISTRAL_DELAY_MS || 2_000);
const UPSERT_BATCH_SIZE = 500;
const NEWS_PAGE_SIZE = 1000;
const TICKER_PAGE_SIZE = 1000;
const VALID_ASSET_TYPES = new Set(['stock', 'index', 'commodity', 'economics']);
const MAX_BULLETS_DEFAULT = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Collect distinct Mistral keys from MISTRAL_API_KEY, MISTRAL_API_KEY_2..N, or MISTRAL_API_KEYS. */
function loadMistralApiKeys() {
  const keys = [];
  if (process.env.MISTRAL_API_KEYS) {
    keys.push(
      ...process.env.MISTRAL_API_KEYS.split(',')
        .map((key) => key.trim())
        .filter(Boolean)
    );
  }
  if (process.env.MISTRAL_API_KEY) keys.push(process.env.MISTRAL_API_KEY.trim());
  for (let index = 2; index <= 10; index += 1) {
    const key = process.env[`MISTRAL_API_KEY_${index}`];
    if (key?.trim()) keys.push(key.trim());
  }
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) throw new Error('Missing MISTRAL_API_KEY');
  return unique;
}

function chunkRoundRobin(items, chunkCount) {
  const chunks = Array.from({ length: chunkCount }, () => []);
  for (let index = 0; index < items.length; index += 1) {
    chunks[index % chunkCount].push(items[index]);
  }
  return chunks;
}

function buildPriceMoveInstructions(maxBullets) {
  return `# Market Move Explanation Prompt

You are a market journalist. Explain today's move using ONLY the news provided — no outside knowledge.

The authoritative move is the net daily figure given under "Price move to explain." Use this figure alone for direction and size. Ignore all price levels/percentages/directional language inside the news itself (e.g. "fell in early trade," "hit a 52-week high") — these may reflect intraday swings or unrelated context and must never override the authoritative figure.

## Steps

1. Rank news by relevance — prioritize recent, market-moving items (earnings, guidance, large investor activity, regulatory action, major contracts, management changes, macro releases) over routine updates.
2. Pick ONE primary explanation. Mention a second item only if it materially changes the interpretation.
3. Judge whether the news explains, doesn't explain, or contradicts the move.

## Output Format

Respond in a maximum of ${maxBullets} short bullet points:

- **If news explains it:** strongest reason first, framed as news → investor interpretation → price move. Add a counterpoint bullet only if significant.
- **If news doesn't explain it:** one bullet stating that no news convincingly explains the move; watch for further announcements.
- **If news contradicts it:** one bullet noting the news points the opposite way; market may be pricing in non-public information/expectations.

Dont use filler words in bullet point . Come directly to the point.`;
}

/** Morning digest for indices / commodities / economics — what happened, not price attribution. */
function buildMacroDigestInstructions(maxBullets) {
  return `# Macro / Market News Digest Prompt

You are a market journalist. Summarise what happened using ONLY the news provided — no outside knowledge.

## Steps

1. Rank items by market importance (policy, rates, inflation, geopolitics, supply shocks, demand shifts, major data releases, large price-driving events).
2. Merge overlapping stories into a single bullet; drop routine or duplicate coverage.
3. Prefer concrete facts (who/what/when and market implication) over vague commentary.

## Output Format

- Respond with bullet points only (use "- " prefix).
- Maximum ${maxBullets} bullets. Prefer fewer if the news does not support more.
- Each bullet: one precise development and why it matters. No filler, no preamble, no closing summary.
- If nothing material happened, output a single bullet stating that.`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseArgs(argv) {
  const args = {
    provider: 'mistral',
    tickers: [],
    assetTypes: null,
    newsWindowHours: null,
    newsWindowDays: NEWS_WINDOW_DAYS_DEFAULT,
    maxBullets: MAX_BULLETS_DEFAULT,
    mode: 'price-move',
  };
  for (const arg of argv) {
    if (arg.startsWith('--provider=')) args.provider = arg.slice('--provider='.length);
    if (arg.startsWith('--tickers=')) {
      args.tickers = arg
        .slice('--tickers='.length)
        .split(',')
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean);
    }
    if (arg.startsWith('--asset-types=')) {
      args.assetTypes = [
        ...new Set(
          arg
            .slice('--asset-types='.length)
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        ),
      ];
    }
    if (arg.startsWith('--news-window-hours=')) {
      args.newsWindowHours = Number(arg.slice('--news-window-hours='.length));
    }
    if (arg.startsWith('--news-window-days=')) {
      args.newsWindowDays = Number(arg.slice('--news-window-days='.length));
    }
    if (arg.startsWith('--max-bullets=')) {
      args.maxBullets = Number(arg.slice('--max-bullets='.length));
    }
    if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length).trim().toLowerCase();
    }
  }
  if (!['mistral', 'openai'].includes(args.provider)) {
    throw new Error('--provider must be mistral or openai.');
  }
  if (!['price-move', 'macro'].includes(args.mode)) {
    throw new Error('--mode must be price-move or macro.');
  }
  if (args.assetTypes) {
    for (const type of args.assetTypes) {
      if (!VALID_ASSET_TYPES.has(type)) {
        throw new Error(`Invalid asset type "${type}". Use: ${[...VALID_ASSET_TYPES].join(', ')}`);
      }
    }
    if (!args.assetTypes.length) throw new Error('--asset-types cannot be empty.');
  }
  if (args.newsWindowHours != null && (!Number.isFinite(args.newsWindowHours) || args.newsWindowHours <= 0)) {
    throw new Error('--news-window-hours must be a positive number.');
  }
  if (!Number.isFinite(args.newsWindowDays) || args.newsWindowDays <= 0) {
    throw new Error('--news-window-days must be a positive number.');
  }
  if (!Number.isFinite(args.maxBullets) || args.maxBullets < 1 || args.maxBullets > 8) {
    throw new Error('--max-bullets must be an integer from 1 to 8.');
  }
  args.maxBullets = Math.floor(args.maxBullets);
  return args;
}

function buildSystemInstructions(mode, maxBullets) {
  return mode === 'macro'
    ? buildMacroDigestInstructions(maxBullets)
    : buildPriceMoveInstructions(maxBullets);
}

function newsWindowLabel(args) {
  if (args.newsWindowHours != null) {
    return `the past ${args.newsWindowHours} hours`;
  }
  return `the past ${args.newsWindowDays} days`;
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
  const rows = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: 'symbol,nse_symbol,series',
      order: 'symbol.asc',
      limit: String(TICKER_PAGE_SIZE),
      offset: String(offset),
    });
    const batch = await restJson(newsUrl, newsKey, `mn_tickers?${params}`);
    if (!batch?.length) break;
    rows.push(...batch);
    if (batch.length < TICKER_PAGE_SIZE) break;
    offset += TICKER_PAGE_SIZE;
  }
  return rows
    .map((row) => {
      // Prefer `symbol` — news ingest keys rows by mn_tickers.symbol
      // (indices/commodities diverge from nse_symbol).
      const ticker = String(row.symbol || row.nse_symbol || '').trim();
      const series = String(row.series ?? '').trim().toUpperCase();
      return {
        ticker,
        tickerKey: ticker.toUpperCase(),
        series,
        assetType: seriesToAssetType(series, ticker),
      };
    })
    .filter((row) => row.ticker);
}

/** Map mn_tickers.series → explanation asset_type. */
function seriesToAssetType(series, ticker) {
  const s = String(series || '').toUpperCase();
  const t = String(ticker || '').toUpperCase();
  if (t === 'ECONOMICS' || (s === 'TOPIC' && t === 'ECONOMICS')) return 'economics';
  if (s === 'INDEX') return 'index';
  if (s === 'COMMODITY') return 'commodity';
  if (s === 'TOPIC') return null; // Others / unknown topics — not summarized
  if (!s || s === 'EQ') return 'stock';
  return null;
}

const EXCLUDED_SUMMARY_TICKERS = new Set(['OTHERS', 'OTHER']);

function isSummarizableTicker(row, allowedAssetTypes = null) {
  if (!row?.ticker) return false;
  if (EXCLUDED_SUMMARY_TICKERS.has(row.tickerKey)) return false;
  const ok =
    row.assetType === 'stock'
    || row.assetType === 'index'
    || row.assetType === 'commodity'
    || row.assetType === 'economics';
  if (!ok) return false;
  if (allowedAssetTypes?.length && !allowedAssetTypes.includes(row.assetType)) return false;
  return true;
}

/**
 * Tickers that should receive a Mistral/OpenAI call today:
 * stock / index / commodity / economics with ≥1 news item in the lookback window.
 * Country-feed "Others" bucket is excluded. Optional --asset-types narrows the set.
 */
function buildEligibleTickers(allTickers, newsByTicker, explicitTickers, allowedAssetTypes = null) {
  const byKey = new Map(allTickers.map((row) => [row.tickerKey, row]));

  if (explicitTickers.length) {
    return explicitTickers
      .map((ticker) => byKey.get(ticker.toUpperCase()))
      .filter((row) => row && isSummarizableTicker(row, allowedAssetTypes));
  }

  const eligible = [];
  for (const key of newsByTicker.keys()) {
    const row = byKey.get(key);
    if (row && isSummarizableTicker(row, allowedAssetTypes)) eligible.push(row);
  }
  return eligible.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** @param {string} publishedAtGte ISO timestamp or YYYY-MM-DD (date → midnight UTC) */
async function fetchRecentNewsFromSupabase(newsUrl, newsKey, publishedAtGte) {
  const gte =
    publishedAtGte.includes('T')
      ? publishedAtGte
      : `${publishedAtGte}T00:00:00Z`;
  const byTicker = new Map();
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: 'id,ticker,title,summary,published_at,source',
      published_at: `gte.${gte}`,
      order: 'published_at.desc',
      limit: String(NEWS_PAGE_SIZE),
      offset: String(offset),
    });
    const rows = await restJson(newsUrl, newsKey, `mn_news_items?${params}`);
    if (!rows?.length) break;
    for (const row of rows) {
      const ticker = String(row.ticker ?? '').trim().toUpperCase();
      if (!ticker) continue;
      const items = byTicker.get(ticker) ?? [];
      items.push({
        id: row.id,
        title: String(row.title ?? '').trim(),
        article: String(row.summary ?? '').trim(),
        published_at: row.published_at,
        date: String(row.published_at ?? '').slice(0, 10),
        source: row.source ?? null,
        link: null,
      });
      byTicker.set(ticker, items);
    }
    if (rows.length < NEWS_PAGE_SIZE) break;
    offset += NEWS_PAGE_SIZE;
  }
  for (const [ticker, items] of byTicker) {
    byTicker.set(
      ticker,
      items.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    );
  }
  return byTicker;
}

async function fetchPriceHistory(marketUrl, marketKey, tickerRows, fromDate) {
  const prices = new Map();
  const byType = new Map();
  for (const row of tickerRows) {
    const assetType = row.assetType === 'economics' ? null : row.assetType;
    if (!assetType) continue; // economics has no price series
    const marketType = assetType === 'stock' ? 'stock' : assetType;
    const list = byType.get(marketType) ?? [];
    list.push(row.ticker);
    byType.set(marketType, list);
  }

  for (const [assetType, tickers] of byType) {
    const unique = [...new Set(tickers)];
    for (let offset = 0; offset < unique.length; offset += 100) {
      const batch = unique.slice(offset, offset + 100);
      const encoded = batch.map((ticker) => `"${ticker.replaceAll('"', '')}"`).join(',');
      const params = new URLSearchParams({
        select: 'asset_key,as_of_date,close_price,previous_close,change_pct',
        asset_type: `eq.${assetType}`,
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
  }
  return prices;
}

function noRecentNewsRow(ticker, asOfDate, assetType, windowLabel) {
  return {
    ticker,
    as_of_date: asOfDate,
    asset_type: assetType,
    status: 'no_recent_news',
    explanation:
      `No material news updates were identified for this instrument in ${windowLabel}, so there is no evidence-based market explanation to provide today.`,
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

function buildUserMessage(ticker, prices, news, assetType = 'stock', { mode = 'price-move', windowLabel = 'the past seven days' } = {}) {
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
    : `No news in ${windowLabel}.`;
  const label =
    assetType === 'index'
      ? 'Index'
      : assetType === 'commodity'
        ? 'Commodity'
        : assetType === 'economics'
          ? 'Topic'
          : 'Stock';

  if (mode === 'macro') {
    const contextHint =
      assetType === 'economics'
        ? 'Summarise the overall economy / macro picture from the news below.'
        : assetType === 'index'
          ? 'Summarise what happened for this index from the news below.'
          : 'Summarise what happened for this commodity from the news below.';
    return `${label}: ${ticker}

## Task
${contextHint}

## News (${windowLabel}, most recent first)
${newsText}`;
  }

  return `${label}: ${ticker}

## Price move to explain
${moveLine}

## Recent daily price changes (most recent first)
${priceText}

## News (most recent first)
${newsText}`;
}

function buildInputContext(ticker, prices, news, assetType = 'stock', options = {}) {
  const systemPrompt = options.systemPrompt || buildSystemInstructions(options.mode || 'price-move', options.maxBullets || MAX_BULLETS_DEFAULT);
  return {
    system_prompt: systemPrompt,
    user_prompt: buildUserMessage(ticker, prices, news, assetType, options),
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
        { role: 'system', content: input.system_prompt },
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

function buildExplanationRow({
  ticker,
  asOfDate,
  assetType,
  status,
  explanation,
  confidence,
  prices,
  news,
  input,
  model,
}) {
  return {
    ticker,
    as_of_date: asOfDate,
    asset_type: assetType,
    status,
    explanation,
    confidence,
    price_context: prices,
    news_context: news,
    input_context: input ?? {},
    model,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function processMistralBatch({
  workerId,
  apiKey,
  model,
  tickers,
  assetTypeByTicker,
  asOfDate,
  newsByTicker,
  priceByTicker,
  promptOptions,
}) {
  const rows = [];
  let generated = 0;
  let failed = 0;

  for (const ticker of tickers) {
    const news = newsByTicker.get(ticker) ?? [];
    const prices = priceByTicker.get(ticker) ?? [];
    const assetType = assetTypeByTicker.get(ticker) || 'stock';
    const input = buildInputContext(ticker, prices, news, assetType, promptOptions);
    try {
      const result = await explainWithMistral(apiKey, model, input);
      rows.push(
        buildExplanationRow({
          ticker,
          asOfDate,
          assetType,
          status: 'generated',
          explanation: result.explanation,
          confidence: result.confidence,
          prices,
          news,
          input,
          model: `mistral:${model}`,
        })
      );
      generated += 1;
    } catch (error) {
      rows.push(
        buildExplanationRow({
          ticker,
          asOfDate,
          assetType,
          status: 'failed',
          explanation: 'The daily market explanation could not be generated. Please check back later.',
          confidence: null,
          prices,
          news,
          input,
          model: `mistral:${model}`,
        })
      );
      failed += 1;
      console.error(`[worker ${workerId}] ${ticker}: ${error.message}`);
    }
    await sleep(MISTRAL_DELAY_MS);
  }

  console.log(
    JSON.stringify({
      worker: workerId,
      tickers: tickers.length,
      generated,
      failed,
    })
  );
  return { rows, generated, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const newsUrl = requireEnv('STOCK_NEWS_SUPABASE_URL');
  const newsKey = requireEnv('STOCK_NEWS_SUPABASE_SERVICE_ROLE_KEY');
  // Price history is only used for stock price-move explainers.
  const marketUrl = args.mode === 'macro' ? process.env.SUPABASE_URL : requireEnv('SUPABASE_URL');
  const marketKey =
    args.mode === 'macro'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const mistralApiKeys = args.provider === 'mistral' ? loadMistralApiKeys() : [];
  const openAiApiKey = args.provider === 'openai' ? requireEnv('OPENAI_API_KEY') : null;
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
  const windowLabel = newsWindowLabel(args);
  const newsFromIso =
    args.newsWindowHours != null
      ? new Date(Date.now() - args.newsWindowHours * 60 * 60 * 1000).toISOString()
      : shiftDate(asOfDate, args.newsWindowDays);
  const systemPrompt = buildSystemInstructions(args.mode, args.maxBullets);
  const promptOptions = {
    mode: args.mode,
    maxBullets: args.maxBullets,
    windowLabel,
    systemPrompt,
  };
  const [allTickers, newsByTicker] = await Promise.all([
    fetchAllTickers(newsUrl, newsKey),
    fetchRecentNewsFromSupabase(newsUrl, newsKey, newsFromIso),
  ]);
  console.log(
    JSON.stringify({
      mode: args.mode,
      max_bullets: args.maxBullets,
      asset_types: args.assetTypes,
      news_window: windowLabel,
      news_from: newsFromIso,
      mn_tickers_loaded: allTickers.length,
      summarizable_tickers: allTickers.filter((row) => isSummarizableTicker(row, args.assetTypes)).length,
      by_asset_type: {
        stock: allTickers.filter((r) => r.assetType === 'stock').length,
        index: allTickers.filter((r) => r.assetType === 'index').length,
        commodity: allTickers.filter((r) => r.assetType === 'commodity').length,
        economics: allTickers.filter((r) => r.assetType === 'economics').length,
      },
      tickers_with_recent_news: newsByTicker.size,
    })
  );

  const selectedRows = buildEligibleTickers(allTickers, newsByTicker, args.tickers, args.assetTypes);
  if (args.tickers.length && selectedRows.length !== args.tickers.length) {
    const found = new Set(selectedRows.map((row) => row.tickerKey));
    console.warn(
      `Unknown/excluded test tickers: ${args.tickers.filter((ticker) => !found.has(ticker.toUpperCase())).join(', ')}`
    );
  }
  const assetTypeByTicker = new Map(
    selectedRows.map((row) => [row.tickerKey, row.assetType])
  );
  console.log(
    `Processing ${selectedRows.length} eligible tickers (${(args.assetTypes || [...VALID_ASSET_TYPES]).join('/')})`
  );
  const priceByTicker =
    args.mode === 'macro'
      ? new Map()
      : await fetchPriceHistory(
          marketUrl,
          marketKey,
          selectedRows,
          shiftDate(asOfDate, PRICE_WINDOW_DAYS)
        );

  const tickersWithNews = [];
  const rows = [];
  for (const row of selectedRows) {
    const news = newsByTicker.get(row.tickerKey) ?? [];
    if (!news.length) {
      rows.push(noRecentNewsRow(row.ticker, asOfDate, row.assetType, windowLabel));
      continue;
    }
    tickersWithNews.push(row.tickerKey);
  }

  let generated = 0;
  let failed = 0;

  if (args.provider === 'mistral' && tickersWithNews.length) {
    const workerCount = mistralApiKeys.length;
    const chunks = chunkRoundRobin(tickersWithNews, workerCount);
    console.log(
      `Mistral parallel workers: ${workerCount} (~${Math.ceil(tickersWithNews.length / workerCount)} tickers each)`
    );
    const batchResults = await Promise.all(
      chunks.map((chunk, index) =>
        processMistralBatch({
          workerId: index + 1,
          apiKey: mistralApiKeys[index],
          model,
          tickers: chunk,
          assetTypeByTicker,
          asOfDate,
          newsByTicker,
          priceByTicker,
          promptOptions,
        })
      )
    );
    for (const result of batchResults) {
      rows.push(...result.rows);
      generated += result.generated;
      failed += result.failed;
    }
  } else if (args.provider === 'openai') {
    for (const ticker of tickersWithNews) {
      const news = newsByTicker.get(ticker) ?? [];
      const prices = priceByTicker.get(ticker) ?? [];
      const assetType = assetTypeByTicker.get(ticker) || 'stock';
      const input = buildInputContext(ticker, prices, news, assetType, promptOptions);
      try {
        const result = await explainWithOpenAi(openAiApiKey, model, input);
        rows.push(
          buildExplanationRow({
            ticker,
            asOfDate,
            assetType,
            status: 'generated',
            explanation: result.explanation,
            confidence: result.confidence,
            prices,
            news,
            input,
            model: `openai:${model}`,
          })
        );
        generated += 1;
      } catch (error) {
        rows.push(
          buildExplanationRow({
            ticker,
            asOfDate,
            assetType,
            status: 'failed',
            explanation: 'The daily market explanation could not be generated. Please check back later.',
            confidence: null,
            prices,
            news,
            input,
            model: `openai:${model}`,
          })
        );
        failed += 1;
        console.error(`${ticker}: ${error.message}`);
      }
      await sleep(MISTRAL_DELAY_MS);
    }
  }

  await upsertRows(newsUrl, newsKey, table, rows);
  console.log(
    JSON.stringify(
      {
        as_of_date: asOfDate,
        provider: args.provider,
        mode: args.mode,
        model,
        table,
        tracked: selectedRows.length,
        eligible_with_news: tickersWithNews.length,
        mistral_workers: args.provider === 'mistral' ? mistralApiKeys.length : 1,
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
