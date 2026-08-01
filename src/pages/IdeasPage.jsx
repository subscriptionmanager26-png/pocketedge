import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, Flame, Lock } from 'lucide-react';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import IdeaCard from '../components/IdeaCard';
import GuestSignInCta from '../components/GuestSignInCta';
import { PortfoliosListSkeleton } from '../components/PortfolioSkeletons';
import { rememberPerson } from '../lib/socialIdentity';
import { fetchDiscoverPortfolios } from '../lib/socialPortfolioApi';
import { getPortfolioEngagementSync } from '../lib/portfolioEngagementApi';
import { getPortfolioDayReturnPct } from '../lib/ideaReturns';
import {
  IDEA_THEMES,
  countThemesForRows,
  getIdeaTheme,
  portfolioMatchesTheme,
  rankMostWatchedIdeas,
  rankTrendingIdeas,
} from '../lib/ideaThemes';

function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {Icon ? (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pe-surface text-pe-accent">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-pe-text">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-pe-text-secondary">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function ThemeTile({ theme, locked, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[5.25rem] flex-col justify-between rounded-xl border border-pe-border bg-pe-canvas px-3.5 py-3 text-left transition hover:border-pe-border-strong hover:bg-pe-surface"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold leading-snug text-pe-text">{theme.label}</span>
        {locked ? <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pe-text-muted" /> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-pe-text-secondary">
        {theme.blurb}
      </p>
    </button>
  );
}

function IdeaRail({ rows, blurReturns, onOpenPortfolio, onOpenProfile, onUnlock }) {
  if (!rows.length) {
    return <p className="px-4 text-[12px] text-pe-text-secondary">Nothing here yet.</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rows.map((row) => (
        <div key={row.portfolio.id} className="w-[260px] shrink-0">
          <IdeaCard
            portfolio={row.portfolio}
            owner={row.owner}
            compact
            blurReturns={blurReturns}
            onOpen={onOpenPortfolio}
            onOpenProfile={onOpenProfile}
            onUnlock={onUnlock}
          />
        </div>
      ))}
    </div>
  );
}

