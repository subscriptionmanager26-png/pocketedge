import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
import ReviewCard from '../components/ReviewCard';
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
import { formatIndexGroup } from '../components/MarketDetailLayout';
import { hasMarketAssetAccess } from '../lib/assetAccess';
import { getIndexDiscussions } from '../lib/assetDiscussions';
import {
  addReviewComment,
  getReviewsForIndex,
  getUserReviewForIndex,
  hasCommunityReviewsAccess,
  hydrateCommunityAccess,
  loadReviewsForIndex,
  subscribeReviews,
} from '../lib/reviewStore';
import { getAppCurrentUserId } from '../lib/socialIdentity';
import { useNseIndexLiveQuote } from '../hooks/useNseIndexStream';
import { fetchMarketPreview, resolveMarketIndex } from '../lib/marketDataApi';

function formatIndexValue(value) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function IndexDetailPage({
  indexId,
  onBack,
  onOpenProfile,
  onPromptReview,
}) {
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

  useEffect(() => {
    hydrateCommunityAccess();
    loadReviewsForIndex(indexId).catch(() => {});
  }, [indexId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIndex({
      id: indexId,
      name: indexId,
      symbol: indexId,
      value: null,
      group: null,
    });

    (async () => {
      const preview = await fetchMarketPreview('indices');
      let found = preview.items.find((item) => item.id === indexId);
      if (!found) found = await resolveMarketIndex(indexId);
      if (!cancelled) {
        setIndex(found ?? null);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setIndex(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [indexId]);

  const liveIndex = useNseIndexLiveQuote(index, Boolean(index && !loading));
  const displayIndex = liveIndex ?? index;

  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = hasMarketAssetAccess();
  const discussions = useMemo(
    () => getIndexDiscussions(indexId, displayIndex?.name),
    [indexId, displayIndex?.name]
  );

  const me = getAppCurrentUserId();
  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;
  const reviews = useMemo(() => getReviewsForIndex(indexId), [indexId, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== me),
    [reviews, me]
  );
  const userReview = useMemo(
    () => getUserReviewForIndex(indexId),
    [indexId, reviewTick]
  );

  const handleAddComment = async (reviewId, body) => {
    await addReviewComment(reviewId, body);
    setReviewTick((n) => n + 1);
  };

  if (!loading && !index) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Index not found.</div>
    );
  }

  if (!displayIndex) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Loading index…</div>
    );
  }

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
        name={displayIndex.name}
        ticker={displayIndex.symbol !== displayIndex.name ? displayIndex.symbol : null}
        subtitle={formatIndexGroup(displayIndex.group)}
        type="Index"
        priceLabel="Index Value"
        price={
          loading && displayIndex.value == null
            ? '…'
            : formatIndexValue(displayIndex.value)
        }
        changeLabel="Today's Change"
        changePct={displayIndex.changePct}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <>
          {unlocked && userReview && (
            <AssetReviewComposer
              assetType="index"
              indexId={indexId}
              assetLabel={displayIndex.name}
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
                assetType="index"
                indexId={indexId}
                assetLabel={displayIndex.name}
                onSubmitted={() => setReviewTick((n) => n + 1)}
              />
            ) : communityReviews.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
                {userReview
                  ? 'No other community signals yet.'
                  : `No community signals yet — be the first to share your view on ${displayIndex.name}.`}
              </p>
            ) : (
              communityReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  locked={reviewsLocked && review.authorId !== me}
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
            emptyMessage={`No posts yet — posts mentioning ${displayIndex.name} will show up here.`}
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
