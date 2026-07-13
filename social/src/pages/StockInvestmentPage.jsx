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
  STOCK_INVESTMENT_TABS,
  TRACK_STOCK_LOCK,
  TRACK_STOCK_NEWS_LOCK,
} from '../components/InvestmentSections';
import { getStock, getStockHolders, getStockNews } from '../data/stockData';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNews, fetchCorporateActions, isStockNewsConfigured } from '../lib/stockNewsApi';
import CorporateActionsList from '../components/CorporateActionsList';
import { AUTHOR_POSITIONS, getPerson } from '../data/mockData';
import { hasStockAccess } from '../lib/assetAccess';
import { getStockDiscussions } from '../lib/assetDiscussions';
import { getStockAssetType } from '../lib/assetTypes';
import {
  addReviewComment,
  getReviewsForStock,
  getUserReviewForStock,
  hasCommunityReviewsAccess,
  hydrateCommunityAccess,
  loadReviewsForStock,
  subscribeReviews,
} from '../lib/reviewStore';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { subscribeWatchlists } from '../lib/watchlistStore';
import {
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
    if (seedStock) {
      return marketStockToDetail({
        symbol: ticker,
        name: seedStock.name,
        price: seedStock.price,
        changePct: seedStock.changePct,
      });
    }
    // Paint immediately from URL while market metadata resolves.
    return marketStockToDetail({
      symbol: ticker,
      name: formatTicker(ticker),
      price: null,
      changePct: null,
    });
  }, [marketStock, seedStock, ticker]);
  const displayStock = stock;
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);
  const [accessTick, setAccessTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);
  useEffect(() => subscribeWatchlists(() => setAccessTick((n) => n + 1)), []);

  useEffect(() => {
    hydrateCommunityAccess();
    loadReviewsForStock(ticker, { isEtf }).catch(() => {});
  }, [ticker, isEtf]);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    resolveMarketStock(ticker)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved?.assetType === 'etf') setIsEtf(true);
        else setIsEtf(false);
        setMarketStock(resolved ? marketStockToDetail(resolved) : null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const me = getAppCurrentUserId();
  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = useMemo(() => hasStockAccess(ticker), [ticker, accessTick]);
  const reviews = useMemo(() => getReviewsForStock(ticker), [ticker, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== me),
    [reviews, me]
  );
  const userReview = useMemo(
    () => getUserReviewForStock(ticker, { isEtf }),
    [ticker, isEtf, reviewTick]
  );
  const discussions = useMemo(() => getStockDiscussions(ticker), [ticker]);
  const holders = getStockHolders(ticker);
  const [news, setNews] = useState(() => (isDevMockMode() ? getStockNews(ticker) : []));
  const [newsLoading, setNewsLoading] = useState(false);
  const [corporateActions, setCorporateActions] = useState([]);
  const [corpActionsLoading, setCorpActionsLoading] = useState(false);

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

  useEffect(() => {
    if (!isStockNewsConfigured() || isEtf) {
      setCorporateActions([]);
      return undefined;
    }

    let cancelled = false;
    setCorpActionsLoading(true);
    fetchCorporateActions(ticker)
      .then((items) => {
        if (!cancelled) setCorporateActions(items);
      })
      .finally(() => {
        if (!cancelled) setCorpActionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, isEtf]);

  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;

  if (!marketLoading && !marketStock && !seedStock) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Stock not found.</div>
    );
  }

  const handleAddComment = async (reviewId, body) => {
    await addReviewComment(reviewId, body);
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
        priceLabel={isEtf ? 'ETF Price' : 'Stock Price'}
        price={
          marketLoading && displayStock.price == null
            ? '…'
            : formatPrice(displayStock.price)
        }
        changeLabel="Today's Change"
        changePct={displayStock.changePct}
      />

      <UnderlineTabs
        tabs={isEtf ? INVESTMENT_TABS : STOCK_INVESTMENT_TABS}
        active={tab}
        onChange={setTab}
      />

      {tab === 'reviews' && (
        <>
          {unlocked && userReview && (
            <AssetReviewComposer
              assetType={isEtf ? 'etf' : 'stock'}
              ticker={ticker}
              assetLabel={formatTicker(ticker)}
              isEtf={isEtf}
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
                  ? 'No other community signals yet.'
                  : `No community signals yet — be the first to share your take on ${formatTicker(ticker)}.`}
              </p>
            ) : (
              communityReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  locked={reviewsLocked && review.authorId !== me}
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

      {tab === 'corporate_actions' && (
        corpActionsLoading ? (
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            Loading corporate actions…
          </p>
        ) : (
          <CorporateActionsList items={corporateActions} />
        )
      )}

    </div>
  );
}
