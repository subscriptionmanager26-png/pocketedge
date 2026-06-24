import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { enrichBasket } from '../basketCatalog';
import { getBasketUpdates } from '../basketUpdatesCatalog';
import {
  isSubscribedToBasket,
  subscribeSubscriptions,
  subscribeToBasket,
} from '../subscriptionStore';
import { getBasketDetailTabFromUrl } from '../appRoute';
import NavChart from './NavChart';
import FollowBasketPanel from './FollowBasketPanel';
import BottomSheet from './BottomSheet';
import PrimaryCta from '../../components/PrimaryCta';
import {
  capture,
  captureBasketDetailTabViewed,
  captureFollowPanelOpened,
} from '../../analytics';
import { fetchBasketNavHistory, fetchBasketNavSummary, fetchBasketConstituentWeights, isDbBasketId, missingSymbols } from '../navApi';

const VALID_TAB_IDS = new Set(['about', 'info', 'updates']);

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'info', label: 'Basket' },
  { id: 'updates', label: 'Updates' },
];

const CHART_PERIODS = ['1W', '1M', '3M', '1Y', 'ALL'];

export default function BasketDetailView({
  basket: rawBasket,
  onBack,
  onEdit,
  isOwn,
  preview = false,
}) {
  const initialTab = getBasketDetailTabFromUrl();
  const [activeTab, setActiveTab] = useState(
    VALID_TAB_IDS.has(initialTab) ? initialTab : 'about'
  );
  const [descExpanded, setDescExpanded] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('3M');
  const [followOpen, setFollowOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [navHistory, setNavHistory] = useState(null);
  const [navSummary, setNavSummary] = useState(null);
  const [constituentWeights, setConstituentWeights] = useState(null);

  const basket = useMemo(
    () =>
      enrichBasket({
        ...rawBasket,
        navHistory: navHistory ?? rawBasket?.navHistory,
        navSummary: navSummary ?? rawBasket?.navSummary,
      }),
    [rawBasket, navHistory, navSummary]
  );

  const segmentMix = basket.constituents.reduce((acc, c) => {
    const seg = c.segment || 'Other';
    acc[seg] = (acc[seg] || 0) + c.weight;
    return acc;
  }, {});

  const description = basket.description || basket.shortDescription || '';
  const canExpandDesc = description.length > 140;

  useEffect(() => {
    if (preview || !isDbBasketId(rawBasket?.id)) return undefined;
    let mounted = true;

    Promise.all([
      fetchBasketNavHistory(rawBasket.id),
      fetchBasketNavSummary(rawBasket.id),
      fetchBasketConstituentWeights(rawBasket.id),
    ])
      .then(([history, summary, weights]) => {
        if (!mounted) return;
        if (history?.length) setNavHistory(history);
        if (summary) setNavSummary(summary);
        if (weights?.length) setConstituentWeights(weights);
      })
      .catch(() => {
        // NAV tables may not exist yet — fall back to mock curve
      });

    return () => {
      mounted = false;
    };
  }, [rawBasket?.id, preview]);

  useEffect(() => {
    if (preview) return;
    capture('basket_viewed', {
      basket_id: basket.id,
      basket_name: basket.name,
      basket_type: basket.type || 'Basket',
      is_own: isOwn ?? false,
    });
  }, [basket.id, preview]);

  useEffect(() => {
    if (preview) return;
    captureBasketDetailTabViewed(basket.id, activeTab, { isOwn: isOwn ?? false });
  }, [basket.id, activeTab, preview, isOwn]);

  useEffect(() => {
    if (preview) return undefined;
    const sync = () => setSubscribed(isSubscribedToBasket(basket.id));
    sync();
    return subscribeSubscriptions(sync);
  }, [basket.id, preview]);

  return (
    <div className={`w-full ${preview ? '' : 'pb-24 lg:pb-10'}`}>
      {preview && (
        <p className="text-xs text-pe-text-secondary mb-4 px-4 sm:px-0">
          Preview — switch tabs below to see About, Basket, and Updates
        </p>
      )}

      <div
        className={
          preview
            ? ''
            : 'lg:max-w-7xl lg:mx-auto lg:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start'
        }
      >
        <div className="min-w-0">
      {!preview && onBack && (
        <nav
          aria-label="Breadcrumb"
          className="hidden lg:flex items-center gap-2 text-sm text-pe-text-muted mb-5"
        >
          <button
            type="button"
            onClick={onBack}
            className="hover:text-pe-text transition-colors"
          >
            Baskets
          </button>
          <span aria-hidden>/</span>
          <span className="text-pe-text font-medium truncate">{basket.name}</span>
        </nav>
      )}

      {/* Desktop — Cesto-style product header card */}
      <section className="hidden lg:block pe-card overflow-hidden mb-6">
        <div className="flex min-h-[200px]">
          <div className="w-[280px] xl:w-[320px] shrink-0 relative">
            {basket.imageUrl ? (
              <img src={basket.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${
                  basket.imageGradient || 'from-emerald-600 to-cyan-500'
                }`}
              />
            )}
          </div>
          <div className="flex-1 min-w-0 p-6 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-label text-[10px] font-medium uppercase tracking-widest text-pe-text-muted">
                  {basket.type || 'Basket'}
                  {isOwn && ' · Yours'}
                </p>
                <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-pe-text mt-1">
                  {basket.name}
                </h1>
                <p className="text-sm text-pe-text-muted mt-1.5">
                  by {basket.creator?.name || basket.creatorName || 'PocketEdge'}
                </p>
              </div>
              {isOwn && onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="shrink-0 h-9 px-4 rounded-lg border border-pe-border/80 text-sm font-medium text-pe-text hover:bg-neutral-50 transition-colors"
                >
                  Edit basket
                </button>
              )}
            </div>
            {description && (
              <p
                className={`text-sm leading-relaxed text-pe-text-secondary mt-4 ${
                  descExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {description}
              </p>
            )}
            {canExpandDesc && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-2 self-start font-label text-[11px] font-semibold uppercase tracking-wide text-pe-positive"
              >
                {descExpanded ? 'See less' : 'See more'}
              </button>
            )}
            <div className="mt-auto pt-4 flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-medium text-pe-text-secondary">
                {basket.weightingType === 'equal' ? 'Equal weighted' : 'Custom weighted'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-medium text-pe-text-secondary">
                Rebalance · {basket.factsheet.rebalance}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile — full-bleed hero */}
      <div className="relative h-[220px] sm:h-[260px] overflow-hidden lg:hidden">
        {basket.imageUrl ? (
          <img
            src={basket.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${
              basket.imageGradient || 'from-emerald-600 to-cyan-500'
            }`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20" />

        {!preview && onBack && (
          <div className="absolute inset-x-4 top-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="flex size-[38px] items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-transform active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </button>
            {isOwn && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="h-9 px-3 rounded-full border border-white/15 bg-black/40 text-white text-xs font-semibold backdrop-blur-md"
              >
                Edit
              </button>
            )}
          </div>
        )}

        <div className="absolute inset-x-5 bottom-3.5">
          <p className="font-label text-[10px] font-medium uppercase tracking-widest text-white/70">
            {basket.type || 'Basket'}
            {isOwn && ' · Yours'}
          </p>
          <h1 className="font-display text-[26px] sm:text-[30px] font-semibold leading-tight tracking-tight text-white mt-0.5">
            {basket.name}
          </h1>
        </div>
      </div>

      {description && (
        <div className="px-5 pt-3.5 lg:hidden">
          <p
            className={`text-[13px] leading-relaxed text-pe-text-secondary ${
              descExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {description}
          </p>
          {canExpandDesc && (
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className="mt-1 font-label text-[11px] font-semibold uppercase tracking-wide text-pe-positive"
            >
              {descExpanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      <div className="px-5 pt-4 sm:pt-5 lg:px-0 lg:pt-0">
        {navSummary?.navStatus === 'error' && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">Basket performance calculation error</p>
            <p className="mt-1 text-red-800/90">
              Missing prices for:{' '}
              {missingSymbols(navSummary.missingConids, rawBasket?.constituents).join(', ') ||
                'unknown tickers'}
              . NAV updates are paused until all required quotes are available.
            </p>
          </div>
        )}
        <NavChart data={basket.navHistory} height={160} period={chartPeriod} />

        <div className="mt-3 flex gap-1">
          {CHART_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setChartPeriod(period)}
              className={`h-8 flex-1 rounded-lg font-label text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                chartPeriod === period
                  ? 'bg-neutral-900 text-white'
                  : 'text-pe-text-muted hover:text-pe-text-secondary'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Segmented tabs — About · Basket · Updates */}
      <div className="px-5 mt-6 lg:px-0">
        <div
          role="tablist"
          className="flex items-center gap-1 rounded-[14px] border border-pe-border/80 bg-neutral-50 p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-[38px] flex-1 rounded-[10px] font-label text-xs font-medium uppercase tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-pe-text-muted hover:text-pe-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5 pb-8 sm:pb-10 lg:px-0 lg:pb-10">
        {activeTab === 'about' && <AboutTab basket={basket} isOwn={isOwn} />}
        {activeTab === 'info' && (
          <BasketInfoTab
            basket={basket}
            segmentMix={segmentMix}
            constituentWeights={constituentWeights}
          />
        )}
        {activeTab === 'updates' && (
          <UpdatesTab
            basket={basket}
            subscribed={subscribed}
            onSubscribe={() => {
              subscribeToBasket(basket.id);
              setSubscribed(true);
              capture('basket_subscribed', {
                basket_id: basket.id,
                basket_name: basket.name,
              });
            }}
          />
        )}
      </div>
        </div>

        {!preview && (
          <aside className="hidden lg:block lg:sticky lg:top-28 self-start">
            <FollowBasketPanel basket={basket} />
          </aside>
        )}
      </div>

      {!preview && (
        <>
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-pe-canvas via-pe-canvas to-transparent">
            <PrimaryCta
              type="button"
              onClick={() => {
                if (subscribed) return;
                captureFollowPanelOpened(basket.id);
                setFollowOpen(true);
              }}
              disabled={subscribed}
              fullWidth
              className="shadow-lg shadow-black/10"
            >
              {subscribed ? 'Following' : 'Start Following'}
            </PrimaryCta>
          </div>
          <BottomSheet
            open={followOpen}
            onClose={() => setFollowOpen(false)}
            title="Start Following"
          >
            <FollowBasketPanel
              basket={basket}
              onFollowed={() => {
                setSubscribed(true);
                setFollowOpen(false);
              }}
            />
          </BottomSheet>
        </>
      )}
    </div>
  );
}

function AboutTab({ basket, isOwn }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <section className="pe-card p-5 sm:p-6">
          <h2 className="pe-section-title text-base mb-4">Facts</h2>
          <dl className="grid grid-cols-2 gap-3 sm:gap-4">
            <Fact label="Launched" value={basket.factsheet.launched} />
            <Fact label="Rebalance" value={basket.factsheet.rebalance} />
            <Fact label="Benchmark" value={basket.factsheet.benchmark} />
            <Fact label="Type" value={basket.type || 'Basket'} />
          </dl>
        </section>

        <section className="pe-card overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-pe-border/60">
            <h2 className="pe-section-title text-base">Methodology</h2>
          </div>
          <ul className="divide-y divide-pe-border/60">
            {basket.methodology.map((step) => (
              <li key={step.title} className="px-5 sm:px-6 py-4">
                <h3 className="text-sm font-medium text-pe-text mb-1">{step.title}</h3>
                <p className="text-xs sm:text-sm text-pe-text-muted leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="pe-card p-5 sm:p-6">
        <h2 className="pe-section-title text-base mb-4">Risk metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <MetricCard label="Volatility" value={basket.risk.volatilityLabel} />
          <MetricCard label="Sharpe ratio" value={basket.risk.sharpeRatio.toFixed(2)} />
          <MetricCard
            label="Max drawdown"
            value={`${basket.risk.maxDrawdown}%`}
            highlight={basket.risk.maxDrawdown < 0}
          />
        </div>
      </section>

      <section className="pe-card p-5 sm:p-6">
        <h2 className="pe-section-title text-base mb-4">Fund creator</h2>
        <div className="flex gap-4">
          {basket.creator.avatarUrl ? (
            <img
              src={basket.creator.avatarUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-pe-border/80 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center text-lg font-semibold text-white shrink-0">
              {basket.creator.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-pe-text">
              {basket.creator.name}
              {isOwn && <span className="text-pe-positive text-xs ml-2">You</span>}
            </p>
            <p className="text-xs sm:text-sm text-pe-text-muted mt-1 leading-relaxed">
              {basket.creator.bio}
            </p>
            {basket.creator.links?.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-3">
                {basket.creator.links.map((link) => (
                  <li key={link.id || link.url}>
                    <a
                      href={link.url?.startsWith('http') ? link.url : `https://${link.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-pe-positive underline underline-offset-2"
                    >
                      {link.label || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BasketInfoTab({ basket, segmentMix, constituentWeights }) {
  const weightByConid = new Map(
    (constituentWeights || []).map((w) => [w.conid, w])
  );
  const showDrift =
    constituentWeights?.length > 0 &&
    constituentWeights.some(
      (w) => Math.abs(w.currentWeight - w.targetWeight) > 0.05
    );

  const hasSegmentMix = Object.keys(segmentMix).length > 0;

  return (
    <div
      className={`grid grid-cols-1 gap-4 lg:gap-6 ${
        hasSegmentMix ? 'xl:grid-cols-3' : ''
      }`}
    >
      {hasSegmentMix && (
        <section className="xl:col-span-1 pe-card p-5 sm:p-6">
          <h2 className="pe-section-title text-base mb-3">Market cap mix</h2>
          <div className="flex h-2 rounded-full overflow-hidden mb-3">
            {Object.entries(segmentMix).map(([seg, weight], i) => (
              <div
                key={seg}
                className={['bg-emerald-500', 'bg-cyan-500', 'bg-violet-500', 'bg-amber-500'][i % 4]}
                style={{ width: `${weight}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(segmentMix).map(([seg, weight]) => (
              <span key={seg} className="text-xs text-pe-text-muted">
                {seg}{' '}
                <span className="text-pe-text font-medium">{weight.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={`pe-card overflow-hidden ${hasSegmentMix ? 'xl:col-span-2' : ''}`}>
        <div className="px-5 sm:px-6 py-4 border-b border-pe-border/60 flex items-center justify-between gap-3">
          <h2 className="pe-section-title text-base">Constituents</h2>
          <div className="text-right">
            <span className="text-xs text-pe-text-muted capitalize block">
              {basket.weightingType === 'equal' ? 'Equal weighted' : 'Custom weighted'}
            </span>
            {showDrift && (
              <span className="text-[10px] text-pe-text-muted">Target vs current allocation</span>
            )}
          </div>
        </div>
        {showDrift && (
          <div className="px-5 sm:px-6 py-2 border-b border-pe-border/40 bg-neutral-50/80 text-[11px] text-pe-text-muted">
            Current weights drift from your targets as prices move between fetches.
          </div>
        )}
        <ul className="lg:grid lg:grid-cols-2">
          {basket.constituents.map((c, i) => {
            const w = weightByConid.get(Number(c.conid));
            const target = w?.targetWeight ?? c.weight;
            const current = w?.currentWeight ?? c.weight;
            const drifted = Math.abs(current - target) > 0.05;

            return (
            <li
              key={c.symbol}
              className={`flex items-center justify-between px-5 sm:px-6 py-3 border-pe-border/60 ${
                i < basket.constituents.length - 1 ? 'border-b lg:border-b' : ''
              }`}
            >
              <div>
                <div className="font-medium text-pe-text text-sm">{c.symbol}</div>
                <div className="text-xs text-pe-text-muted">{c.name}</div>
              </div>
              <div className="text-right">
                {showDrift ? (
                  <>
                    <div className="text-[10px] uppercase tracking-wide text-pe-text-muted">
                      Target / Current
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      <span className="text-pe-text">{target.toFixed(1)}%</span>
                      <span className="text-pe-text-muted mx-1">/</span>
                      <span className={drifted ? 'text-amber-700' : 'text-pe-positive'}>
                        {current.toFixed(1)}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm font-semibold text-pe-positive">{target}%</div>
                )}
                {c.segment && <div className="text-[10px] text-pe-text-muted">{c.segment}</div>}
              </div>
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function UpdatesTab({ basket, subscribed, onSubscribe }) {
  const updates = getBasketUpdates(basket.id);

  if (!subscribed) {
    return (
      <div className="pe-card p-6 text-center">
        <h2 className="pe-section-title text-base">Basket updates</h2>
        <p className="text-sm text-pe-text-muted mt-2 leading-relaxed max-w-md mx-auto">
          Subscribe to this basket to see rebalance alerts and allocation changes — like
          which stocks were trimmed or added.
        </p>
        <PrimaryCta type="button" onClick={onSubscribe} className="mt-5">
          Subscribe for updates
        </PrimaryCta>
        <p className="text-[11px] text-pe-text-muted mt-3">
          Tracking an investment on this basket also subscribes you.
        </p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="pe-card p-6 text-center">
        <h2 className="pe-section-title text-base">No updates yet</h2>
        <p className="text-sm text-pe-text-muted mt-2">
          You&apos;re subscribed. Rebalance and constituent changes will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {updates.map((update) => (
        <article key={update.id} className="pe-card overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-pe-border/60 flex items-center justify-between gap-3">
            <h2 className="pe-section-title text-base">{update.title}</h2>
            <p className="text-xs text-pe-text-muted shrink-0">
              {new Date(update.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <ul className="divide-y divide-pe-border/60">
            {update.changes
              .filter((change) => change.action !== 'unchanged')
              .map((change) => (
                <li
                  key={`${update.id}-${change.symbol}`}
                  className="px-5 sm:px-6 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pe-text">{change.symbol}</p>
                    <p className="text-xs text-pe-text-muted truncate">{change.name}</p>
                  </div>
                  <p
                    className={`text-sm font-medium tabular-nums shrink-0 ${
                      change.action === 'increased' || change.action === 'added'
                        ? 'text-pe-positive'
                        : 'text-pe-negative'
                    }`}
                  >
                    {change.action === 'added'
                      ? `→ ${change.to}%`
                      : change.action === 'removed'
                        ? `${change.from}% → —`
                        : `${change.from}% → ${change.to}%`}
                  </p>
                </li>
              ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="pe-label text-[10px]">{label}</dt>
      <dd className="text-sm text-pe-text font-medium mt-0.5">{value}</dd>
    </div>
  );
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className="bg-neutral-50 border border-pe-border/60 rounded-xl p-3">
      <p className="pe-label text-[10px]">{label}</p>
      <p
        className={`text-lg font-semibold mt-1 ${
          highlight ? 'text-pe-negative' : 'text-pe-text'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
