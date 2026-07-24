import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import CompanyBriefSheet from '../../components/company-brief/CompanyBriefSheet';
import { getCompanyBrief } from '../../data/companyBriefs';
import { learningPath, stockPath } from '../../lib/routes';

export default function CompanyBriefPage({ symbol }) {
  const brief = getCompanyBrief(symbol);
  if (!brief) {
    return <Navigate to={learningPath()} replace />;
  }

  return (
    <MarketingShell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            to={learningPath()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-accent hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Learning
          </Link>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-pe-accent">
            Company Brief
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-pe-text md:text-3xl">
            {brief.legalName}
          </h1>
          <p className="mt-1 text-sm text-pe-text-secondary">
            <Link to={stockPath(brief.symbol)} className="font-semibold text-pe-accent hover:underline">
              {brief.symbol}
            </Link>
            {' · '}
            What the company does, how it earns, and what to watch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-pe-border bg-pe-canvas px-3.5 py-2 text-sm font-semibold text-pe-text transition hover:border-pe-accent/40 hover:text-pe-accent"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print / PDF
        </button>
      </div>

      <CompanyBriefSheet brief={brief} />
    </MarketingShell>
  );
}
