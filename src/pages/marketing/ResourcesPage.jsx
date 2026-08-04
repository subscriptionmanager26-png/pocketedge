import { Link } from 'react-router-dom';
import { BarChart3, Coins, LineChart } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import ResourcesPageHeader from '../../components/ResourcesPageHeader';
import { resourcesPath } from '../../lib/routes';
import { useSeoMeta } from '../../hooks/useSeoMeta';

const TOOLS = [
  {
    title: 'ETF iNAV tracker',
    body: 'Live LTP and NAV for NSE ETFs, with premium/discount vs NAV.',
    icon: LineChart,
    href: resourcesPath('etf-inav'),
    status: 'Open',
  },
  {
    title: 'SGB tracker',
    body: 'Live Sovereign Gold Bond series prices, coupons, and maturity years.',
    icon: Coins,
    href: resourcesPath('sgb'),
    status: 'Open',
  },
  {
    title: 'MF screener',
    body: 'Screen equity Direct Growth funds by category, returns, risk, and fundamentals.',
    icon: BarChart3,
    href: resourcesPath('mf-screener'),
    status: 'Open',
  },
];

export default function ResourcesPage() {
  useSeoMeta({
    title: 'Market tools',
    description:
      'ETF iNAV tracker, SGB tracker, and mutual fund screener — lightweight investing research tools on PocketEdge.',
    path: '/resources',
  });
  return (
    <MarketingShell wide>
      <ResourcesPageHeader
        title="Market tools"
        subtitle="Lightweight utilities for everyday investing research. More trackers are on the roadmap."
        className="mb-8"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const body = (
            <>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--fv-accent)]/10 text-[var(--fv-accent)]">
                <Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
              </span>
              <h2 className="fv-card-title mt-4">{tool.title}</h2>
              <p className="fv-body mt-2 flex-1 text-[var(--fv-text-secondary)]">{tool.body}</p>
              <p className="fv-caption mt-4 font-medium uppercase tracking-wide">{tool.status}</p>
            </>
          );

          if (tool.href) {
            return (
              <Link
                key={tool.title}
                to={tool.href}
                className="fv-card flex flex-col rounded-[20px] p-5 shadow-[var(--fv-shadow)] transition duration-150 hover:shadow-[var(--fv-shadow-hover)]"
              >
                {body}
              </Link>
            );
          }

          return (
            <article
              key={tool.title}
              className="fv-card flex flex-col rounded-[20px] p-5 shadow-[var(--fv-shadow)]"
            >
              {body}
            </article>
          );
        })}
      </div>

      <p className="fv-caption mt-8">
        Looking for company explainers?{' '}
        <Link
          to="/business-model"
          className="font-semibold text-[var(--fv-accent)] hover:underline"
        >
          Open Business Model
        </Link>
        {' · '}
        daily move digests on{' '}
        <Link
          to="/insights"
          className="font-semibold text-[var(--fv-accent)] hover:underline"
        >
          Insights
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
