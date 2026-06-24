import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  isSubscribedToBasket,
  subscribeSubscriptions,
  subscribeToBasket,
} from '../subscriptionStore';
import { capture } from '../../analytics';
import PrimaryCta from '../../components/PrimaryCta';

export default function FollowBasketPanel({
  basket,
  preview = false,
  onFollowed,
  className = '',
}) {
  const [following, setFollowing] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (preview) return undefined;
    const sync = () => setFollowing(isSubscribedToBasket(basket.id));
    sync();
    return subscribeSubscriptions(sync);
  }, [basket.id, preview]);

  const handleFollow = () => {
    if (following || status === 'loading') return;

    if (preview) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }

    setStatus('loading');
    try {
      subscribeToBasket(basket.id);
      setFollowing(true);
      capture('basket_followed', {
        basket_id: basket.id,
        basket_name: basket.name,
      });
      onFollowed?.();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div
      className={`${preview ? 'pe-card p-5 sm:p-6' : 'p-0 lg:pe-card lg:p-5 lg:sm:p-6 lg:shadow-sm'} ${className}`}
    >
      <h2 className="pe-section-title text-base">Start Following</h2>
      <p className="text-xs text-pe-text-muted mt-1.5 leading-relaxed">
        Follow this basket to see it on your dashboard and get notified about updates.
      </p>

      {following && (
        <div className="mt-4 rounded-xl border border-pe-border/60 bg-neutral-50 p-3.5 flex items-start gap-2.5">
          <Check className="w-4 h-4 text-pe-positive shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-pe-text">You&apos;re following this basket</p>
            <p className="text-xs text-pe-text-muted mt-0.5">
              Find it under Baskets You are following on your dashboard.
            </p>
          </div>
        </div>
      )}

      <PrimaryCta
        type="button"
        onClick={handleFollow}
        disabled={following || status === 'loading'}
        fullWidth
        className="mt-4"
      >
        {status === 'loading'
          ? 'Saving…'
          : status === 'success' && !following
            ? 'Following'
            : following
              ? 'Following'
              : 'Start Following'}
      </PrimaryCta>
    </div>
  );
}
