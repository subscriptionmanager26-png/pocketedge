export const ASSET_TYPE_LABELS = {
  stock: 'Stock',
  etf: 'ETF',
  mf: 'MF',
  crypto: 'Crypto',
  other: 'Other',
};

const ETF_TICKERS = new Set(['NIFTYBEES']);

export function getStockAssetType(ticker, stock) {
  if (stock?.assetType) return ASSET_TYPE_LABELS[stock.assetType] ?? stock.assetType;
  if (ETF_TICKERS.has(ticker) || /BEES$/i.test(ticker)) return ASSET_TYPE_LABELS.etf;
  if (stock?.isCrypto) return ASSET_TYPE_LABELS.crypto;
  return ASSET_TYPE_LABELS.stock;
}

export function getFundAssetType() {
  return ASSET_TYPE_LABELS.mf;
}
