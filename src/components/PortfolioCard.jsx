import { useEffect, useState } from 'react';
import { ClipboardCheck, Copy, Heart, Share2 } from 'lucide-react';
import { CURRENT_USER, copyPortfolioForUser, getHandleForUserId } from '../data/mockData';
import { formatCount, formatPct, pnlClass } from '../lib/format';
import { holdingDisplayLabel } from '../lib/portfolioAssetUniverse';
import AssetLogo from './AssetLogo';
import CommentEngagementButton from './CommentEngagementButton';
import PortfolioShareSheet from './PortfolioShareSheet';
import { PortfolioKindMetaTags } from './PortfolioMetaTag';
import {
  confirmPortfolioCopy,
  togglePortfolioCopy,
  togglePortfolioLike,
} from '../lib/portfolioEngagementApi';
import { getAppCurrentUserId } from '../lib/socialIdentity';

const TOP_N = 4;

function getPositions(portfolio) {
  const holdings = portfolio.holdings ?? [];
  if (holdings.length) {
    const totalValue = holdings.reduce((sum, h) => sum + (Number(h.value) || 0), 0);
    return holdings.map((h) => {
      const fromWeight = Number(h.weightPct ?? h.weight);
      const weight =
        Number.isFinite(fromWeight) && fromWeight > 0
          ? fromWeight
          : totalValue > 0
            ? ((Number(h.value) || 0) / totalValue) * 100
            : 0;
      return {
        ticker: h.ticker,
        label: holdingDisplayLabel(h),
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

function getTopHoldings(portfolio) {
  return getPositions(portfolio)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, TOP_N);
}

export default function PortfolioCard({
  portfolio,
  returnPct = 0,
  social,
  canCopy = false,
  showUnreadComments = false,
  sourceOwnerId,
  sourceOwnerName,
  onPortfolioCopied,
  onOpen,
  onDiscuss,
}) {
  const [liked, setLiked] = useState(social?.liked ?? false);
  const [copied, setCopied] = useState(social?.copied ?? false);
  const [likes, setLikes] = useState(social?.likes ?? 0);
  const [copies, setCopies] = useState(social?.copies ?? 0);
  const [shares, setShares] = useState(social?.shares ?? 0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setLiked(social?.liked ?? false);
    setCopied(social?.copied ?? false);
    setLikes(social?.likes ?? 0);
    setCopies(social?.copies ?? 0);
    setShares(social?.shares ?? 0);
  }, [social?.liked, social?.copied, social?.likes, social?.copies, social?.shares, portfolio.id]);

  const topHoldings = getTopHoldings(portfolio);
  const commentCount = social?.comments?.length ?? 0;

  const handleLike = (event) => {
    event.stopPropagation();
    togglePortfolioLike(portfolio.id);
  };

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

  const handleDiscuss = (event) => {
    event.stopPropagation();
    onDiscuss?.(portfolio.id);
  };

  return (
    <article className="border-b border-pe-border px-4 py-5 transition hover:bg-pe-surface/40 md:py-6">
      <button type="button" onClick={() => onOpen?.(portfolio.id)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-pe-text">{portfolio.name}</h3>
              <PortfolioKindMetaTags portfolio={portfolio} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
              Unrealised gains
            </p>
            <p className={`mt-0.5 text-lg font-bold tabular-nums ${pnlClass(returnPct)}`}>
              {formatPct(returnPct)}
            </p>
          </div>
        </div>
      </button>

      {topHoldings.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpen?.(portfolio.id)}
          className="mt-4 block w-full text-left"
        >
          <div className="rounded-[12px] border border-pe-border bg-white px-3.5 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
              Top {TOP_N} holdings
            </p>
            <div className="mt-3 space-y-2">
              {topHoldings.map((row) => (
                <div key={row.ticker} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AssetLogo
                      logoIconUrl={row.logoIconUrl}
                      assetType={row.assetType}
                      assetKey={row.ticker}
                      name={row.label}
                      size="xs"
                    />
                    <p className="truncate text-[14px] font-semibold text-pe-text">{row.label}</p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-pe-text">
                    {formatPct(row.weight, { signed: false })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </button>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-5 text-pe-text-secondary">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 text-sm transition ${
            liked ? 'text-pe-accent' : 'hover:text-pe-accent'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current text-pe-accent' : ''}`} />
          {formatCount(likes)}
        </button>

        <CommentEngagementButton
          count={commentCount}
          unreadCount={showUnreadComments ? social?.unreadComments ?? 0 : 0}
          onClick={handleDiscuss}
        />

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
        >
          <Share2 className="h-4 w-4" />
          {formatCount(shares)}
        </button>

        {canCopy ? (
          <button
            type="button"
            onClick={handleCopy}
            aria-pressed={copied}
            className={`inline-flex items-center gap-1.5 text-sm transition ${
              copied ? 'text-pe-accent' : 'hover:text-pe-text'
            }`}
          >
            {copied ? (
              <ClipboardCheck className="h-4 w-4 text-pe-accent" />
            ) : (
              <Copy className="h-4 w-4 text-pe-text-secondary" />
            )}
            {formatCount(copies)}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-pe-text-muted">
            <Copy className="h-4 w-4 opacity-40" />
            {formatCount(copies)}
          </span>
        )}
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
