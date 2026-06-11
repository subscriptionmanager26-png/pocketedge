import React from 'react';
import { Lock } from 'lucide-react';
import AppPageLayout from './AppPageLayout';

export default function BasketAccessGate({ onBack }) {
  return (
    <AppPageLayout>
      <div className="pe-card max-w-lg mx-auto p-8 sm:p-10 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-neutral-600" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900">Basket details are waitlisted</h2>
        <p className="text-neutral-600 mt-2 text-sm sm:text-base leading-relaxed">
          You can view baskets you&apos;ve created. Browsing other portfolios unlocks when your waitlist
          spot is confirmed.
        </p>
        <button type="button" onClick={onBack} className="mt-6 pe-btn-primary px-8 py-3 text-base">
          Back to dashboard
        </button>
      </div>
    </AppPageLayout>
  );
}
