import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  detectFetchSlot,
  runUniversePriceFetch,
  type FetchSlot,
} from '../../lib/universe-price-fetch.js';

export const config = {
  maxDuration: 300,
};

const CRON_SCHEDULE_SLOTS: Record<string, FetchSlot> = {
  '5 21 * * 1-5': 'us_close',
  '5 9 * * 1-5': 'overnight',
};

function resolveFetchSlot(req: VercelRequest): FetchSlot {
  const slotParam = req.query.slot;
  const slotText = Array.isArray(slotParam) ? slotParam[0] : slotParam;
  if (slotText === 'us_close' || slotText === 'overnight') return slotText;

  const scheduleHeader = req.headers['x-vercel-cron-schedule'];
  const schedule = Array.isArray(scheduleHeader) ? scheduleHeader[0] : scheduleHeader;
  if (schedule && CRON_SCHEDULE_SLOTS[schedule]) return CRON_SCHEDULE_SLOTS[schedule];

  return detectFetchSlot();
}

function authorizeCron(req: VercelRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${cronSecret}`) return true;
  }
  if (req.headers['x-vercel-cron']) return true;
  return !cronSecret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const fetchSlot = resolveFetchSlot(req);

  const runId = Array.isArray(req.query.run_id)
    ? req.query.run_id[0]
    : (req.query.run_id as string | undefined);
  const offset = Number(
    Array.isArray(req.query.offset) ? req.query.offset[0] : (req.query.offset ?? '0')
  );
  const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = limitParam ? Number(limitParam) : undefined;
  const chunkSizeParam = Array.isArray(req.query.chunk_size)
    ? req.query.chunk_size[0]
    : req.query.chunk_size;
  const chunkSize = chunkSizeParam ? Number(chunkSizeParam) : undefined;

  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const continuationBaseUrl = host ? `${proto}://${host}/api/cron/universe-price-fetch` : undefined;

  try {
    const result = await runUniversePriceFetch({
      fetchSlot,
      runId,
      chunkOffset: Number.isFinite(offset) ? offset : 0,
      chunkSize: Number.isFinite(chunkSize) && chunkSize! > 0 ? chunkSize : undefined,
      continuationBaseUrl,
      limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
