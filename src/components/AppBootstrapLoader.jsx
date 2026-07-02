import React, { Suspense } from 'react';

const GlobeHero = React.lazy(() => import('../redesign/GlobeHero'));

export default function AppBootstrapLoader() {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading PocketEdge"
    >
      <Suspense fallback={null}>
        <GlobeHero />
      </Suspense>
    </div>
  );
}
