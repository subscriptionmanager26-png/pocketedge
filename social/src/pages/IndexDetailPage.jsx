import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { hasCommunityReviewsAccess } from '../lib/reviewStore';
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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

  const liveIndex = useNseIndexLiveQuote(index, Boolean(index));
  const displayIndex = liveIndex ?? index;

  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = hasMarketAssetAccess();
  const discussions = useMemo(
    () => getIndexDiscussions(indexId, displayIndex?.name),
    [indexId, displayIndex?.name]
  );

  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Loading index…</div>
    );
  }

  if (!index) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Index not found.</div>
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
        price={formatIndexValue(displayIndex.value)}
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <BlurredSection
          locked={reviewsLocked}
          lock={REVIEW_LOCK}
          onCta={onPromptReview}
          preview={<ReviewsBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
            No community reviews yet — be the first to share your view on {displayIndex.name}.
          </p>
        </BlurredSection>
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
