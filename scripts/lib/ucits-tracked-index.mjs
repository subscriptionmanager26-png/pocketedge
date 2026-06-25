const INDEX_PATTERNS = [
  { re: /nasdaq[- ]?100/i, label: 'NASDAQ-100' },
  { re: /nasdaq.*biotech/i, label: 'NASDAQ Biotechnology' },
  { re: /s&p\s*500|s&p500|core s&p 500/i, label: 'S&P 500' },
  { re: /s&p\s*china\s*500/i, label: 'S&P China 500' },
  { re: /s&p\s*(?:us\s*)?dividend aristocrats/i, label: 'S&P Dividend Aristocrats' },
  { re: /s&p\s*eurozone/i, label: 'S&P Eurozone' },
  { re: /s&p\s*euro(?:pean)?\s*dividend/i, label: 'S&P Euro Dividend' },
  { re: /s&p\s*global/i, label: 'S&P Global' },
  { re: /s&p\s*400|midcap 400/i, label: 'S&P 400 MidCap' },
  { re: /s&p\s*600|smallcap 600/i, label: 'S&P 600 SmallCap' },
  { re: /msci\s+emerging\s+markets(?:\s+imi)?/i, label: 'MSCI Emerging Markets' },
  { re: /msci\s+em(?:\s+imi)?(?:\s+ucits|\s+etf|\s+acc|\s+dist|\s+usd|\s+eur|\b)/i, label: 'MSCI Emerging Markets' },
  { re: /msci\s+emu/i, label: 'MSCI EMU' },
  { re: /msci\s+world/i, label: 'MSCI World' },
  { re: /msci\s+europe/i, label: 'MSCI Europe' },
  { re: /msci\s+usa/i, label: 'MSCI USA' },
  { re: /msci\s+acwi/i, label: 'MSCI ACWI' },
  { re: /msci\s+pacific(?:\s+ex[- ]?japan)?/i, label: 'MSCI Pacific ex-Japan' },
  { re: /msci\s+nordic/i, label: 'MSCI Nordic' },
  { re: /msci\s+india/i, label: 'MSCI India' },
  { re: /msci\s+china/i, label: 'MSCI China' },
  { re: /msci\s+japan/i, label: 'MSCI Japan' },
  { re: /msci\s+uk/i, label: 'MSCI UK' },
  { re: /msci\s+canada/i, label: 'MSCI Canada' },
  { re: /msci\s+saudi/i, label: 'MSCI Saudi Arabia' },
  { re: /msci\s+turkey/i, label: 'MSCI Turkey' },
  { re: /msci\s+usa\s+esg|msci\s+usa\s+sri/i, label: 'MSCI USA' },
  { re: /ftse\s+all[- ]world|ftse\s+aw\b/i, label: 'FTSE All-World' },
  { re: /ftse\s+100/i, label: 'FTSE 100' },
  { re: /ftse\s+250/i, label: 'FTSE 250' },
  { re: /ftse\s+epra|epra\s*nareit/i, label: 'FTSE EPRA/NAREIT' },
  { re: /ftse\s+developed\s+europe/i, label: 'FTSE Developed Europe' },
  { re: /ftse\s+china/i, label: 'FTSE China' },
  { re: /ftse\s+mib/i, label: 'FTSE MIB' },
  { re: /euro\s+stoxx\s*50|stoxx\s*50\b/i, label: 'EURO STOXX 50' },
  { re: /stoxx\s+europe\s*600|stoxx\s*600\b/i, label: 'STOXX Europe 600' },
  { re: /stoxx\s+europe\s*50/i, label: 'STOXX Europe 50' },
  { re: /\bdax\b/i, label: 'DAX' },
  { re: /cac\s*40/i, label: 'CAC 40' },
  { re: /\baex\b/i, label: 'AEX' },
  { re: /\bsmi\b/i, label: 'SMI' },
  { re: /bel\s*20/i, label: 'BEL 20' },
  { re: /ibex\s*35/i, label: 'IBEX 35' },
  { re: /russell\s*2000/i, label: 'Russell 2000' },
  { re: /russell\s*1000/i, label: 'Russell 1000' },
  { re: /bloomberg\s+barclays|barclays\s+(?:global\s+)?aggregate/i, label: 'Bloomberg Barclays Aggregate' },
  { re: /euro\s+aggregate/i, label: 'Euro Aggregate Bonds' },
  { re: /global\s+aggregate/i, label: 'Global Aggregate Bonds' },
  { re: /emerging\s+market(?:s)?\s+bond|em\s+bond|j\.?p\.?\s*morgan.*em/i, label: 'Emerging Market Bonds' },
  { re: /ibonds/i, label: 'Corporate Bonds (iBonds)' },
  { re: /government bond|govt bond|gilt|treasury(?:\s+bond)?/i, label: 'Government Bonds' },
  { re: /corporate bond|corp(?:orate)?\s+bond/i, label: 'Corporate Bonds' },
  { re: /high yield|high-yield/i, label: 'High Yield Bonds' },
  { re: /inflation[- ]linked/i, label: 'Inflation-Linked Bonds' },
  { re: /silver/i, label: 'Silver' },
  { re: /gold/i, label: 'Gold' },
  { re: /copper/i, label: 'Copper' },
  { re: /oil|crude|wti|brent/i, label: 'Oil' },
  { re: /clean energy|renewable/i, label: 'Clean Energy' },
  { re: /automation.*robotics|robotics/i, label: 'Automation & Robotics' },
  { re: /genomic|genomics/i, label: 'Genomics' },
  { re: /semiconductor/i, label: 'Semiconductors' },
  { re: /cyber\s*security|cybersecurity/i, label: 'Cybersecurity' },
  { re: /cloud computing|cloud\b/i, label: 'Cloud Computing' },
  { re: /csi\s*a\s*500|csi\s*a500/i, label: 'CSI A500' },
  { re: /shiller.*cape|cape\s*us\s*sector/i, label: 'Shiller Barclays CAPE US Sector' },
  { re: /development bank bond/i, label: 'Development Bank Bonds' },
  { re: /msci\s+global\s+liquid\s+corp/i, label: 'Bloomberg MSCI Global Liquid Corp' },
  { re: /hydrogen/i, label: 'Hydrogen Economy' },
  { re: /supply chain/i, label: 'Future Supply Chains' },
  { re: /artificial intelligence|\bai\b.*ucits|\bai adopters/i, label: 'Artificial Intelligence' },
  { re: /innovation ucits/i, label: 'Innovation' },
  { re: /smart city/i, label: 'Smart City Infrastructure' },
  { re: /quality dividend/i, label: 'Quality Dividends' },
  { re: /global equity ucits/i, label: 'Global Equity' },
  { re: /us equity ucits/i, label: 'US Equity' },
  { re: /blockchain|bitcoin|crypto/i, label: 'Digital Assets' },
];

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function inferTrackedIndex(name = '', longName = '') {
  const text = decodeHtmlEntities(`${name} ${longName}`);
  for (const { re, label } of INDEX_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

export function normalizeTrackedIndexLabel(raw = '') {
  const text = decodeHtmlEntities(String(raw)).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const fromInference = inferTrackedIndex(text, text);
  if (fromInference) return fromInference;

  return text
    .replace(/\s+Index$/i, '')
    .replace(/\s+TR$/i, '')
    .replace(/\s+NR$/i, '')
    .trim() || null;
}

export function extractJustEtfIndexFromHtml(html = '') {
  const patterns = [
    /data-testid="etf-basics_row_index"[\s\S]*?<div>\s*([^<]+?)\s*<\/div>/i,
    /data-testid="etf-profile-header_index[^"]*"[^>]*>\s*([^<]+?)\s*</i,
    /Index[\s\S]{0,40}?<div[^>]*>\s*([^<]{3,120})\s*<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const normalized = normalizeTrackedIndexLabel(match[1]);
    if (normalized) return normalized;
  }

  return null;
}

export function applyIsinPeerIndexFallback(funds) {
  const byIsin = new Map();

  for (const fund of funds) {
    if (!fund.isin || !fund.trackedIndex) continue;
    const existing = byIsin.get(fund.isin);
    if (!existing) byIsin.set(fund.isin, fund);
  }

  let filled = 0;
  for (const fund of funds) {
    if (fund.trackedIndex || !fund.isin) continue;
    const donor = byIsin.get(fund.isin);
    if (!donor?.trackedIndex) continue;
    fund.trackedIndex = donor.trackedIndex;
    fund.trackedIndexSource = donor.trackedIndexSource || 'isin_peer';
    filled += 1;
  }

  return filled;
}

export function resolveTrackedIndexFromFund(fund) {
  const inferred = inferTrackedIndex(fund.name, fund.longName || fund.name);
  if (!inferred) return null;
  return { trackedIndex: inferred, trackedIndexSource: 'name' };
}
