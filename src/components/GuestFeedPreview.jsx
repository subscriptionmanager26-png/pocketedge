import { GUEST_FEED_HOOK_POSTS } from '../data/guestFeedHooks';
import GuestSignInCta from './GuestSignInCta';
import { rememberPerson } from '../lib/socialIdentity';
import { timeAgo } from '../lib/format';

// Seed guest authors so Avatar / name resolve without a network round-trip.
for (const post of GUEST_FEED_HOOK_POSTS) {
  rememberPerson({
    id: post.authorId,
    name: post.authorName,
    handle: post.authorHandle,
    avatar: post.authorAvatar,
  });
}

/**
 * Two blurred hook posts + a compelling sign-in card for logged-out feed.
 */
export default function GuestFeedPreview({ onSignInHint }) {
  void onSignInHint;

  return (
    <div>
      {GUEST_FEED_HOOK_POSTS.map((post) => (
        <article
          key={post.id}
          className="border-b border-pe-border px-4 py-5 md:py-6"
        >
          <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pe-accent-wash text-[15px] font-bold text-pe-accent">
                {post.authorAvatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[15px] font-semibold text-pe-text">{post.authorName}</span>
                  <span className="text-[13px] text-pe-text-muted">@{post.authorHandle}</span>
                  <span className="text-[13px] text-pe-text-muted">· {timeAgo(post.createdAt)}</span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-pe-text">{post.body}</p>
                <div className="mt-3 flex gap-5 text-[13px] font-semibold text-pe-text-muted">
                  <span>{post.likes} likes</span>
                  <span>{post.commentCount} replies</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      ))}

      <GuestSignInCta
        variant="hero"
        title="Investing ideas, unlocked"
        description="See full theses, follow top investors, and build your edge — free on PocketEdge."
        action="read full posts and follow investors"
        showExploreHint
        benefits={[
          'Real theses from active investors',
          'Follow people, not just tickers',
          'Daily AI insights on your watchlist',
        ]}
      />
    </div>
  );
}
