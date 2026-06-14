import React, { useEffect, useState } from 'react';
import {
  computeInvestmentMetrics,
  getTrackedInvestment,
  subscribeInvestments,
  trackInvestment,
} from '../investmentStore';
import { formatCurrency } from '../basketCatalog';
import { capture, posthog, isPostHogEnabled } from '../../analytics';

const QUICK_AMOUNTS = [5000, 10000, 25000];

export default function InvestAndTrackPanel({
  basket,
  preview = false,
  onTracked,
  className = '',
}) {
  const [amount, setAmount] = useState('');
  const [tracked, setTracked] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const minInvest = basket.stats?.minInvestAmount || 5000;

  useEffect(() => {
    if (preview) return undefined;
    const sync = () => setTracked(getTrackedInvestment(basket.id));
    sync();
    return subscribeInvestments(sync);
  }, [basket.id, preview]);

  const parsedAmount = Number(amount.replace(/,/g, ''));
  const canSubmit = Number.isFinite(parsedAmount) && parsedAmount > 0 && status !== 'loading';

  const handleTrack = () => {
    setError('');
    if (!canSubmit) {
      setError('Enter an amount to track');
      return;
    }
    if (parsedAmount < minInvest) {
      setError(`Minimum tracking amount is ${formatCurrency(minInvest)}`);
      return;
    }

    if (preview) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }

    setStatus('loading');
    try {
      const isUpdate = Boolean(tracked);
      const next = trackInvestment(basket.id, parsedAmount);
      setTracked(next);
      setAmount('');
      setStatus('success');
      capture('investment_tracked', {
        basket_id: basket.id,
        basket_name: basket.name,
        amount: parsedAmount,
        is_update: isUpdate,
      });
      onTracked?.(next);
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('idle');
      setError(err.message || 'Could not track investment');
      if (isPostHogEnabled) posthog.captureException(err);
    }
  };

  const metrics = tracked ? computeInvestmentMetrics(basket, tracked) : null;

  return (
    <div className={`${preview ? 'pe-card p-5 sm:p-6' : 'p-0 lg:pe-card lg:p-5 lg:sm:p-6 lg:shadow-sm'} ${className}`}>
      <h2 className="pe-section-title text-base">Invest and Track</h2>
      <p className="text-xs text-pe-text-muted mt-1.5 leading-relaxed">
        Paper-track how much you put into this basket. You&apos;ll still need to invest
        through your own broker.
      </p>

      {tracked && metrics && (
        <div className="mt-4 rounded-xl border border-pe-border/60 bg-neutral-50 p-3.5">
          <p className="pe-label text-[10px]">Currently tracked</p>
          <p className="text-lg font-semibold text-pe-text tabular-nums mt-0.5">
            {formatCurrency(tracked.investedAmount)}
          </p>
          <p className="text-xs text-pe-text-muted mt-1">
            Est. value {formatCurrency(metrics.currentValue)} ·{' '}
            <span className={metrics.returnPct >= 0 ? 'text-pe-positive' : 'text-pe-negative'}>
              {metrics.returnPct >= 0 ? '+' : ''}
              {metrics.returnPct.toFixed(1)}%
            </span>
          </p>
        </div>
      )}

      <label className="block mt-4">
        <span className="pe-label text-[10px]">Amount to add</span>
        <div className="mt-1.5 flex items-center rounded-xl border border-pe-border/80 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-neutral-900/10">
          <span className="pl-3.5 text-sm text-pe-text-muted font-medium">₹</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={minInvest.toLocaleString('en-IN')}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, ''));
              setError('');
            }}
            className="flex-1 min-w-0 py-2.5 pr-3.5 text-sm text-pe-text bg-transparent outline-none tabular-nums"
          />
        </div>
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAmount(String(value));
              setError('');
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-pe-text-secondary border border-pe-border/70 hover:border-neutral-400 hover:text-pe-text transition-colors"
          >
            {formatCurrency(value)}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-pe-negative mt-2">{error}</p>}

      <button
        type="button"
        onClick={handleTrack}
        disabled={!canSubmit}
        className="mt-4 w-full h-11 rounded-xl bg-neutral-900 text-white text-sm font-semibold transition-colors hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
      >
        {status === 'loading'
          ? 'Saving…'
          : status === 'success'
            ? 'Tracked on dashboard'
            : tracked
              ? 'Add to tracked amount'
              : 'Track on dashboard'}
      </button>

      <p className="text-[10px] text-pe-text-muted mt-3 leading-relaxed text-center">
        Min. {formatCurrency(minInvest)} · Mock tracking only
      </p>
    </div>
  );
}
