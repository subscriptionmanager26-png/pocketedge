import { parseAnyStatementFromLines } from './statementParser';
import {
  extractPdfLinesWithPdfJs,
  PdfIncorrectPasswordError,
  PdfPasswordRequiredError,
} from './pdfExtract';

export { PdfIncorrectPasswordError, PdfPasswordRequiredError };

function parseQty(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pushRow(out, { isin, name, qty, ticker, amfi }) {
  const q = parseQty(qty);
  if (q <= 0) return;
  const cleanIsin = String(isin ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const cleanAmfi = String(amfi ?? '')
    .trim()
    .replace(/\D/g, '');
  const amfiCode = /^\d{6,}$/.test(cleanAmfi) ? cleanAmfi : null;
  const label = String(name ?? ticker ?? cleanIsin ?? '').trim();
  if (!label && !cleanIsin && !amfiCode) return;
  // Prefer ISIN, then AMFI/scheme code, else name as resolve token.
  const token =
    /^[A-Z0-9]{12}$/.test(cleanIsin)
      ? cleanIsin
      : amfiCode ||
        String(ticker || label)
          .trim()
          .toUpperCase();
  if (!token) return;
  out.push({
    ticker: token,
    name: label || token,
    isin: /^[A-Z0-9]{12}$/.test(cleanIsin) ? cleanIsin : null,
    amfi: amfiCode,
    qty: q,
    avg: 0,
    invested: 0,
  });
}

function rowsFromCdsl(data) {
  const out = [];
  for (const h of data?.demat_holdings ?? []) {
    pushRow(out, {
      isin: h.isin,
      name: h.security_name,
      qty: h.current_balance,
    });
  }
  for (const h of data?.mf_holdings ?? []) {
    pushRow(out, {
      isin: h.isin,
      name: h.scheme_name,
      qty: h.closing_units,
      amfi: h.scheme_code || h.amfi_code,
    });
  }
  return out;
}

function rowsFromMfHoldings(holdings) {
  const out = [];
  for (const h of holdings ?? []) {
    pushRow(out, {
      isin: h.isin,
      name: h.scheme_name,
      qty: h.closing_units,
      amfi: h.amfi_code || h.scheme_code,
      ticker: h.amfi_code || h.scheme_code || undefined,
    });
  }
  return out;
}

function rowsFromCams(data) {
  const out = [];
  for (const h of data?.holdings ?? []) {
    pushRow(out, {
      isin: h.isin,
      name: h.scheme_name_simple || h.scheme_name,
      qty: h.closing_units,
      amfi: h.mf_amfi_code || h.scheme_code,
    });
  }
  return out;
}

/**
 * Parse a statement PDF into qty-only holdings rows for PocketEdge import.
 * Supports CDSL demat CAS, CAMS/KFin CAS, and MF Central.
 *
 * @returns {Promise<{ rows: object[], kind: string, sourceLabel: string }>}
 */
export async function parseStatementPdfToHoldings(file, { password } = {}) {
  const buffer = await file.arrayBuffer();
  const lines = await extractPdfLinesWithPdfJs(buffer, password);
  const fileName = file?.name || 'statement.pdf';
  const parsed = parseAnyStatementFromLines(lines, fileName);

  if (parsed.kind === 'unknown') {
    throw new Error(
      parsed.reason ||
        'Unrecognized PDF. Use a CDSL demat CAS, CAMS/KFin CAS, or MF Central statement.'
    );
  }

  if (parsed.kind === 'nps') {
    throw new Error('NPS statements are not supported yet. Use CDSL or CAMS/KFin / MF Central.');
  }

  let rows = [];
  let label = 'Statement PDF';
  if (parsed.kind === 'cdsl_cas') {
    rows = rowsFromCdsl(parsed.data);
    label = 'CDSL statement';
  } else if (parsed.kind === 'mf_central') {
    rows = rowsFromMfHoldings(parsed.data?.holdings);
    label = 'MF Central statement';
  } else if (parsed.kind === 'cams_kfin_cas') {
    rows = rowsFromCams(parsed.data);
    label = 'CAMS / KFin statement';
  }

  if (!rows.length) {
    throw new Error(`No holdings with quantity found in this ${label}.`);
  }

  return { rows, kind: parsed.kind, sourceLabel: label };
}
