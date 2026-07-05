import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import LogoMark from '../components/LogoMark';

export default function LoginPage({ onBack, onLogin, onGoSignup }) {
  const [email, setEmail] = useState('');

  const finish = (method) => {
    onLogin?.({ email: method === 'google' ? 'google@pocketedge.in' : email.trim(), isNew: false });
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
          <span className="font-serif text-xl font-bold text-pe-text">Welcome back</span>
        </div>
        <p className="mt-2 text-[15px] text-pe-text-secondary">Sign in to your investor profile.</p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => finish('google')}
            className="w-full rounded-md border border-pe-border-strong py-3 text-[15px] font-bold text-pe-text hover:bg-pe-surface"
          >
            Continue with Google
          </button>
          <div className="relative py-2 text-center text-xs text-pe-text-muted">
            <span className="bg-pe-canvas px-2">or</span>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for magic link"
            className="w-full rounded-lg border border-pe-border bg-pe-surface px-3 py-3 text-[15px] outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent"
          />
          <button
            type="button"
            onClick={() => finish('email')}
            disabled={!email.trim()}
            className="w-full rounded-md bg-pe-accent py-3 text-[15px] font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            Send link
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-pe-text-secondary">
          New here?{' '}
          <button type="button" onClick={onGoSignup} className="font-semibold text-pe-link hover:underline">
            Create account
          </button>
        </p>
      </div>
    </div>
  );
}
