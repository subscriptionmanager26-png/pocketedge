/** Column / sort config for the equity Direct Growth MF screener. */

export const SCREENER_TABLE_GROUPS = [
  {
    label: 'Rolling Returns',
    columns: [
      { kind: 'rolling', period: '1y', sortKey: 'roll_1y', label: '1Y' },
      { kind: 'rolling', period: '3y', sortKey: 'roll_3y', label: '3Y' },
      { kind: 'rolling', period: '5y', sortKey: 'roll_5y', label: '5Y' },
    ],
  },
  {
    label: 'CAGR',
    columns: [
      { kind: 'cagr', period: '1y', sortKey: 'cagr_1y', label: '1Y' },
      { kind: 'cagr', period: '3y', sortKey: 'cagr_3y', label: '3Y' },
      { kind: 'cagr', period: '5y', sortKey: 'cagr_5y', label: '5Y' },
    ],
  },
  {
    label: 'Risk',
    columns: [
      { kind: 'risk', id: 'volatility', sortKey: 'volatility_3y', label: 'Volatility' },
      { kind: 'risk', id: 'sharpe', sortKey: 'sharpe_3y', label: 'Sharpe' },
      { kind: 'risk', id: 'sortino', sortKey: 'sortino_3y', label: 'Sortino' },
    ],
  },
  {
    label: 'Others',
    columns: [
      { kind: 'fundamental', id: 'pe', sortKey: 'pe', label: 'P/E' },
      { kind: 'fundamental', id: 'ter', sortKey: 'ter', label: 'TER' },
      { kind: 'fundamental', id: 'aum', sortKey: 'aum', label: 'AUM' },
      { kind: 'fundamental', id: 'categoryRank', sortKey: 'cat_rank_3y', label: 'Category Rank' },
    ],
  },
];

export const ALL_SCREENER_COLUMNS = SCREENER_TABLE_GROUPS.flatMap((g) => g.columns);

export function screenerColumnKey(col) {
  if (col.kind === 'fundamental' || col.kind === 'risk') return col.id;
  return `${col.kind}-${col.period}`;
}

export function sortDescDefault(key) {
  return key !== 'name' && key !== 'ter' && key !== 'cat_rank_3y';
}
