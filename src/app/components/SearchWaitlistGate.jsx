import React from 'react';
import { Lock } from 'lucide-react';
import { navigateApp } from '../appRoute';

/** Blocks catalog search until waitlist access is confirmed. */
export default function SearchWaitlistGate({ children }) {
  const goToWaitlist = () => {
    navigateApp({ tab: 'dashboard' });
    requestAnimationFrame(() => {
      document.getElementById('waitlist-status')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[360px]">
      <div className="pointer-events-none select-none blur-[6px] opacity-50 saturate-50">{children}</div>

      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8 bg-white/40 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white/90 backdrop-blur-xl shadow-lg p-8 sm:p-10 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Lock className="w-5 h-5 text-neutral-600" aria-hidden />
          </div>
          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
            Search and basket details unlock once your waitlist spot is confirmed.
          </p>
          <button
            type="button"
            onClick={goToWaitlist}
            className="mt-6 pe-btn-primary w-full sm:w-auto px-8 py-3.5 text-base"
          >
            View waitlist status
          </button>
        </div>
      </div>
    </div>
  );
}
