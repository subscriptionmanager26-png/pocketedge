import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import AssetReviewComposer from '../components/AssetReviewComposer';
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
import {
  addReviewComment,
  getReviewsForFund,
  getUserReviewForFund,
  hasCommunityReviewsAccess,
  subscribeReviews,
} from '../lib/reviewStore';

export default function InvestmentPage({
  fundId,
  onBack,
  onOpenProfile,
  onGraphChange,
  onPromptReview,
}) {
  const fund = getFund(fundId);
  const [tab, setTab] = useState('reviews');
  const [reviewTick, setReviewTick] = useState(0);

  useEffect(() => subscribeReviews(() => setReviewTick((n) => n + 1)), []);

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

  if (!fund) {
    return (
      <div className="px-4 py-16 text-center text-sm text-pe-text-secondary">Fund not found.</div>
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

      <section className="border-b border-pe-border px-4 py-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-pe-accent">{fund.category}</p>
        <h1 className="mt-1 font-serif text-2xl font-bold text-pe-text">{fund.name}</h1>
        <p className="mt-0.5 text-sm text-pe-text-muted">{fund.amc}</p>
        <p className="mt-3 text-sm text-pe-text-secondary">{fund.aum} AUM</p>
      </section>

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
                {userReview ? 'No other community reviews yet.' : 'No community reviews yet.'}
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
            emptyMessage="No discussions yet — posts about this fund will show up here."
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
