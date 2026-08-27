import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RouteFallbackSkeleton } from './components/PageSkeletons';
import { parseOpenFinPath, WWW_ORIGIN } from './lib/openfinHost';

const OpenFinPage = lazy(() => import('./pages/marketing/OpenFinPage'));

function OpenFinRoute({ section }) {
  return <OpenFinPage section={section} />;
}

function LegacyRedirect({ to }) {
  return <Navigate to={to} replace />;
}

/** Social-app paths on the OpenFin host → main PocketEdge site. */
function WwwRedirect({ path }) {
  const { pathname } = useLocation();
  const target = path ?? pathname;
  useEffect(() => {
    window.location.replace(`${WWW_ORIGIN}${target}`);
  }, [target]);
  return null;
}

const SOCIAL_PATHS = [
  '/feed',
  '/activity',
  '/settings',
  '/ideas',
  '/news',
  '/portfolio',
  '/insights',
  '/explore',
  '/markets',
];

export default function OpenFinApp() {
  const { pathname } = useLocation();
  const parsed = parseOpenFinPath(pathname);

  return (
    <Suspense fallback={<RouteFallbackSkeleton />}>
      <Routes>
        <Route path="/" element={<OpenFinRoute section="products" />} />
        <Route path="/docs" element={<OpenFinRoute section="api" />} />
        <Route path="/roadmap" element={<OpenFinRoute section="roadmap" />} />
        <Route path="/openfin" element={<LegacyRedirect to="/" />} />
        <Route path="/openfin/api" element={<LegacyRedirect to="/docs" />} />
        <Route path="/openfin/roadmap" element={<LegacyRedirect to="/roadmap" />} />
        {SOCIAL_PATHS.map((path) => (
          <Route key={path} path={path} element={<LegacyRedirect to="/" />} />
        ))}
        <Route path="/@:handle/*" element={<WwwRedirect />} />
        <Route path="*" element={<OpenFinRoute section={parsed.section} />} />
      </Routes>
    </Suspense>
  );
}
