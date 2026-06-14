import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { signInWithGoogle } from './supabase';
import { capture, captureAuthFailed, captureAuthStarted } from './analytics';

export default function RequestInviteButton({
  className = '',
  size = 'default',
  variant = 'brand',
  id,
  source = 'landing_hero',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setLoading(true);
    capture('invite_requested', { button_variant: variant, button_id: id ?? null, source });
    captureAuthStarted(source);
    try {
      await signInWithGoogle({ intent: 'waitlist' });
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
      captureAuthFailed({ source, error: err.message });
    }
  };

  const sizeClasses =
    size === 'large'
      ? 'h-16 px-12 text-lg'
      : 'h-14 px-8 text-base';

  const variantClasses =
    variant === 'dark'
      ? 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-none focus-visible:ring-neutral-400/50 rounded-full'
      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] focus-visible:ring-emerald-500/50 rounded-xl';

  return (
    <div className={className}>
      <button
        id={id}
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 font-semibold transition-all w-full sm:w-auto ${sizeClasses} ${variantClasses}`}
      >
        {loading ? 'Redirecting to Google...' : 'Request Invite'}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </button>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
