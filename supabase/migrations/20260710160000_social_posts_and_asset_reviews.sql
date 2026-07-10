-- Social posts (feed) and asset reviews (MF / stocks / ETFs / indices / commodities).

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  post_type text not null default 'text'
    check (post_type in ('text', 'trade', 'portfolio', 'image')),
  body text not null default '',
  image_url text,
  trade jsonb,
  portfolio_share jsonb,
  via jsonb,
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) <= 20000)
);

create index if not exists social_posts_created_idx
  on public.social_posts (created_at desc);

create index if not exists social_posts_author_idx
  on public.social_posts (author_id, created_at desc);

create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.social_post_comments (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists social_post_comments_post_idx
  on public.social_post_comments (post_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Asset reviews
-- ---------------------------------------------------------------------------

create table if not exists public.social_asset_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  asset_type text not null
    check (asset_type in ('fund', 'stock', 'etf', 'index', 'commodity')),
  asset_id text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 160),
  share_count integer not null default 0 check (share_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, asset_type, asset_id)
);

create index if not exists social_asset_reviews_asset_idx
  on public.social_asset_reviews (asset_type, asset_id, created_at desc);

create index if not exists social_asset_reviews_author_idx
  on public.social_asset_reviews (author_id, created_at desc);

create table if not exists public.social_asset_review_votes (
  review_id uuid not null references public.social_asset_reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('agree', 'disagree')),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table if not exists public.social_asset_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.social_asset_reviews (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.social_asset_review_comments (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists social_asset_review_comments_review_idx
  on public.social_asset_review_comments (review_id, created_at asc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;
alter table public.social_asset_reviews enable row level security;
alter table public.social_asset_review_votes enable row level security;
alter table public.social_asset_review_comments enable row level security;

create policy "social_posts_select_auth"
  on public.social_posts for select to authenticated using (true);
create policy "social_posts_insert_own"
  on public.social_posts for insert to authenticated with check (auth.uid() = author_id);
create policy "social_posts_update_own"
  on public.social_posts for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "social_posts_delete_own"
  on public.social_posts for delete to authenticated using (auth.uid() = author_id);

create policy "social_post_likes_select_auth"
  on public.social_post_likes for select to authenticated using (true);
create policy "social_post_likes_insert_own"
  on public.social_post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "social_post_likes_delete_own"
  on public.social_post_likes for delete to authenticated using (auth.uid() = user_id);

create policy "social_post_comments_select_auth"
  on public.social_post_comments for select to authenticated using (true);
create policy "social_post_comments_insert_own"
  on public.social_post_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "social_post_comments_delete_own"
  on public.social_post_comments for delete to authenticated using (auth.uid() = author_id);

create policy "social_asset_reviews_select_auth"
  on public.social_asset_reviews for select to authenticated using (true);
create policy "social_asset_reviews_insert_own"
  on public.social_asset_reviews for insert to authenticated with check (auth.uid() = author_id);
create policy "social_asset_reviews_update_own"
  on public.social_asset_reviews for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "social_asset_review_votes_select_auth"
  on public.social_asset_review_votes for select to authenticated using (true);
create policy "social_asset_review_votes_insert_own"
  on public.social_asset_review_votes for insert to authenticated with check (auth.uid() = user_id);
create policy "social_asset_review_votes_update_own"
  on public.social_asset_review_votes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "social_asset_review_votes_delete_own"
  on public.social_asset_review_votes for delete to authenticated using (auth.uid() = user_id);

create policy "social_asset_review_comments_select_auth"
  on public.social_asset_review_comments for select to authenticated using (true);
create policy "social_asset_review_comments_insert_own"
  on public.social_asset_review_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "social_asset_review_comments_delete_own"
  on public.social_asset_review_comments for delete to authenticated using (auth.uid() = author_id);
