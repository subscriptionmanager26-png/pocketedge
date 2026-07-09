/** Parse NSE EQUITY_L.csv and SME_EQUITY_L.csv master files. */

export function parseEquityCsv(text, segment = 'EQ') {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    const [
      symbol,
      name,
      series,
      dateOfListing,
      paidUpValue,
      marketLot,
      isin,
      faceValue,
    ] = parts;

    return {
      symbol: symbol?.trim() ?? '',
      name: name?.trim() ?? '',
      series: series?.trim() ?? '',
      dateOfListing: dateOfListing?.trim() ?? '',
      isin: isin?.trim() ?? '',
      segment,
    };
  }).filter((row) => row.symbol);
}
