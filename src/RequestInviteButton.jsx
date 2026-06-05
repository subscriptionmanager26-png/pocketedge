import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { signInWithGoogle } from './supabase';

export default function RequestInviteButton({
  className = '',
  size = 'default',
  id,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Could not start Google sign-in.');
      setLoading(false);
    }
  };

  const sizeClasses =
    size === 'large'
      ? 'h-14 px-10 text-base'
      : 'h-14 px-8 text-sm';

  return (
    <div className={className}>
      <button
        id={id}
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all w-full sm:w-auto ${sizeClasses}`}
      >
        {loading ? 'Redirecting to Google...' : 'Request Invite'}
        {!loading && <ArrowRight className="ml-2 w-5 h-5" />}
      </button>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
