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
  DiscussionsList,
  HoldersBlurPreview,
  INVESTMENT_TABS,
  NewsBlurPreview,
  STOCK_INVESTMENT_TABS,
  TRACK_STOCK_LOCK,
  TRACK_STOCK_NEWS_LOCK,
} from '../components/InvestmentSections';
import { getStock, getStockHolders, getStockNews } from '../data/stockData';
import { isDevMockMode } from '../lib/appMode';
import { fetchStockNews, fetchCorporateActions, isStockNewsConfigured } from '../lib/stockNewsApi';
import CorporateActionsList from '../components/CorporateActionsList';
import { hasStockAccess } from '../lib/assetAccess';
import { getStockDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import { getStockAssetType } from '../lib/assetTypes';
import {
  addReviewComment,
  getReviewsForStock,
  getUserReviewForStock,
  hydrateCommunityAccess,
  loadReviewsForStock,
  subscribeReviews,
} from '../lib/reviewStore';
import { getAppCurrentUserId, getPersonSync } from '../lib/socialIdentity';
import { subscribeWatchlists } from '../lib/watchlistStore';
import {
  marketStockToDetail,
  resolveMarketStock,
} from '../lib/marketDataApi';
import { formatPct } from '../lib/format';
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
  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getStockDiscussions(ticker) : []
  );
  const holders = getStockHolders(ticker);
  const [news, setNews] = useState(() => (isDevMockMode() ? getStockNews(ticker) : []));
  const [newsLoading, setNewsLoading] = useState(false);
  const [corporateActions, setCorporateActions] = useState([]);
  const [corpActionsLoading, setCorpActionsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getStockDiscussions(ticker));
      return undefined;
    }
    loadPostsMentioning([ticker])
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

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
        price={
          marketLoading && displayStock.price == null
            ? '…'
            : displayStock.price
        }
        changePct={displayStock.changePct}
        previousClose={displayStock.previousClose}
        change={displayStock.change}
      />

      <UnderlineTabs
        tabs={isEtf ? INVESTMENT_TABS : STOCK_INVESTMENT_TABS}
        active={tab}
        onChange={setTab}
      />

      {tab === 'reviews' && (
        <>
          <AssetReviewComposer
            assetType={isEtf ? 'etf' : 'stock'}
            ticker={ticker}
            assetLabel={formatTicker(ticker)}
            isEtf={isEtf}
            onSubmitted={() => setReviewTick((n) => n + 1)}
          />
          {communityReviews.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
              {userReview
                ? 'No other community signals yet.'
                : `No community signals yet - be the first to share your take on ${formatTicker(ticker)}.`}
            </p>
          ) : (
            communityReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onAddComment={handleAddComment}
                onOpenProfile={onOpenProfile}
                onGraphChange={onGraphChange}
                onReviewChange={() => setReviewTick((n) => n + 1)}
              />
            ))
          )}
        </>
      )}

      {tab === 'discussions' && (
        <DiscussionsList
          posts={discussions}
          onOpenProfile={onOpenProfile}
          emptyMessage="No posts yet - posts mentioning this stock will show up here."
        />
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
                const person = getPersonSync(userId) ?? {
                  id: userId,
                  name: 'Member',
                  handle: 'member',
                  avatar: 'M',
                };
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
                      <p className="text-sm text-pe-text-muted">@{person.handle}</p>
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
