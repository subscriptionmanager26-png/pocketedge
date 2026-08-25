import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Coins,
  Database,
  ExternalLink,
  Layers,
  LineChart,
  MessageSquarePlus,
  Sparkles,
  Users,
} from 'lucide-react';
import MarketingShell from '../../components/MarketingShell';
import ResourcesPageHeader from '../../components/ResourcesPageHeader';
import UnderlineTabs from '../../components/UnderlineTabs';
import {
  businessModelPath,
  insightsPath,
  openfinPath,
  resourcesPath,
} from '../../lib/routes';
import { useSeoMeta } from '../../hooks/useSeoMeta';

const TABS = [
  { id: 'products', label: 'Products' },
  { id: 'api', label: 'API docs' },
  { id: 'roadmap', label: 'Roadmap' },
];

const PRODUCT_GROUPS = [
  {
    title: 'Open data',
    items: [
      {
        title: 'Fund holdings API',
        body: 'MF portfolio books by AMFI code with rolling as-of history. JSON on CDN, proxied at /api/v1.',
        icon: Database,
        href: openfinPath('api'),
        status: 'Live',
        external: false,
      },
    ],
  },
  {
    title: 'Market tools',
    items: [
      {
        title: 'ETF iNAV tracker',
        body: 'Live LTP and NAV for NSE ETFs, with premium/discount vs NAV.',
        icon: LineChart,
        href: resourcesPath('etf-inav'),
        status: 'Open',
        external: false,
      },
      {
        title: 'SGB tracker',
        body: 'Sovereign Gold Bond series prices, coupons, and maturity years.',
        icon: Coins,
        href: resourcesPath('sgb'),
        status: 'Open',
        external: false,
      },
      {
        title: 'MF screener',
        body: 'Screen equity Direct Growth funds by category, returns, and risk.',
        icon: BarChart3,
        href: resourcesPath('mf-screener'),
        status: 'Open',
        external: false,
      },
    ],
  },
  {
    title: 'Research',
    items: [
      {
        title: 'Insights',
        body: 'Daily move explainers for Indian markets.',
        icon: Sparkles,
        href: insightsPath(),
        status: 'Open',
        external: false,
      },
      {
        title: 'Business Model',
        body: 'Company briefs — how listed businesses make money.',
        icon: BookOpen,
        href: businessModelPath(),
        status: 'Open',
        external: false,
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        title: 'PocketEdge social',
        body: 'Follow investors, share theses, and track portfolios.',
        icon: Users,
        href: '/feed',
        status: 'Live',
        external: false,
      },
      {
        title: 'Global tools',
        body: 'UCITS ladder, leaderboard, and cross-market utilities.',
        icon: Layers,
        href: 'https://global.pocketedge.in',
        status: 'Open',
        external: true,
      },
    ],
  },
];

const API_ENDPOINTS = [
  {
    id: 'discovery',
    method: 'GET',
    path: '/api/v1',
    summary: 'API discovery — lists all endpoints and usage notes.',
  },
  {
    id: 'holdings',
    method: 'GET',
    path: '/api/v1/holdings/{amfi}',
    summary: 'Holdings book for an AMFI scheme code. Optional ?as_of=YYYY-MM-DD.',
    example: '/api/v1/holdings/120503?as_of=2026-07-31',
  },
  {
    id: 'filings',
    method: 'GET',
    path: '/api/v1/filings',
    summary: 'Published as-of dates with portfolio counts per slice.',
  },
  {
    id: 'catalog',
    method: 'GET',
    path: '/api/v1/catalog',
    summary: 'AMFI lookup catalog — maps codes to portfolio_id and available as-of dates.',
  },
  {
    id: 'portfolio',
    method: 'GET',
    path: '/api/v1/portfolios/{portfolio_id}',
    summary: 'Raw portfolio JSON from GitHub CDN (commit-pinned via meta).',
  },
  {
    id: 'stats',
    method: 'GET',
    path: '/api/v1/stats',
    summary: 'Public aggregate API usage (last 30 days) for the OpenFin dashboard.',
  },
  {
    id: 'meta',
    method: 'GET',
    path: '/api/v1/meta',
    summary: 'Dataset metadata — commit SHA, CDN templates, last sync.',
  },
];

function ProductCard({ item }) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--fv-accent)]/10 text-[var(--fv-accent)]">
        <Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
      </span>
      <div className="mt-4 flex items-start justify-between gap-2">
        <h3 className="fv-card-title">{item.title}</h3>
        {item.external ? (
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fv-text-muted)]" aria-hidden />
        ) : null}
      </div>
      <p className="fv-body mt-2 flex-1 text-[var(--fv-text-secondary)]">{item.body}</p>
      <p className="fv-caption mt-4 font-medium uppercase tracking-wide text-[var(--fv-text-muted)]">
        {item.status}
      </p>
    </>
  );

  const className =
    'fv-card flex flex-col rounded-[20px] p-5 shadow-[var(--fv-shadow)] transition duration-150 hover:shadow-[var(--fv-shadow-hover)]';

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link to={item.href} className={className}>
      {body}
    </Link>
  );
}

