import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Eye, Flame, Lock } from 'lucide-react';
import PageHeader, { PageHeaderSearch } from '../components/PageHeader';
import PortfolioCard from '../components/PortfolioCard';
import GuestSignInCta from '../components/GuestSignInCta';
import { PortfoliosListSkeleton } from '../components/PortfolioSkeletons';
import { rememberPerson } from '../lib/socialIdentity';
import { fetchDiscoverPortfolios } from '../lib/socialPortfolioApi';
import { getPortfolioEngagementSync } from '../lib/portfolioEngagementApi';
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

function ThemeTile({ theme, count, locked, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-pe-border bg-pe-canvas px-3.5 py-3 text-left transition hover:border-pe-border-strong hover:bg-pe-surface"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold leading-snug text-pe-text">{theme.label}</span>
        {locked ? <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pe-text-muted" /> : null}
      </div>
      <div className="mt-2">
        <p className="line-clamp-2 text-[12px] leading-relaxed text-pe-text-secondary">
          {theme.blurb}
        </p>
        {typeof count === 'number' ? (
          <p className="mt-1.5 text-[12px] font-medium text-pe-text-muted">
            {count} {count === 1 ? 'idea' : 'ideas'}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function LockedIdeaRail({ label, onUnlock }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[0, 1, 2].map((i) => (
        <button
          key={`${label}-${i}`}
          type="button"
          onClick={onUnlock}
          className="w-[220px] shrink-0 rounded-xl border border-dashed border-pe-border bg-pe-surface/60 px-3.5 py-4 text-left transition hover:border-pe-border-strong"
        >
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-pe-text-muted">
            <Lock className="h-3.5 w-3.5" />
            Sign in to view
          </div>
          <div className="mt-3 h-3 w-3/5 rounded bg-pe-border/80" />
          <div className="mt-2 h-3 w-4/5 rounded bg-pe-border/50" />
          <div className="mt-4 h-8 w-full rounded-lg bg-pe-border/40" />
        </button>
      ))}
    </div>
  );
}

function IdeaRow({ row, onOpenProfile, onOpenPortfolio }) {
  const { portfolio, owner } = row;
  const social = row.social ?? getPortfolioEngagementSync(portfolio.id);
  return (
    <div className="border-b border-pe-border">
      <button
        type="button"
        onClick={() => onOpenProfile?.(owner.id)}
        className="flex w-full items-center gap-2 px-4 pt-4 text-left"
      >
        <span className="truncate text-[15px] font-semibold text-pe-text">{owner.name}</span>
        <span className="truncate text-sm text-pe-text-muted">@{owner.handle}</span>
      </button>
      <PortfolioCard
        portfolio={portfolio}
        social={social}
        canCopy
        sourceOwnerId={owner.id}
        sourceOwnerName={owner.name}
        onOpen={() => onOpenPortfolio?.(owner.id, portfolio.id)}
        onDiscuss={() => onOpenPortfolio?.(owner.id, portfolio.id)}
      />
    </div>
  );
}

function IdeaRail({ rows, onOpenProfile, onOpenPortfolio }) {
  if (!rows.length) {
    return (
      <p className="px-4 text-[12px] text-pe-text-secondary">Nothing here yet.</p>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rows.map((row) => (
        <button
          key={row.portfolio.id}
          type="button"
          onClick={() => onOpenPortfolio?.(row.owner.id, row.portfolio.id)}
          className="w-[240px] shrink-0 rounded-xl border border-pe-border bg-pe-canvas p-3.5 text-left transition hover:border-pe-border-strong hover:bg-pe-surface"
        >
          <p className="truncate text-[12px] text-pe-text-muted">@{row.owner.handle}</p>
          <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-pe-text">
            {row.portfolio.name || 'Untitled portfolio'}
          </p>
          {row.portfolio.objective ? (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-pe-text-secondary">
              {row.portfolio.objective}
            </p>
          ) : null}
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-pe-accent">
            Open
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
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
  const [loading, setLoading] = useState(!guestMode);
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
    if (guestMode) {
      setLoading(false);
      setRows([]);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDiscoverPortfolios({ query: debouncedQuery, limit: 50 })
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
  const trending = useMemo(() => rankTrendingIdeas(rows, 6), [rows]);
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

        <div className="px-4 pt-4 pb-2">
          <p className="text-sm text-pe-text-secondary">{activeTheme.blurb}</p>
        </div>

        {loading ? (
          <PortfoliosListSkeleton count={3} />
        ) : !themeRows.length ? (
          <p className="px-4 py-14 text-center text-sm text-pe-text-secondary">
            No public portfolios in this theme yet.
          </p>
        ) : (
          <div>
            {themeRows.map((row) => (
              <IdeaRow
                key={row.portfolio.id}
                row={row}
                onOpenProfile={onOpenProfile}
                onOpenPortfolio={onOpenPortfolio}
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
          placeholder={guestMode ? 'Sign in to search ideas…' : 'Search portfolios, people…'}
          autoFocus={!guestMode}
        />
      </PageHeader>

      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold tracking-tight text-pe-text">Ideas</h1>
        <p className="mt-1 text-sm text-pe-text-secondary">
          {guestMode
            ? 'Browse themes now. Sign in to open portfolios, trending, and most watched.'
            : 'Public portfolios grouped by theme — plus what’s trending and most watched.'}
        </p>
      </div>

      {guestMode ? (
        <div
          ref={gateRef}
          className={`transition ${gatePulse ? 'ring-2 ring-pe-accent ring-offset-2 ring-offset-pe-canvas' : ''}`}
        >
          <GuestSignInCta
            title="Unlock full Ideas"
            action="open themes and see trending portfolios"
            showExploreHint={false}
          />
        </div>
      ) : null}

      <section className="pb-5 pt-1">
        <div className="px-4">
          <SectionHeading
            icon={Flame}
            title="Trending"
            subtitle={
              guestMode
                ? 'Live portfolios gaining attention'
                : 'Recently active ideas with the most engagement'
            }
          />
        </div>
        {guestMode ? (
          <LockedIdeaRail label="trending" onUnlock={nudgeSignIn} />
        ) : loading ? (
          <div className="px-4">
            <PortfoliosListSkeleton count={2} />
          </div>
        ) : (
          <IdeaRail
            rows={trending}
            onOpenProfile={onOpenProfile}
            onOpenPortfolio={onOpenPortfolio}
          />
        )}
      </section>

      <section className="border-t border-pe-border pb-5 pt-5">
        <div className="px-4">
          <SectionHeading
            icon={Eye}
            title="Most watched"
            subtitle={
              guestMode
                ? 'Ideas people are saving and copying'
                : 'Portfolios with the strongest watch / copy interest'
            }
          />
        </div>
        {guestMode ? (
          <LockedIdeaRail label="watched" onUnlock={nudgeSignIn} />
        ) : loading ? (
          <div className="px-4">
            <PortfoliosListSkeleton count={2} />
          </div>
        ) : (
          <IdeaRail
            rows={mostWatched}
            onOpenProfile={onOpenProfile}
            onOpenPortfolio={onOpenPortfolio}
          />
        )}
      </section>

      <section className="border-t border-pe-border px-4 pb-8 pt-5">
        <SectionHeading
          title="Browse by theme"
          subtitle="Tap a bucket to explore matching public portfolios"
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {IDEA_THEMES.map((theme) => (
            <ThemeTile
              key={theme.id}
              theme={theme}
              count={guestMode ? undefined : themeCounts[theme.id]}
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
          No matching portfolios.
        </p>
      ) : null}
    </div>
  );
}
