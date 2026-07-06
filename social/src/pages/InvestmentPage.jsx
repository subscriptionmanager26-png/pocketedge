import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import UnderlineTabs from '../components/UnderlineTabs';
import ReviewCard from '../components/ReviewCard';
import Avatar from '../components/Avatar';
import { StarDisplay } from '../components/StarRating';
import {
  averageRating,
  getFund,
  getFundHolders,
  getFundNews,
} from '../data/fundData';
import { getPerson } from '../data/mockData';
import {
  addReviewComment,
  getDiscussionsForFund,
  getReviewsForFund,
  hasCommunityReviewsAccess,
  subscribeReviews,
} from '../lib/reviewStore';
import { formatPct } from '../lib/format';

const INVESTMENT_TABS = [
  { id: 'reviews', label: '⭐ Reviews' },
  { id: 'discussions', label: '💬 Discussions' },
  { id: 'holders', label: '👥 Holders' },
  { id: 'news', label: '📰 News' },
];

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
  const reviews = useMemo(() => getReviewsForFund(fundId), [fundId, reviewTick]);
  const discussions = useMemo(() => getDiscussionsForFund(fundId), [fundId, reviewTick]);
  const holders = getFundHolders(fundId);
  const news = getFundNews(fundId);
  const avg = averageRating(fundId, reviews);

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
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-pe-text-secondary">
          <span>1Y {formatPct(fund.return1Y, { signed: false })}</span>
          <span>3Y {formatPct(fund.return3Y, { signed: false })}</span>
          <span>{fund.aum} AUM</span>
        </div>
        {avg && (
          <div className="mt-3 flex items-center gap-2">
            <StarDisplay rating={Math.round(Number(avg))} />
            <span className="text-sm font-semibold text-pe-text">{avg} · {reviews.length} reviews</span>
          </div>
        )}
      </section>

      <UnderlineTabs tabs={INVESTMENT_TABS} active={tab} onChange={setTab} />

      {tab === 'reviews' && (
        <div>
          {!unlocked && (
            <div className="border-b border-pe-accent-border bg-pe-accent-wash px-4 py-4">
              <div className="flex gap-3">
                <Lock className="h-5 w-5 shrink-0 text-pe-accent" />
                <div>
                  <p className="text-[15px] font-semibold text-pe-text">Unlock community reviews</p>
                  <p className="mt-1 text-sm text-pe-text-secondary">
                    Recommend one fund with a star rating to read what other investors think.
                  </p>
                  <button
                    type="button"
                    onClick={onPromptReview}
                    className="mt-3 rounded-md bg-pe-accent px-4 py-2 text-sm font-bold text-white hover:bg-pe-accent-pressed"
                  >
                    Write a review
                  </button>
                </div>
              </div>
            </div>
          )}
          {reviews.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                locked={!unlocked && review.authorId !== 'u_me'}
                onAddComment={handleAddComment}
                onOpenProfile={onOpenProfile}
                onGraphChange={onGraphChange}
                onReviewChange={() => setReviewTick((n) => n + 1)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'discussions' && (
        <div className="px-4 py-2">
          {!unlocked ? (
            <p className="py-12 text-center text-sm text-pe-text-secondary">
              Contribute a fund review to join discussions.
            </p>
          ) : discussions.length === 0 ? (
            <p className="py-12 text-center text-sm text-pe-text-secondary">
              Discussions grow from reviews — agree, disagree, or reply to get started.
            </p>
          ) : (
            discussions.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setTab('reviews')}
                className="block w-full border-b border-pe-border py-4 text-left hover:bg-pe-surface/50"
              >
                <p className="text-[15px] font-semibold text-pe-text">{d.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-pe-text-secondary">{d.preview}</p>
                <p className="mt-2 text-xs font-semibold text-pe-accent">
                  {d.commentCount} {d.commentCount === 1 ? 'reply' : 'replies'}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'holders' && (
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
      )}

      {tab === 'news' && (
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
      )}
    </div>
  );
}
