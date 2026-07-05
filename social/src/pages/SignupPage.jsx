import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import LogoMark from '../components/LogoMark';

export default function SignupPage({ onBack, onSignup, onGoLogin }) {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  const finish = (method) => {
    if (!agreed) return;
    onSignup?.({ email: method === 'google' ? 'google@pocketedge.in' : email.trim(), isNew: true });
  };

  return (
    <div className="min-h-screen bg-pe-canvas px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mx-auto mt-10 max-w-sm">
        <div className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" />
          <span className="font-serif text-xl font-bold text-pe-text">Create account</span>
        </div>
        <p className="mt-2 text-[15px] text-pe-text-secondary">Join a community of disclosed investors.</p>

        <label className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-pe-text-secondary">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          I agree to the Terms and the holdings disclosure policy
        </label>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => finish('google')}
            disabled={!agreed}
            className="w-full rounded-md border border-pe-border-strong py-3 text-[15px] font-bold text-pe-text hover:bg-pe-surface disabled:opacity-40"
          >
            Continue with Google
          </button>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-lg border border-pe-border bg-pe-surface px-3 py-3 text-[15px] outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent"
          />
          <button
            type="button"
            onClick={() => finish('email')}
            disabled={!agreed || !email.trim()}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            Continue with email
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-pe-text-secondary">
          Already have an account?{' '}
          <button type="button" onClick={onGoLogin} className="font-semibold text-pe-link hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
