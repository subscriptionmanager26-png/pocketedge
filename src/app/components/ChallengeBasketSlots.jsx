import React from 'react';
import { Plus } from 'lucide-react';
import { MAX_USER_BASKETS, canCreateBasket } from '../basketStore';
import { navigateApp } from '../appRoute';
import PrimaryCta from '../../components/PrimaryCta';

export default function ChallengeBasketSlots({ userBaskets = [] }) {
  const canAdd = canCreateBasket(userBaskets);
  const slots = Array.from({ length: MAX_USER_BASKETS }, (_, index) => userBaskets[index] ?? null);

  return (
    <section className="w-full">
      <div className="mb-4 text-center sm:text-left">
        <h2 className="pe-section-title">Your challenge baskets</h2>
        <p className="pe-body-s mt-1">
          {userBaskets.length} of {MAX_USER_BASKETS} slots filled
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {slots.map((basket, index) => {
          const slotNumber = index + 1;

          if (basket) {
            return (
              <div key={basket.id} className="pe-card p-4 flex flex-col h-full min-h-[148px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-3">
                  Slot {slotNumber}
                </p>
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${
                      basket.imageGradient || 'from-emerald-600 to-cyan-500'
                    } flex items-center justify-center overflow-hidden`}
                  >
                    {basket.imageUrl ? (
                      <img src={basket.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-white/90">{basket.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="pe-card-title truncate">{basket.name}</p>
                    <p className="pe-body-s mt-0.5">
                      {basket.constituents?.length ?? 0} stocks ·{' '}
                      {basket.weightingType === 'equal' ? 'Equal' : 'Custom'} weight
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-pe-border/60">
                  <button
                    type="button"
                    onClick={() => navigateApp({ tab: 'basket', basketId: basket.id })}
                    className="flex-1 px-3 py-2 rounded-lg border border-pe-border/80 text-xs font-semibold text-pe-text hover:border-neutral-300 transition-colors"
                  >
                    View
                  </button>
                  <PrimaryCta
                    type="button"
                    size="sm"
                    fullWidth
                    onClick={() => navigateApp({ tab: 'create', editBasketId: basket.id })}
                  >
                    Edit
                  </PrimaryCta>
                </div>
              </div>
            );
          }

          return (
            <button
              key={`empty-${slotNumber}`}
              type="button"
              disabled={!canAdd}
              onClick={() => navigateApp({ tab: 'create', createNew: true })}
              className="pe-card border-dashed p-4 flex flex-col items-center justify-center min-h-[148px] text-center transition-colors hover:border-neutral-400 hover:bg-neutral-50/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-pe-border"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pe-text-muted mb-3 w-full text-left">
                Slot {slotNumber}
              </p>
              <span className="w-10 h-10 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-pe-text-secondary" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-pe-text">Add basket</span>
              <span className="text-xs text-pe-text-secondary mt-1">Fill this challenge slot</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
