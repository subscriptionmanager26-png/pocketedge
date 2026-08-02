/** Hook posts shown to logged-out users — blurred teasers, not real data. */
export const GUEST_FEED_HOOK_POSTS = [
  {
    id: 'guest-hook-1',
    authorId: 'guest_hook_author_1',
    authorName: 'Aarav Mehta',
    authorHandle: 'aaravbuilds',
    authorAvatar: 'A',
    body: 'Here are my top 5 picks for next quarter — and the exact thesis behind each one. Thread 🧵',
    createdAt: new Date().toISOString(),
    likes: 128,
    commentCount: 24,
    comments: [],
    liked: false,
  },
  {
    id: 'guest-hook-2',
    authorId: 'guest_hook_author_2',
    authorName: 'Priya Shah',
    authorHandle: 'priyaonmarkets',
    authorAvatar: 'P',
    body: 'How to identify 10 multibaggers before the crowd: the 4 filters I run every month on my watchlist.',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    likes: 96,
    commentCount: 18,
    comments: [],
    liked: false,
  },
];
