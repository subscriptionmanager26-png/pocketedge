import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import ReviewCard from '../components/ReviewCard';
import Avatar from '../components/Avatar';
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
import {
  fetchMarketTab,
  marketStockToDetail,
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
  const [marketLoading, setMarketLoading] = useState(!seedStock);
  const stock = seedStock ?? marketStock;
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);
  const [accessTick, setAccessTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);
  useEffect(() => subscribeWatchlists(() => setAccessTick((n) => n + 1)), []);

  useEffect(() => {
    if (seedStock) return undefined;
    let cancelled = false;
    setMarketLoading(true);
    Promise.all([fetchMarketTab('stocks'), fetchMarketTab('etf')])
      .then(([stocksPayload, etfPayload]) => {
        if (cancelled) return;
        const found =
          stocksPayload.items.find((item) => item.symbol === ticker) ??
          etfPayload.items.find((item) => item.symbol === ticker);
        setMarketStock(found ? marketStockToDetail(found) : null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, seedStock]);

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
  const news = getStockNews(ticker);

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
        name={stock.name}
        ticker={formatTicker(ticker)}
        type={getStockAssetType(ticker, stock)}
        price={formatPrice(stock.price)}
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
          <div className="divide-y divide-pe-border">
            {news.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
            ) : (
              news.map((item) => (
                <div key={item.id} className="px-4 py-4">
                  <p className="text-[15px] font-semibold leading-snug text-pe-text">{item.title}</p>
                  <p className="mt-1 text-sm text-pe-text-muted">
                    {item.source} · {item.time}
                  </p>
                </div>
              ))
            )}
          </div>
        </BlurredSection>
      )}

    </div>
  );
}
