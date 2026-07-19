import { useEffect, useState } from 'react';
import { getBlurTestMode, setBlurTestMode, subscribeBlurTest } from '../lib/blurTestStore';

const OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'locked', label: 'Blurred' },
  { id: 'unlocked', label: 'Clear' },
];

export default function BlurTestBar() {
  const [mode, setMode] = useState(() => getBlurTestMode());

  useEffect(() => subscribeBlurTest(() => setMode(getBlurTestMode())), []);

  return (
    <div className="sticky bottom-[72px] z-30 border-t border-pe-border bg-pe-canvas/95 px-4 py-2 backdrop-blur-md md:bottom-0">
      <div className="mx-auto flex max-w-feed items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pe-text-muted">
          Blur test
        </p>
        <div className="flex rounded-md border border-pe-border p-0.5">
          {OPTIONS.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setBlurTestMode(option.id)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-pe-accent text-white'
                    : 'text-pe-text-secondary hover:text-pe-text'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
