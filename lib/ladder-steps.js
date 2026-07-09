/** Ladder step numbers stored in ibkr_fetch_ladder_results.success_step */
export const LADDER_STEP_LABELS = {
  1: 'no_preflight_initial',
  2: 'no_preflight_retry',
  3: 'preflight_1',
  4: 'preflight_2',
  5: 'yahoo_backup',
};

export function ladderStepLabel(step) {
  if (step == null) return 'failed';
  return LADDER_STEP_LABELS[step] ?? `step_${step}`;
}
