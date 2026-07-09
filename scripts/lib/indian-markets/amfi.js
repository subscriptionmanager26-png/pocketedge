/**
 * Parse AMFI NAVAll.txt
 * Format mirrors common Indian MF data pipelines (category → AMC → scheme rows).
 */

const SCHEME_ROW = /^\s*(\d+)\s*;/;

function parseCategoryLine(line) {
  const match = line.match(
    /^(Open Ended Schemes|Close Ended Schemes|Interval Schemes)\((.+)\)\s*$/i
  );
  if (!match) return null;

  const schemeType = match[1].trim();
  const inner = match[2].trim();
  const dashIdx = inner.indexOf(' - ');
  if (dashIdx === -1) {
    return { schemeType, category: inner, subCategory: '' };
  }

  return {
    schemeType,
    category: inner.slice(0, dashIdx).trim(),
    subCategory: inner.slice(dashIdx + 3).trim(),
  };
}

function parseNavDate(value) {
  if (!value) return null;
  const parts = value.trim().split('-');
  if (parts.length !== 3) return value;
  const months = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const month = months[parts[1]];
  if (!month) return value;
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${month}-${parts[0].padStart(2, '0')}`;
}

export function parseNavAll(text) {
  const lines = text.split(/\r?\n/);
  let schemeType = '';
  let category = '';
  let subCategory = '';
  let amc = '';
  const schemes = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Scheme Code')) continue;

    const categoryInfo = parseCategoryLine(line);
    if (categoryInfo) {
      schemeType = categoryInfo.schemeType;
      category = categoryInfo.category;
      subCategory = categoryInfo.subCategory;
      continue;
    }

    if (SCHEME_ROW.test(line)) {
      const cols = line.split(';').map((c) => c.trim());
      const nav = Number(cols[4]);
      schemes.push({
        id: cols[0],
        schemeCode: cols[0],
        isinPayout: cols[1] && cols[1] !== '-' ? cols[1] : null,
        isinReinvest: cols[2] && cols[2] !== '-' ? cols[2] : null,
        name: cols[3] ?? '',
        nav: Number.isFinite(nav) ? nav : null,
        navDate: parseNavDate(cols[5]),
        schemeType,
        category,
        subCategory,
        amc,
      });
      continue;
    }

    if (!line.includes(';')) {
      amc = line;
    }
  }

  return schemes;
}
