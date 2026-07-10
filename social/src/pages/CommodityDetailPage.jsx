import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
import ReviewCard from '../components/ReviewCard';
import { CURRENT_USER } from '../data/mockData';
import AssetProductHeader from '../components/AssetProductHeader';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import {
  BlurredSection,
  DiscussionsBlurPreview,
  DiscussionsList,
  HoldersBlurPreview,
  INVESTMENT_TABS,
  NewsBlurPreview,
  REVIEW_LOCK,
  ReviewsBlurPreview,
  TRACK_MARKET_LOCK,
  TRACK_MARKET_NEWS_LOCK,
} from '../components/InvestmentSections';
import { hasMarketAssetAccess } from '../lib/assetAccess';
import { getCommodityDiscussions } from '../lib/assetDiscussions';
import { formatPrice } from '../lib/format';
import {
  addReviewComment,
  getReviewsForCommodity,
  getUserReviewForCommodity,
  hasCommunityReviewsAccess,
  hydrateCommunityAccess,
  loadReviewsForCommodity,
  subscribeReviews,
} from '../lib/reviewStore';
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

  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = hasMarketAssetAccess();
  const discussions = useMemo(
    () => getCommodityDiscussions(commodityId, commodity?.name),
    [commodityId, commodity?.name]
  );

  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;
  const reviews = useMemo(() => getReviewsForCommodity(commodityId), [commodityId, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== CURRENT_USER.id),
    [reviews]
  );
  const userReview = useMemo(
    () => getUserReviewForCommodity(commodityId),
    [commodityId, reviewTick]
  );

  const handleAddComment = async (reviewId, body) => {
    await addReviewComment(reviewId, body);
    setReviewTick((n) => n + 1);
  };

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Loading commodity…
      </div>
    );
  }

  if (!commodity) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">
        Commodity not found.
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
        price={commodity.spotPrice != null ? formatPrice(commodity.spotPrice) : '—'}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <>
          {unlocked && userReview && (
            <AssetReviewComposer
              assetType="commodity"
              commodityId={commodityId}
              assetLabel={commodity.name}
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
                assetType="commodity"
                commodityId={commodityId}
                assetLabel={commodity.name}
                onSubmitted={() => setReviewTick((n) => n + 1)}
              />
            ) : communityReviews.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
                {userReview
                  ? 'No other community reviews yet.'
                  : `No community reviews yet — be the first to share your view on ${commodity.name}.`}
              </p>
            ) : (
              communityReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  locked={reviewsLocked && review.authorId !== CURRENT_USER.id}
                  onAddComment={handleAddComment}
                  onOpenProfile={onOpenProfile}
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
          lock={!unlocked ? REVIEW_LOCK : TRACK_MARKET_LOCK}
          onCta={!unlocked ? onPromptReview : undefined}
          preview={<DiscussionsBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <DiscussionsList
            posts={discussions}
            onOpenProfile={onOpenProfile}
            emptyMessage={`No posts yet — posts mentioning ${commodity.name} will show up here.`}
          />
        </BlurredSection>
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
