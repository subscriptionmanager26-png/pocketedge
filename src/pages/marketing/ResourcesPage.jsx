import { Link } from 'react-router-dom';
import { BarChart3, Coins, LineChart } from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';

const TOOLS = [
  {
    title: 'ETF iNAV tracker',
    body: 'Track indicative NAVs for popular ETFs through the trading day.',
    icon: LineChart,
    status: 'Coming soon',
  },
  {
    title: 'SGB tracker',
    body: 'Follow Sovereign Gold Bond series prices, coupons, and maturity windows.',
    icon: Coins,
    status: 'Coming soon',
  },
  {
    title: 'MF screener',
    body: 'Screen mutual funds by category, returns, and risk — without the noise.',
    icon: BarChart3,
    status: 'Coming soon',
  },
];

export default function ResourcesPage() {
  return (
    <MarketingShell wide>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-pe-accent">Resources</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-pe-text md:text-4xl">
          Market tools
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pe-text-secondary">
          Lightweight utilities for everyday investing research. These trackers and screeners are on the
          roadmap and will land here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <article
              key={tool.title}
              className="flex flex-col rounded-xl border border-pe-border bg-pe-canvas p-5 shadow-sm"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-pe-accent-wash text-pe-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold text-pe-text">{tool.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pe-text-secondary">{tool.body}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-pe-text-muted">
                {tool.status}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-pe-text-muted">
        Looking for daily explainers instead?{' '}
        <Link to="/insights" className="font-semibold text-pe-accent hover:underline">
          Open Insights
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
