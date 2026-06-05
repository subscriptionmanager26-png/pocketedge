import React, { useEffect, useState } from 'react';
import LandingPage from './LandingPage';
import WaitlistPage from './WaitlistPage';
import { supabase, isWaitlistRoute, cleanOAuthCallbackUrl, captureReferralFromUrl } from './supabase';

export default function App() {
  const [route, setRoute] = useState(() => (isWaitlistRoute() ? 'waitlist' : 'landing'));
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    captureReferralFromUrl();

    if (!supabase) {
      setBootstrapping(false);
      return;
    }

    let mounted = true;

    const finishBootstrap = (session) => {
      if (!mounted) return;
      if (session || isWaitlistRoute()) {
        if (session) cleanOAuthCallbackUrl();
        setRoute('waitlist');
      }
      setBootstrapping(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        finishBootstrap(session);
      }
      if (event === 'SIGNED_OUT') {
        if (!isWaitlistRoute()) setRoute('landing');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      finishBootstrap(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (route === 'waitlist') {
    return <WaitlistPage />;
  }

  return <LandingPage />;
}
