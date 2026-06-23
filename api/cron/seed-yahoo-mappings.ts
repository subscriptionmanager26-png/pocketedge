import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminConfig, supabaseRest } from '../../lib/supabase-admin.js';

export const config = {
  maxDuration: 60,
};

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
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!authorizeCron(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const rows = (body?.rows ?? []).filter((row: { conid?: number; yahoo_symbol?: string }) =>
      row?.conid && row?.yahoo_symbol
    );
    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'no_rows' });
    }

    const config = getSupabaseAdminConfig();
    const table = supabaseRest('instrument_yahoo_mappings', config);
    const now = new Date().toISOString();
    await table.upsert(
      rows.map((row: Record<string, unknown>) => ({
        conid: Number(row.conid),
        yahoo_symbol: row.yahoo_symbol,
        exchange_id: row.exchange_id ?? null,
        currency: row.currency ?? null,
        status: 'mapped',
        updated_at: now,
      })),
      'conid'
    );

    return res.status(200).json({ ok: true, upserted: rows.length });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