export default function IdeasPage({
  guestMode = false,
  onOpenPortfolio,
  onOpenProfile,
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeThemeId, setActiveThemeId] = useState(null);
  const [gatePulse, setGatePulse] = useState(false);
  const gateRef = useRef(null);
  const debouncedQuery = useDebouncedValue(query.trim());

  const nudgeSignIn = () => {
    setGatePulse(true);
    gateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setGatePulse(false), 1200);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDiscoverPortfolios({
      query: guestMode ? '' : debouncedQuery,
      limit: 50,
    })
      .then((next) => {
        if (cancelled) return;
        for (const row of next) {
          if (row.owner) {
            rememberPerson({
              id: row.owner.id,
              name: row.owner.name,
              handle: row.owner.handle,
              avatarUrl: row.owner.avatarUrl,
              bio: row.owner.bio,
            });
          }
        }
        setRows(
          next.map((row) => ({
            ...row,
            social: getPortfolioEngagementSync(row.portfolio.id),
            dayReturn: getPortfolioDayReturnPct(row.portfolio),
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not load ideas');
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, guestMode]);

  const themeCounts = useMemo(() => countThemesForRows(rows), [rows]);
  const trending = useMemo(() => {
    const ranked = rankTrendingIdeas(rows, 8);
    // Prefer ideas that actually have a 1D print when ranking ties are soft.
    return [...ranked].sort((a, b) => {
      const ad = a.dayReturn == null ? -999 : Math.abs(a.dayReturn);
      const bd = b.dayReturn == null ? -999 : Math.abs(b.dayReturn);
      return bd - ad;
    }).slice(0, 6);
  }, [rows]);
  const mostWatched = useMemo(() => rankMostWatchedIdeas(rows, 6), [rows]);
  const activeTheme = activeThemeId ? getIdeaTheme(activeThemeId) : null;
  const themeRows = useMemo(() => {
    if (!activeThemeId) return [];
    return rows.filter((row) => portfolioMatchesTheme(row.portfolio, activeThemeId));
  }, [rows, activeThemeId]);

  const openTheme = (themeId) => {
    if (guestMode) {
      nudgeSignIn();
      return;
    }
    setActiveThemeId(themeId);
    setQuery('');
  };

  const handleSearchChange = (e) => {
    if (guestMode) {
      nudgeSignIn();
      return;
    }
    setQuery(e.target.value);
  };

  const handleSearchFocus = () => {
    if (guestMode) nudgeSignIn();
  };

  if (activeTheme && !guestMode) {
    return (
      <div>
        <PageHeader>
          <button
            type="button"
            onClick={() => setActiveThemeId(null)}
            className="inline-flex items-center gap-1.5 text-pe-text-secondary transition hover:text-pe-text"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[15px] font-semibold text-pe-text">{activeTheme.label}</span>
          </button>
        </PageHeader>

        <div className="px-4 pt-4 pb-3">
          <p className="text-sm text-pe-text-secondary">{activeTheme.blurb}</p>
          {typeof themeCounts[activeTheme.id] === 'number' ? (
            <p className="mt-1 text-[12px] text-pe-text-muted">
              {themeCounts[activeTheme.id]} matching ideas
            </p>
          ) : null}
        </div>

        {loading ? (
          <PortfoliosListSkeleton count={3} />
        ) : !themeRows.length ? (
          <p className="px-4 py-14 text-center text-sm text-pe-text-secondary">
            No public ideas in this theme yet.
          </p>
        ) : (
          <div className="space-y-3 px-4 pb-8">
            {themeRows.map((row) => (
              <IdeaCard
                key={row.portfolio.id}
                portfolio={row.portfolio}
                owner={row.owner}
                onOpen={onOpenPortfolio}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader>
        <PageHeaderSearch
          value={guestMode ? '' : query}
          onChange={handleSearchChange}
          onFocus={handleSearchFocus}
          readOnly={guestMode}
          placeholder={guestMode ? 'Sign in to search ideas…' : 'Search ideas by narrative…'}
          autoFocus={!guestMode}
        />
      </PageHeader>

      {guestMode ? (
        <div
          ref={gateRef}
          className={`mx-0 transition ${
            gatePulse ? 'ring-2 ring-pe-accent ring-offset-2 ring-offset-pe-canvas' : ''
          }`}
        >
          <GuestSignInCta
            title="Unlock full Ideas"
            action="open themes and see unblurred returns"
            showExploreHint={false}
          />
        </div>
      ) : null}

      <section className="pb-5 pt-4">
        <div className="px-4">
          <SectionHeading
            icon={Flame}
            title="Trending"
            subtitle="Ideas with strong narratives and live 1D moves"
          />
        </div>
        {loading ? (
          <div className="px-4">
            <PortfoliosListSkeleton count={2} />
          </div>
        ) : (
          <IdeaRail
            rows={trending}
            blurReturns={guestMode}
            onOpenPortfolio={onOpenPortfolio}
            onOpenProfile={onOpenProfile}
            onUnlock={nudgeSignIn}
          />
        )}
      </section>

      <section className="border-t border-pe-border pb-5 pt-5">
        <div className="px-4">
          <SectionHeading
            icon={Eye}
            title="Most watched"
            subtitle="Stories people are paying attention to"
          />
        </div>
        {loading ? (
          <div className="px-4">
            <PortfoliosListSkeleton count={2} />
          </div>
        ) : (
          <IdeaRail
            rows={mostWatched}
            blurReturns={guestMode}
            onOpenPortfolio={onOpenPortfolio}
            onOpenProfile={onOpenProfile}
            onUnlock={nudgeSignIn}
          />
        )}
      </section>

      <section className="border-t border-pe-border px-4 pb-8 pt-5">
        <SectionHeading
          title="Browse by theme"
          subtitle="Each theme is a narrative bucket — open one to see returns and stories"
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {IDEA_THEMES.map((theme) => (
            <ThemeTile
              key={theme.id}
              theme={theme}
              locked={guestMode}
              onOpen={() => openTheme(theme.id)}
            />
          ))}
        </div>
      </section>

      {!guestMode && error ? (
        <p className="px-4 pb-8 text-center text-sm text-pe-negative">{error}</p>
      ) : null}

      {!guestMode && !loading && !error && debouncedQuery && !rows.length ? (
        <p className="px-4 pb-8 text-center text-sm text-pe-text-secondary">
          No matching ideas.
        </p>
      ) : null}
    </div>
  );
}
