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
  TRACK_FUND_LOCK,
} from '../components/InvestmentSections';
import {
  getFund,
  getFundHolders,
  getFundNews,
} from '../data/fundData';
import { getPerson, CURRENT_USER } from '../data/mockData';
import { hasFundAccess } from '../lib/assetAccess';
import { getFundDiscussions } from '../lib/assetDiscussions';
import { getFundAssetType } from '../lib/assetTypes';
import {
  marketFundToDetail,
  resolveMarketFund,
} from '../lib/marketDataApi';
import { formatPrice } from '../lib/format';
import {
  addReviewComment,
  getReviewsForFund,
  getUserReviewForFund,
  hasCommunityReviewsAccess,
  hydrateCommunityAccess,
  loadReviewsForFund,
  subscribeReviews,
} from '../lib/reviewStore';

export default function InvestmentPage({
  fundId,
  onBack,
  onOpenProfile,
  onGraphChange,
  onPromptReview,
}) {
  const seedFund = getFund(fundId);
  const [marketFund, setMarketFund] = useState(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const fund =
    seedFund ??
    marketFund ??
    ({
      id: fundId,
      name: fundId,
      category: 'Mutual Fund',
      nav: null,
    });
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

  useEffect(() => {
    hydrateCommunityAccess();
    loadReviewsForFund(fundId).catch(() => {});
  }, [fundId]);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);

    (async () => {
      try {
        if (seedFund) {
          if (!cancelled) setMarketLoading(false);
          return;
        }
        const found = await resolveMarketFund(fundId);
        if (!cancelled) setMarketFund(found ? marketFundToDetail(found) : null);
      } finally {
        if (!cancelled) setMarketLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fundId, seedFund]);

  const unlocked = hasCommunityReviewsAccess();
  const hasAccess = hasFundAccess(fundId);
  const reviews = useMemo(() => getReviewsForFund(fundId), [fundId, reviewTick]);
  const communityReviews = useMemo(
    () => reviews.filter((r) => r.authorId !== CURRENT_USER.id),
    [reviews]
  );
  const userReview = useMemo(
    () => getUserReviewForFund(fundId),
    [fundId, reviewTick]
  );
  const discussions = useMemo(() => getFundDiscussions(fundId), [fundId]);
  const holders = getFundHolders(fundId);
  const news = getFundNews(fundId);

  const reviewsLocked = !unlocked;
  const discussionsLocked = !unlocked || !hasAccess;
  const holdersLocked = !hasAccess;
  const hasResolvedFund = Boolean(seedFund || marketFund);

  if (!marketLoading && !hasResolvedFund) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Fund not found.</div>
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
        name={fund.name}
        type={getFundAssetType()}
        priceLabel="NAV"
        price={
          marketLoading && fund.nav == null
            ? '…'
            : fund.nav != null
              ? formatPrice(fund.nav)
              : null
        }
        metaLabel="NAV"
        metaValue={
          fund.navDate
            ? new Date(fund.navDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : null
        }
      />

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <>
          {unlocked && userReview && (
            <AssetReviewComposer
              assetType="fund"
              fundId={fundId}
              assetLabel={fund.name}
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
                assetType="fund"
                fundId={fundId}
                assetLabel={fund.name}
                onSubmitted={() => setReviewTick((n) => n + 1)}
              />
            ) : communityReviews.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">
                {userReview ? 'No other community signals yet.' : 'No community signals yet.'}
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
          lock={!unlocked ? REVIEW_LOCK : TRACK_FUND_LOCK}
          onCta={!unlocked ? onPromptReview : undefined}
          preview={<DiscussionsBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <DiscussionsList
            posts={discussions}
            onOpenProfile={onOpenProfile}
            emptyMessage="No posts yet — posts about this fund will show up here."
          />
        </BlurredSection>
      )}

      {tab === 'holders' && (
        <BlurredSection
          locked={holdersLocked}
          lock={TRACK_FUND_LOCK}
          preview={<HoldersBlurPreview onOpenProfile={onOpenProfile} />}
        >
          <div className="divide-y divide-pe-border">
            {holders.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No disclosed holders yet.</p>
            ) : (
              holders.map((userId) => {
                const person = getPerson(userId);
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
                      <p className="text-sm text-pe-text-muted">@{person.handle} · holds in portfolio</p>
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
          lock={TRACK_FUND_LOCK}
          preview={<NewsBlurPreview />}
        >
          <div>
            {news.length === 0 ? (
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
