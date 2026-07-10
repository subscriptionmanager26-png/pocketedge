import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import ReviewCard from '../components/ReviewCard';
import Avatar from '../components/Avatar';
import NewsList from '../components/NewsList';
import {
  BlurredSection,
  DiscussionsBlurPreview,
  DiscussionsList,
  HoldersBlurPreview,
  INVESTMENT_TABS,
  NewsBlurPreview,
  REVIEW_LOCK,
  ReviewsBlurPreview,
  TRACK_STOCK_LOCK,
  TRACK_STOCK_NEWS_LOCK,
} from '../components/InvestmentSections';
import { getStock, getStockHolders, getStockNews } from '../data/stockData';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNews, isStockNewsConfigured } from '../lib/stockNewsApi';
import { AUTHOR_POSITIONS, CURRENT_USER, getPerson } from '../data/mockData';
import { hasStockAccess } from '../lib/assetAccess';
import { getStockDiscussions } from '../lib/assetDiscussions';
import { getStockAssetType } from '../lib/assetTypes';
import {
  addReviewComment,
  getReviewsForStock,
  getUserReviewForStock,
  hasCommunityReviewsAccess,
  subscribeReviews,
} from '../lib/reviewStore';
import { subscribeWatchlists } from '../lib/watchlistStore';
import { useNseEquityLiveQuote } from '../hooks/useNseEquityStream';
import {
  fetchMarketPreview,
  marketStockToDetail,
  resolveMarketStock,
} from '../lib/marketDataApi';
import { formatPct, formatPrice } from '../lib/format';
import { formatTicker } from '../lib/tickers';

export default function StockInvestmentPage({
  ticker,
  onBack,
  onOpenProfile,
  onGraphChange,
  onPromptReview,
}) {
  const seedStock = getStock(ticker);
  const [marketStock, setMarketStock] = useState(null);
  const [isEtf, setIsEtf] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const stock = useMemo(() => {
    if (marketStock) return marketStock;
    if (!seedStock) return null;
    return marketStockToDetail({
      symbol: ticker,
      name: seedStock.name,
      price: seedStock.price,
      changePct: seedStock.changePct,
    });
  }, [marketStock, seedStock, ticker]);
  const liveStock = useNseEquityLiveQuote(stock, Boolean(stock && !marketLoading), { isEtf });
  const displayStock = liveStock ?? stock;
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);
  const [accessTick, setAccessTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);
  useEffect(() => subscribeWatchlists(() => setAccessTick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    Promise.all([fetchMarketPreview('etf'), resolveMarketStock(ticker)])
      .then(([etfPayload, resolved]) => {
        if (cancelled) return null;
        const etfMatch = etfPayload.items.find((item) => item.symbol === ticker);
        if (etfMatch) {
          setIsEtf(true);
          return etfMatch;
        }
        setIsEtf(false);
        return resolved;
      })
      .then((found) => {
        if (cancelled) return;
        setMarketStock(found ? marketStockToDetail(found) : null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = useMemo(() => hasStockAccess(ticker), [ticker, accessTick]);
  const reviews = useMemo(() => getReviewsForStock(ticker), [ticker, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== CURRENT_USER.id),
    [reviews]
  );
  const userReview = useMemo(
    () => getUserReviewForStock(ticker),
    [ticker, reviewTick]
  );
  const discussions = useMemo(() => getStockDiscussions(ticker), [ticker]);
  const holders = getStockHolders(ticker);
  const [news, setNews] = useState(() => (isDevMockMode() ? getStockNews(ticker) : []));
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (isStockNewsConfigured()) {
      let cancelled = false;
      setNewsLoading(true);
      fetchStockNews(ticker)
        .then((items) => {
          if (!cancelled) setNews(items);
        })
        .finally(() => {
          if (!cancelled) setNewsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    if (isDevMockMode()) {
      setNews(getStockNews(ticker));
      return undefined;
    }

    setNews([]);
    return undefined;
  }, [ticker]);

  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;

  if (marketLoading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Loading stock…</div>
    );
  }

  if (!stock) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Stock not found.</div>
    );
  }

  const handleAddComment = (reviewId, body) => {
    addReviewComment(reviewId, body);
    setReviewTick((n) => n + 1);
  };

  return (
    <div>
      <PageHeader desktopOnly>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-pe-text-secondary hover:text-pe-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </PageHeader>

      <AssetProductHeader
        name={displayStock.name}
        ticker={formatTicker(ticker)}
        type={getStockAssetType(ticker, displayStock)}
        price={formatPrice(displayStock.price)}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <>
          {unlocked && userReview && (
            <AssetReviewComposer
              assetType="stock"
              ticker={ticker}
              assetLabel={formatTicker(ticker)}
              onSubmitted={() => setReviewTick((n) => n + 1)}
            />
          )}
          <BlurredSection
            locked={reviewsLocked}
            lock={REVIEW_LOCK}
            onCta={onPromptReview}
            preview={<ReviewsBlurPreview onOpenProfile={onOpenProfile} />}
          >
            {unlocked && !userReview ? (
              <AssetReviewComposer
                assetType="stock"
                ticker={ticker}
                assetLabel={formatTicker(ticker)}
                onSubmitted={() => setReviewTick((n) => n + 1)}
              />
            ) : communityReviews.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
                {userReview
                  ? 'No other community reviews yet.'
                  : `No community reviews yet — be the first to share your thesis on ${formatTicker(ticker)}.`}
              </p>
            ) : (
              communityReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  locked={reviewsLocked && review.authorId !== 'u_me'}
                  onAddComment={handleAddComment}
                  onOpenProfile={onOpenProfile}
                  onGraphChange={onGraphChange}
                  onReviewChange={() => setReviewTick((n) => n + 1)}
                />
              ))
            )}
          </BlurredSection>
        </>
      )}

      {tab === 'discussions' && (
        <BlurredSection
          locked={discussionsLocked}
          lock={!unlocked ? REVIEW_LOCK : TRACK_STOCK_LOCK}
          onCta={!unlocked ? onPromptReview : undefined}
          preview={<DiscussionsBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <DiscussionsList
            posts={discussions}
            onOpenProfile={onOpenProfile}
            emptyMessage="No posts yet — posts mentioning this stock will show up here."
          />
        </BlurredSection>
      )}

      {tab === 'holders' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_STOCK_LOCK}
          preview={<HoldersBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <div className="divide-y divide-pe-border">
            {holders.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
                No disclosed holders yet.
              </p>
            ) : (
              holders.map((userId) => {
                const person = getPerson(userId);
                const position = AUTHOR_POSITIONS[userId]?.[ticker];
                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => onOpenProfile?.(userId)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-pe-surface/50"
                  >
                    <Avatar person={person} />
                    <div>
                      <p className="text-[15px] font-semibold text-pe-text">{person.name}</p>
                      <p className="text-sm text-pe-text-muted">
                        @{person.handle}
                        {position?.qty ? ` · ${position.qty} shares` : ''}
                        {position?.pnlPct != null ? ` · ${formatPct(position.pnlPct)} P&L` : ''}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </BlurredSection>
      )}

      {tab === 'news' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_STOCK_NEWS_LOCK}
          preview={<NewsBlurPreview />}
        >
          <div>
            {newsLoading ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading news…</p>
            ) : news.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
            ) : (
              <NewsList items={news} />
            )}
          </div>
        </BlurredSection>
      )}

    </div>
  );
}
