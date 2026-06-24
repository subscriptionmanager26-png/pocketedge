import React from 'react';

/** Blur overlay for signed-out visitors — signed-in users see the table directly. */
export default function ChallengeLeaderboardGate({ children, onSignIn }) {
  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[280px]">
      <div className="pointer-events-none select-none blur-[6px] opacity-50 saturate-50">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8 bg-white/40 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white/85 backdrop-blur-xl shadow-lg p-8 sm:p-10 text-center">
          <p className="text-sm sm:text-base text-pe-text-secondary leading-relaxed">
            Login to see challenge details
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 pe-btn-primary w-full sm:w-auto px-8 py-3.5 text-base"
          >
            Enter the Challenge
          </button>
        </div>
      </div>
    </div>
  );
}
