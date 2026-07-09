import { useState } from 'react';
import { ClipboardCheck, Copy, Heart, MessageCircle, Share2 } from 'lucide-react';
import { CURRENT_USER, STOCKS, copyPortfolioForUser } from '../data/mockData';
import { formatCount, formatPct, pnlClass } from '../lib/format';
import { formatTicker } from '../lib/tickers';
import { PortfolioKindMetaTags } from './PortfolioMetaTag';
import {
  incrementPortfolioShare,
  togglePortfolioCopy,
  togglePortfolioLike,
} from '../lib/portfolioSocialStore';

const TOP_N = 4;

function getPositions(portfolio) {
  const holdings = portfolio.holdings ?? [];
  if (holdings.length) {
    const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    return holdings.map((h) => ({
      ticker: h.ticker,
      label: formatTicker(h.ticker),
      weight: totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0,
    }));
  }

  const tickers = portfolio.tickers ?? [];
  const weight = tickers.length ? 100 / tickers.length : 0;
  return tickers.map((ticker) => ({
    ticker,
    label: formatTicker(ticker),
    weight,
  }));
}

export default function PortfolioCard({
  portfolio,
  returnPct = 0,
  social,
  canCopy = false,
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

  const topHoldings = getPositions(portfolio).sort((a, b) => b.weight - a.weight).slice(0, TOP_N);
  const commentCount = social?.comments?.length ?? 0;

  const handleLike = (event) => {
    event.stopPropagation();
    const next = togglePortfolioLike(portfolio.id);
    setLiked(next.liked);
    setLikes(next.likes);
  };

  const handleCopy = (event) => {
    event.stopPropagation();
    if (!canCopy) return;
    const next = togglePortfolioCopy(portfolio.id);
    setCopied(next.copied);
    setCopies(next.copies);
    if (next.copied) {
      copyPortfolioForUser(CURRENT_USER.id, portfolio, {
        sourceUserId: sourceOwnerId,
        sourceUserName: sourceOwnerName,
      });
      onPortfolioCopied?.();
    }
  };

  const handleShare = async (event) => {
    event.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?portfolio=${portfolio.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: portfolio.name,
          text: portfolio.objective || 'Portfolio on PocketEdge',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      const next = incrementPortfolioShare(portfolio.id);
      setShares(next.shares);
    } catch {
      /* user cancelled share sheet */
    }
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
            {portfolio.objective ? (
              <p className="mt-1 text-sm text-pe-text-secondary">{portfolio.objective}</p>
            ) : null}
          </div>
          <p className={`shrink-0 text-lg font-bold ${pnlClass(returnPct)}`}>
            {formatPct(returnPct)}
          </p>
        </div>
      </button>

      {topHoldings.length > 0 ? (
        <button
          type="button"
          onClick={() => onOpen?.(portfolio.id)}
          className="mt-4 block w-full text-left"
        >
          <div className="rounded-[12px] border border-pe-border bg-pe-surface px-3.5 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-pe-text-muted">
              Top {TOP_N} holdings & allocations
            </p>
            <div className="mt-3 space-y-2">
              {topHoldings.map((row) => (
                <div key={row.ticker} className="flex items-center justify-between gap-3">
                  <p className="truncate text-[14px] font-semibold text-pe-text">{row.label}</p>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-pe-text-secondary">
                    {row.weight.toFixed(1)}%
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

        <button
          type="button"
          onClick={handleDiscuss}
          className="inline-flex items-center gap-1.5 text-sm transition hover:text-pe-text"
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>

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
    </article>
  );
}
