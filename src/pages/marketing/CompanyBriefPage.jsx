import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import CompanyBriefSheet from '../../components/company-brief/CompanyBriefSheet';
import { getCompanyBrief } from '../../data/companyBriefs';
import { businessModelPath, stockPath } from '../../lib/routes';
import { useSeoMeta } from '../../hooks/useSeoMeta';
import { briefSeoMeta } from '../../lib/seoCopy';

export default function CompanyBriefPage({ symbol }) {
  const ticker = String(symbol || '').toUpperCase();
  const [brief, setBrief] = useState(null);
  const [status, setStatus] = useState('loading');

  const seo = briefSeoMeta({
    name: brief?.legalName || brief?.name,
    symbol: ticker,
    kicker: brief?.kicker,
  });

  useSeoMeta({
    title: seo.title,
    description: seo.description,
    path: `/business-model/${encodeURIComponent(ticker)}`,
  });

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getCompanyBrief(symbol)
      .then((next) => {
        if (cancelled) return;
        setBrief(next);
        setStatus(next ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!cancelled) {
          setBrief(null);
          setStatus('missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (status === 'missing') {
    return <Navigate to={businessModelPath()} replace />;
  }

  return (
    <MarketingShell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            to={businessModelPath()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-accent hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Business Model
          </Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-pe-accent">
            Company Brief
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-pe-text md:text-3xl">
            {brief?.legalName || brief?.name || String(symbol || '').toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-pe-text-secondary">
            <Link
              to={stockPath(symbol)}
              className="font-semibold text-pe-accent hover:underline"
            >
              {String(symbol || '').toUpperCase()}
            </Link>
            {' · '}
            What the company does and how the business works.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!brief}
          className="inline-flex items-center gap-2 rounded-lg border border-pe-border bg-pe-canvas px-3.5 py-2 text-sm font-semibold text-pe-text transition hover:border-pe-accent/40 hover:text-pe-accent disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print / PDF
        </button>
      </div>

      {status === 'loading' || !brief ? (
        <div className="flex items-center gap-2 py-16 text-sm text-pe-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading company brief…
        </div>
      ) : (
        <CompanyBriefSheet brief={brief} />
      )}
    </MarketingShell>
  );
}