function ProductsPanel() {
  return (
    <div className="space-y-10">
      {PRODUCT_GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
            {group.title}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <ProductCard key={item.title} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ApiUsagePanel() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/stats');
        if (!res.ok) throw new Error('Could not load usage stats');
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="fv-card rounded-[20px] p-5 shadow-[var(--fv-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="fv-card-title">API usage</h2>
        <a
          href="/api/v1/stats"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--fv-accent)] hover:underline"
        >
          Raw JSON
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <p className="fv-body mt-2 text-[var(--fv-text-secondary)]">
        Daily request counts for edge-handled OpenFin routes. Updated on each API call.
      </p>
      {error ? (
        <p className="mt-3 text-[14px] text-[var(--fv-negative)]">{error}</p>
      ) : !stats ? (
        <p className="mt-3 text-[14px] text-[var(--fv-text-muted)]">Loading usage…</p>
      ) : !stats.tracking ? (
        <p className="mt-3 text-[14px] text-[var(--fv-text-muted)]">
          {stats.message || 'Usage tracking is not enabled on this deployment.'}
        </p>
      ) : (
        <>
          <p className="mt-4 text-[28px] font-semibold tabular-nums tracking-tight text-[var(--fv-text)]">
            {stats.total_requests?.toLocaleString() ?? 0}
            <span className="ml-2 text-[14px] font-medium text-[var(--fv-text-muted)]">
              requests · last {stats.window_days ?? 30} days
            </span>
          </p>
          {stats.by_endpoint?.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--fv-border)] text-[12px] uppercase tracking-wide text-[var(--fv-text-muted)]">
                    <th className="py-2 pr-4 font-semibold">Endpoint</th>
                    <th className="py-2 font-semibold text-right">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_endpoint.map((row) => (
                    <tr
                      key={row.endpoint}
                      className="border-b border-[var(--fv-border)]/70"
                    >
                      <td className="py-2.5 pr-4 font-medium">{row.endpoint}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {row.request_count?.toLocaleString?.() ?? row.request_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-[var(--fv-text-muted)]">
              No requests recorded yet.
            </p>
          )}
          {stats.note ? (
            <p className="fv-caption mt-4 text-[var(--fv-text-muted)]">{stats.note}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function ApiDocsPanel() {
  const [discovery, setDiscovery] = useState(null);
  const [filings, setFilings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [discRes, filRes] = await Promise.all([
          fetch('/api/v1'),
          fetch('/api/v1/filings'),
        ]);
        if (!discRes.ok || !filRes.ok) {
          throw new Error('Could not load live API metadata');
        }
        const [disc, fil] = await Promise.all([discRes.json(), filRes.json()]);
        if (!cancelled) {
          setDiscovery(disc);
          setFilings(fil);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <ApiUsagePanel />

      <section className="fv-card rounded-[20px] p-5 shadow-[var(--fv-shadow)]">
        <h2 className="fv-card-title">Overview</h2>
        <p className="fv-body mt-2 max-w-3xl text-[var(--fv-text-secondary)]">
          PocketEdge fund holdings API v1 serves mutual fund portfolio disclosures from the{' '}
          <code className="rounded bg-[var(--fv-border)]/40 px-1.5 py-0.5 text-[13px]">
            fund-holdings-data
          </code>{' '}
          GitHub repo. Responses are JSON; catalog and portfolio routes are commit-pinned via{' '}
          <code className="rounded bg-[var(--fv-border)]/40 px-1.5 py-0.5 text-[13px]">meta.json</code>.
          No API key required for read access.
        </p>
        {discovery?.notes?.length ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[14px] text-[var(--fv-text-secondary)]">
            {discovery.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fv-text-muted)]">
          Endpoints
        </h2>
        <div className="mt-4 space-y-3">
          {API_ENDPOINTS.map((ep) => (
            <article
              key={ep.id}
              className="fv-card rounded-[20px] p-4 shadow-[var(--fv-shadow)] md:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--fv-accent)]/10 px-2.5 py-0.5 text-[12px] font-semibold text-[var(--fv-accent)]">
                  {ep.method}
                </span>
                <code className="text-[14px] font-medium text-[var(--fv-text)]">{ep.path}</code>
                <a
                  href={ep.example || ep.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--fv-accent)] hover:underline"
                >
                  Try live
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
              <p className="fv-body mt-2 text-[var(--fv-text-secondary)]">{ep.summary}</p>
              {ep.example ? (
                <p className="mt-2 text-[13px] text-[var(--fv-text-muted)]">
                  Example:{' '}
                  <a
                    href={ep.example}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[var(--fv-accent)] hover:underline"
                  >
                    {ep.example}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="fv-card rounded-[20px] p-5 shadow-[var(--fv-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="fv-card-title">Published filings</h2>
          <a
            href="/api/v1/filings"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--fv-accent)] hover:underline"
          >
            Raw JSON
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        {error ? (
          <p className="mt-3 text-[14px] text-[var(--fv-negative)]">{error}</p>
        ) : !filings ? (
          <p className="mt-3 text-[14px] text-[var(--fv-text-muted)]">Loading live counts…</p>
        ) : (
          <>
            <p className="fv-caption mt-1 text-[var(--fv-text-muted)]">
              Generated {filings.generated_at ? new Date(filings.generated_at).toLocaleString() : '—'}
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--fv-border)] text-[12px] uppercase tracking-wide text-[var(--fv-text-muted)]">
                    <th className="py-2 pr-4 font-semibold">As of</th>
                    <th className="py-2 pr-4 font-semibold">Cadence</th>
                    <th className="py-2 font-semibold text-right">Portfolios</th>
                  </tr>
                </thead>
                <tbody>
                  {(filings.filings || []).map((row) => (
                    <tr key={`${row.as_of}-${row.cadence}`} className="border-b border-[var(--fv-border)]/70">
                      <td className="py-2.5 pr-4 font-medium">{row.as_of}</td>
                      <td className="py-2.5 pr-4 capitalize text-[var(--fv-text-secondary)]">
                        {row.cadence || '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{row.portfolio_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function RoadmapPanel({ roadmap }) {
  const columns = roadmap?.columns || [];
  const items = roadmap?.items || [];
  const byStatus = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c.id, []]));
    for (const item of items) {
      if (map[item.status]) map[item.status].push(item);
    }
    return map;
  }, [columns, items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--fv-text-secondary)]">
          Public kanban for OpenFin products and APIs. Request features on GitHub — we triage into
          Planned → In progress → Shipped.
        </p>
        {roadmap?.request_issue_url ? (
          <a
            href={roadmap.request_issue_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--fv-accent)] px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            Request a feature
          </a>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <section
            key={col.id}
            className="flex min-h-[280px] flex-col rounded-[20px] bg-white p-4 shadow-[var(--fv-shadow)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[var(--fv-text)]">{col.title}</h3>
              <span className="rounded-full bg-[var(--fv-border)]/50 px-2 py-0.5 text-[12px] font-medium text-[var(--fv-text-muted)]">
                {(byStatus[col.id] || []).length}
              </span>
            </div>
            <ul className="flex flex-1 flex-col gap-3">
              {(byStatus[col.id] || []).map((item) => (
                <li
                  key={item.id}
                  className="rounded-[14px] border border-[var(--fv-border)] bg-white p-3"
                >
                  <p className="text-[14px] font-semibold leading-snug text-[var(--fv-text)]">
                    {item.title}
                  </p>
                  {item.summary ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fv-text-secondary)]">
                      {item.summary}
                    </p>
                  ) : null}
                  {item.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--fv-accent)]/8 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--fv-accent)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {roadmap?.updated_at ? (
        <p className="fv-caption text-[var(--fv-text-muted)]">
          Roadmap data last updated {roadmap.updated_at}. Edit via{' '}
          <code className="rounded bg-[var(--fv-border)]/40 px-1 py-0.5">public/data/openfin-roadmap.json</code>{' '}
          or open a GitHub issue.
        </p>
      ) : null}
    </div>
  );
}

export default function OpenFinPage({ section = 'products' }) {
  const navigate = useNavigate();
  const tab = TABS.some((t) => t.id === section) ? section : 'products';
  const [roadmap, setRoadmap] = useState(null);

  useSeoMeta({
    title: tab === 'api' ? 'OpenFin API docs' : tab === 'roadmap' ? 'OpenFin roadmap' : 'OpenFin',
    description:
      'Directory of PocketEdge open products — fund holdings API, market tools, API documentation, and community roadmap.',
    path: openfinPath(tab === 'products' ? null : tab),
  });

  useEffect(() => {
    if (tab !== 'roadmap') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/data/openfin-roadmap.json');
        if (!res.ok) throw new Error('Could not load roadmap');
        const data = await res.json();
        if (!cancelled) setRoadmap(data);
      } catch {
        if (!cancelled) setRoadmap({ columns: [], items: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <MarketingShell wide>
      <ResourcesPageHeader
        title="OpenFin"
        subtitle="Open products, data APIs, and the public roadmap for PocketEdge investing tools."
        meta={
          <p className="text-[13px] text-[var(--fv-text-muted)]">
            Built for researchers, developers, and the investing community in India.
          </p>
        }
        className="mb-6"
      />

      <UnderlineTabs
        tabs={TABS}
        active={tab}
        onChange={(id) => navigate(openfinPath(id === 'products' ? null : id))}
        className="mb-8 px-0"
      />

      {tab === 'products' ? <ProductsPanel /> : null}
      {tab === 'api' ? <ApiDocsPanel /> : null}
      {tab === 'roadmap' ? <RoadmapPanel roadmap={roadmap} /> : null}
    </MarketingShell>
  );
}
