import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Copy, Share2 } from 'lucide-react';
import {
  CURRENT_USER,
  copyPortfolioForUser,
  getHandleForUserId,
} from '../data/mockData';
import { formatCount } from '../lib/format';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import AssetLogo from './AssetLogo';
import PortfolioShareSheet from './PortfolioShareSheet';
import { PortfolioKindMetaTags } from './PortfolioMetaTag';
import {
  confirmPortfolioCopy,
  togglePortfolioCopy,
} from '../lib/portfolioEngagementApi';
import { getAppCurrentUserId } from '../lib/socialIdentity';

const TOP_N = 3;

function listLabel(h) {
  const ticker = String(h.ticker ?? '').trim().toUpperCase();
  const name = String(h.assetName ?? h.name ?? '').trim();
  const assetType = h.assetType ?? 'stock';
  const isFund = assetType === 'fund' || (/^\d{6,}$/.test(ticker) && Boolean(name));
  if (isFund) return name || ticker || holdingDisplayLabel(h);
  return name || ticker || holdingDisplayLabel(h);
}

function getPositions(portfolio) {
  const holdings = portfolio.holdings ?? [];
  const isWatchlist = portfolio.kind === 'watchlist';
  if (holdings.length) {
    if (isWatchlist) {
      const explicit = holdings.map((h) => Number(h.weightPct ?? h.weight));
      const allExplicit = explicit.every((w) => Number.isFinite(w) && w > 0);
      const equal = 100 / holdings.length;
      return holdings.map((h, index) => ({
        ticker: h.ticker,
        label: listLabel(h),
        assetType: h.assetType ?? 'stock',
        logoIconUrl: h.logoIconUrl ?? null,
        weight: allExplicit ? explicit[index] : equal,
      }));
    }

    const totalValue = holdings.reduce((sum, h) => {
      const qty = Number(h.qty) || 0;
      const price = Number(h.price) || Number(h.avg) || 0;
      const live = qty > 0 ? qty * price : 0;
      return sum + (live > 0 ? live : Number(h.value) || 0);
    }, 0);
    return holdings.map((h) => {
      const qty = Number(h.qty) || 0;
      const price = Number(h.price) || Number(h.avg) || 0;
      const liveValue = qty > 0 ? qty * price : 0;
      const value = liveValue > 0 ? liveValue : Number(h.value) || 0;
      const fromWeight = Number(h.weightPct ?? h.weight);
      const weight =
        totalValue > 0
          ? (value / totalValue) * 100
          : Number.isFinite(fromWeight) && fromWeight > 0
            ? fromWeight
            : 0;
      return {
        ticker: h.ticker,
        label: listLabel(h),
        assetType: h.assetType ?? 'stock',
        logoIconUrl: h.logoIconUrl ?? null,
        weight,
      };
    });
  }

  const tickers = portfolio.tickers ?? [];
  const weight = tickers.length ? 100 / tickers.length : 0;
  return tickers.map((ticker) => ({
    ticker,
    label: holdingDisplayLabel({ ticker }),
    assetType: 'stock',
    logoIconUrl: null,
    weight,
  }));
}

function holdingCount(portfolio) {
  const fromHoldings = (portfolio.holdings ?? []).filter(Boolean).length;
  if (fromHoldings) return fromHoldings;
  return (portfolio.tickers ?? []).filter(Boolean).length;
}

export default function PortfolioCard({
  portfolio,
  social,
  canCopy = false,
  sourceOwnerId,
  sourceOwnerName,
  onPortfolioCopied,
  onOpen,
}) {
  const [copied, setCopied] = useState(social?.copied ?? false);
  const [copies, setCopies] = useState(social?.copies ?? 0);
  const [shares, setShares] = useState(social?.shares ?? 0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setCopied(social?.copied ?? false);
    setCopies(social?.copies ?? 0);
    setShares(social?.shares ?? 0);
  }, [social?.copied, social?.copies, social?.shares, portfolio.id]);

  const isWatchlist = portfolio.kind === 'watchlist';
  const count = holdingCount(portfolio);
  const topHoldings = useMemo(
    () =>
      getPositions(portfolio)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, TOP_N),
    [portfolio]
  );

  const handleCopy = async (event) => {
    event.stopPropagation();
    if (!canCopy) return;
    const wasCopied = copied;
    togglePortfolioCopy(portfolio.id);
    if (!wasCopied) {
      try {
        const next = await confirmPortfolioCopy(portfolio.id);
        if (next.copied) {
          copyPortfolioForUser(getAppCurrentUserId(), portfolio, {
            sourceUserId: sourceOwnerId,
            sourceUserName: sourceOwnerName,
          });
          onPortfolioCopied?.();
        }
      } catch (err) {
        console.error('confirmPortfolioCopy failed', err);
      }
    }
  };

  const handleShare = (event) => {
    event.stopPropagation();
    setShareOpen(true);
  };

  return (
    <article className="border-b border-[var(--fv-border,#ececec)] px-4 py-5 last:border-b-0 md:px-6">
      <button type="button" onClick={() => onOpen?.(portfolio.id)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-semibold tracking-tight text-pe-text">{portfolio.name}</h3>
          <PortfolioKindMetaTags portfolio={portfolio} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pe-text-muted">
              Total holdings
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-pe-text">
              {count.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {topHoldings.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[12px] font-medium text-pe-text-muted">Top holdings</p>
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-pe-text-muted">
                Alloc.
              </p>
            </div>
            <div className="mt-2 space-y-2.5">
              {topHoldings.map((row) => (
                <div key={row.ticker} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <AssetLogo
                      logoIconUrl={row.logoIconUrl}
                      assetType={row.assetType}
                      assetKey={row.ticker}
                      name={row.label}
                      size="xs"
                    />
                    <p className="text-[14px] font-semibold leading-snug text-pe-text break-words">
                      {row.label}
                    </p>
                  </div>
                  <p className="shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-pe-text-secondary">
                    {formatPct(row.weight, { signed: false })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </button>

      <div className="mt-3 flex w-full items-center gap-6 text-pe-text-secondary">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04]"
        >
          <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
          {formatCount(shares)}
        </button>

        {canCopy ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-pressed={copied}
            className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${
              copied ? 'text-pe-accent' : ''
            }`}
          >
            {copied ? (
              <ClipboardCheck className="h-[18px] w-[18px] text-pe-accent" strokeWidth={2} />
            ) : (
              <Copy className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
            {formatCount(copies)}
          </button>
        ) : null}
      </div>

      <PortfolioShareSheet
        open={shareOpen}
        portfolio={portfolio}
        ownerHandle={getHandleForUserId(sourceOwnerId ?? CURRENT_USER.id)}
        onClose={() => setShareOpen(false)}
        onSharesUpdated={setShares}
      />
    </article>
  );
}
