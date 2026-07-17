import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
import ReviewCard from '../components/ReviewCard';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  BlurredSection,
  DiscussionsList,
  HoldersBlurPreview,
  INVESTMENT_TABS,
  NewsBlurPreview,
  TRACK_MARKET_LOCK,
  TRACK_MARKET_NEWS_LOCK,
} from '../components/InvestmentSections';
import { hasMarketAssetAccess } from '../lib/assetAccess';
import { getCommodityDiscussions, loadPostsMentioning } from '../lib/assetDiscussions';
import {
  addReviewComment,
  getReviewsForCommodity,
  getUserReviewForCommodity,
  hydrateCommunityAccess,
  loadReviewsForCommodity,
  subscribeReviews,
} from '../lib/reviewStore';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { isDevMockMode } from '../lib/appMode';
import { fetchMarketPreview, resolveMarketCommodity } from '../lib/marketDataApi';

export default function CommodityDetailPage({
  commodityId,
  onBack,
  onOpenProfile,
  onPromptReview,
}) {
  const [commodity, setCommodity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

  useEffect(() => {
    hydrateCommunityAccess();
    loadReviewsForCommodity(commodityId).catch(() => {});
  }, [commodityId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCommodity({
      id: commodityId,
      name: commodityId,
      symbol: commodityId,
      spotPrice: null,
      unit: null,
      location: null,
    });

    (async () => {
      const preview = await fetchMarketPreview('commodity');
      let found = preview.items.find((item) => item.id === commodityId);
      if (!found) found = await resolveMarketCommodity(commodityId);
      if (!cancelled) {
        setCommodity(found ?? null);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setCommodity(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [commodityId]);

  const hasAccess = hasMarketAssetAccess();
  const [discussions, setDiscussions] = useState(() =>
    isDevMockMode() ? getCommodityDiscussions(commodityId, commodity?.name) : []
  );

  useEffect(() => {
    let cancelled = false;
    if (isDevMockMode()) {
      setDiscussions(getCommodityDiscussions(commodityId, commodity?.name));
      return undefined;
    }
    loadPostsMentioning([commodityId, commodity?.name].filter(Boolean))
      .then((posts) => {
        if (!cancelled) setDiscussions(posts);
      })
      .catch(() => {
        if (!cancelled) setDiscussions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [commodityId, commodity?.name]);

  const me = getAppCurrentUserId();
  // Holders & News are open to everyone for now (was: !hasAccess).
  const holdersLocked = false && !hasAccess;
  const reviews = useMemo(() => getReviewsForCommodity(commodityId), [commodityId, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== me),
    [reviews, me]
  );
  const userReview = useMemo(
    () => getUserReviewForCommodity(commodityId),
    [commodityId, reviewTick]
  );

  const handleAddComment = async (reviewId, body) => {
    await addReviewComment(reviewId, body);
    setReviewTick((n) => n + 1);
  };

  if (!loading && !commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Commodity not found.
      </div>
    );
  }

  if (!commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Loading commodity…
      </div>
    );
  }

  const subtitle = [commodity.unit, commodity.location].filter(Boolean).join(' · ') || 'MCX spot';

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
        name={commodity.name}
        ticker={commodity.symbol !== commodity.name ? commodity.symbol : null}
        subtitle={subtitle}
        type="Commodity"
        price={
          loading && commodity.spotPrice == null
            ? '…'
            : commodity.spotPrice != null
              ? commodity.spotPrice
              : '-'
        }
        changePct={commodity.changePct}
        previousClose={commodity.previousClose}
        change={commodity.change}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <>
          <AssetReviewComposer
            assetType="commodity"
            commodityId={commodityId}
            assetLabel={commodity.name}
            onSubmitted={() => setReviewTick((n) => n + 1)}
          />
          {communityReviews.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
              {userReview
                ? 'No other community signals yet.'
                : `No community signals yet - be the first to share your view on ${commodity.name}.`}
            </p>
          ) : (
            communityReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onAddComment={handleAddComment}
                onOpenProfile={onOpenProfile}
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
          emptyMessage={`No posts yet - posts mentioning ${commodity.name} will show up here.`}
        />
      )}

      {tab === 'holders' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_MARKET_LOCK}
          preview={<HoldersBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            No disclosed holders yet.
          </p>
        </BlurredSection>
      )}

      {tab === 'news' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_MARKET_NEWS_LOCK}
          preview={<NewsBlurPreview />}
        >
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No recent news.</p>
        </BlurredSection>
      )}
    </div>
  );
}
