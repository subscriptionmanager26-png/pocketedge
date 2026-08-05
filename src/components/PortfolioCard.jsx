import { useEffect, useState } from 'react';
import { ClipboardCheck, Copy, Heart, Share2 } from 'lucide-react';
import { CURRENT_USER, copyPortfolioForUser, getHandleForUserId } from '../data/mockData';
import { formatCount, formatPct } from '../lib/format';
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
  const isWatchlist = portfolio.kind === 'watchlist';
  if (holdings.length) {
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
        isWatchlist && Number.isFinite(fromWeight) && fromWeight > 0
          ? fromWeight
          : totalValue > 0
            ? (value / totalValue) * 100
            : Number.isFinite(fromWeight) && fromWeight > 0
              ? fromWeight
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
    <article className="mx-3 mb-4 rounded-[20px] bg-white px-4 pt-5 pb-2 shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] md:mx-6 md:mb-5 md:px-6 md:pt-6 md:pb-2.5">
      <button type="button" onClick={() => onOpen?.(portfolio.id)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-semibold tracking-tight text-pe-text">{portfolio.name}</h3>
          <PortfolioKindMetaTags portfolio={portfolio} />
        </div>
      </button>

      {topHoldings.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpen?.(portfolio.id)}
          className="mt-4 block w-full text-left"
        >
          <div className="rounded-[20px] bg-white px-3.5 py-3.5 shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-[12px] font-medium text-pe-text-muted">
              Top {TOP_N} holdings
            </p>
            <div className="mt-3 space-y-2">
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
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-pe-text">
                      {row.label}
                    </p>
                  </div>
                  <p className="shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums text-pe-text">
                    {formatPct(row.weight, { signed: false })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </button>
      ) : null}

      <div className="mt-2 grid w-full grid-cols-4 text-pe-text-secondary">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          className={`inline-flex h-8 items-center justify-start gap-1.5 rounded-lg text-[13px] font-medium transition hover:bg-black/[0.04] ${
            liked ? 'text-pe-accent' : ''
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${liked ? 'fill-current text-pe-accent' : ''}`} strokeWidth={2} />
          {formatCount(likes)}
        </button>

        <CommentEngagementButton
          count={commentCount}
          unreadCount={showUnreadComments ? social?.unreadComments ?? 0 : 0}
          onClick={handleDiscuss}
          className="h-8 justify-start px-0"
        />

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
        ) : (
          <span className="inline-flex h-8 items-center justify-start gap-1.5 text-[13px] font-medium text-pe-text-muted">
            <Copy className="h-[18px] w-[18px] opacity-40" strokeWidth={2} />
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
