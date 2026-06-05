import React, { useEffect, useState } from 'react';
import LandingPage from './LandingPage';
import WaitlistPage from './WaitlistPage';
import { supabase } from './supabase';

function getRouteFromHash() {
  return window.location.hash === '#waitlist' ? 'waitlist' : 'landing';
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const syncRoute = () => setRoute(getRouteFromHash());

    const init = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && window.location.hash.startsWith('#waitlist')) {
          setRoute('waitlist');
        }
      }
      setBootstrapping(false);
    };

    init();
    window.addEventListener('hashchange', syncRoute);

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.hash = 'waitlist';
        setRoute('waitlist');
      }
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      subscription.unsubscribe();
    };
  }, []);

  const goLanding = () => {
    window.location.hash = '';
    setRoute('landing');
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (route === 'waitlist') {
    return <WaitlistPage onBack={goLanding} />;
  }

  return <LandingPage />;
}
