import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';

/**
 * Soft gate CTA for guest surfaces — Material-inspired, benefit-led.
 *
 * @param {'hero' | 'section' | 'compact'} [variant]
 */
export default function GuestSignInCta({
  action = 'unlock this',
  title = null,
  description = null,
  showExploreHint = true,
  variant = 'section',
  benefits = null,
}) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch {
      setLoading(false);
    }
  };

  const headline = title || 'Sign in to continue';
  const body =
    description ||
    `Sign in to ${action} — follow investors, track portfolios, and get daily insights.`;

  const defaultBenefits = benefits ?? [
    'See live portfolio performance',
    'Follow top investors & ideas',
    'Unlock AI insights & news',
  ];

  if (variant === 'compact') {
    return (
      <div className="mx-4 my-4 flex items-center gap-3 rounded-2xl border border-pe-border bg-white px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pe-accent-wash text-pe-accent">
          <Lock className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-pe-text">{headline}</p>
          <p className="truncate text-[12px] text-pe-text-secondary">{body}</p>
        </div>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="shrink-0 rounded-full bg-pe-accent px-3.5 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(255,103,25,0.35)] transition hover:bg-pe-accent-pressed disabled:opacity-60"
        >
          {loading ? '…' : 'Sign in'}
        </button>
      </div>
    );
  }

  const isHero = variant === 'hero';

  return (
    <div
      className={`relative mx-4 overflow-hidden rounded-2xl border border-pe-border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] ${
        isHero ? 'my-6' : 'my-5'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(120%_80%_at_50%_-20%,color-mix(in_srgb,var(--pe-accent)_18%,transparent),transparent)]"
        aria-hidden
      />
      <div className={`relative px-5 ${isHero ? 'pb-6 pt-7' : 'pb-5 pt-6'} text-center`}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pe-accent-wash text-pe-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--pe-accent)_20%,transparent)]">
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h2
          className={`mt-4 font-semibold tracking-tight text-pe-text ${
            isHero ? 'text-[22px] leading-7' : 'text-[18px] leading-6'
          }`}
        >
          {headline}
        </h2>
        <p className="mx-auto mt-2 max-w-[22rem] text-[14px] leading-relaxed text-pe-text-secondary">
          {body}
        </p>

        {isHero || variant === 'section' ? (
          <ul className="mx-auto mt-4 max-w-[18rem] space-y-2 text-left">
            {defaultBenefits.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-pe-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pe-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="mt-5 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-pe-accent px-5 py-3 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(255,103,25,0.35)] transition hover:bg-pe-accent-pressed hover:shadow-[0_6px_18px_rgba(255,103,25,0.4)] disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {showExploreHint ? (
          <p className="mt-3 text-[12px] text-pe-text-muted">
            Or keep browsing{' '}
            <Link to="/ideas" className="font-semibold text-pe-accent hover:underline">
              Ideas
            </Link>
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-pe-text-muted">Free to join · Takes under a minute</p>
        )}
      </div>
    </div>
  );
}
