export const REBALANCE_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'on_publish', label: 'On publish' },
];

export function formatRebalanceFrequency(value) {
  if (!value) return 'On publish';
  const match = REBALANCE_FREQUENCIES.find((item) => item.value === value);
  if (match) return match.label;
  return value;
}
