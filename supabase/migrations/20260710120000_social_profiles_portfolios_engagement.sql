-- Social app: profiles (username URLs), portfolios (separate from baskets), engagement.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  bio text,
  avatar_url text,
  location text,
  focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create unique index if not exists social_profiles_username_lower_idx
  on public.social_profiles (lower(username));

create index if not exists social_profiles_updated_idx
  on public.social_profiles (updated_at desc);

alter table public.social_profiles enable row level security;

-- Anyone (including anon) can read basic public profile fields via view policy on select.
-- Full row readable by any authenticated user (everything is public once signed in).
create policy "social_profiles_select_authenticated"
  on public.social_profiles for select
  to authenticated
  using (true);

create policy "social_profiles_update_own"
  on public.social_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "social_profiles_insert_own"
  on public.social_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Portfolios (social domain only — not baskets)
-- ---------------------------------------------------------------------------

create table if not exists public.social_portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'live' check (kind in ('live', 'watchlist')),
  name text not null default '',
  objective text not null default '',
  thesis text not null default '',
  is_draft boolean not null default false,
  is_archived boolean not null default false,
  source_portfolio_id uuid references public.social_portfolios (id) on delete set null,
  source_user_id uuid references auth.users (id) on delete set null,
  source_portfolio_name text,
  source_user_name text,
  watchlist_base_investment numeric,
  tickers jsonb not null default '[]'::jsonb,
  holdings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_portfolios_owner_idx
  on public.social_portfolios (owner_id, updated_at desc)
  where not is_archived;

create index if not exists social_portfolios_source_idx
  on public.social_portfolios (source_portfolio_id)
  where source_portfolio_id is not null;

alter table public.social_portfolios enable row level security;

create policy "social_portfolios_select_authenticated"
  on public.social_portfolios for select
  to authenticated
  using (not is_archived);

create policy "social_portfolios_insert_own"
  on public.social_portfolios for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "social_portfolios_update_own"
  on public.social_portfolios for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Portfolios cannot be deleted. Drafts are local-only in the app; is_archived is for a future archive feature.

-- ---------------------------------------------------------------------------
-- Engagement: likes, shares, copies
-- ---------------------------------------------------------------------------

create table if not exists public.social_portfolio_likes (
  portfolio_id uuid not null references public.social_portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (portfolio_id, user_id)
);

create table if not exists public.social_portfolio_shares (
  portfolio_id uuid not null references public.social_portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (portfolio_id, user_id)
);

create table if not exists public.social_portfolio_copies (
  portfolio_id uuid not null references public.social_portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  copied_portfolio_id uuid references public.social_portfolios (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (portfolio_id, user_id)
);

create table if not exists public.social_portfolio_comments (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.social_portfolios (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists social_portfolio_comments_portfolio_idx
  on public.social_portfolio_comments (portfolio_id, created_at asc);

create table if not exists public.social_portfolio_comment_reads (
  portfolio_id uuid not null references public.social_portfolios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (portfolio_id, user_id)
);

alter table public.social_portfolio_likes enable row level security;
alter table public.social_portfolio_shares enable row level security;
alter table public.social_portfolio_copies enable row level security;
alter table public.social_portfolio_comments enable row level security;
alter table public.social_portfolio_comment_reads enable row level security;

create policy "portfolio_likes_select_auth"
  on public.social_portfolio_likes for select to authenticated using (true);
create policy "portfolio_likes_insert_own"
  on public.social_portfolio_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "portfolio_likes_delete_own"
  on public.social_portfolio_likes for delete to authenticated using (auth.uid() = user_id);

create policy "portfolio_shares_select_auth"
  on public.social_portfolio_shares for select to authenticated using (true);
create policy "portfolio_shares_insert_own"
  on public.social_portfolio_shares for insert to authenticated with check (auth.uid() = user_id);

create policy "portfolio_copies_select_auth"
  on public.social_portfolio_copies for select to authenticated using (true);
create policy "portfolio_copies_insert_own"
  on public.social_portfolio_copies for insert to authenticated with check (auth.uid() = user_id);
create policy "portfolio_copies_delete_own"
  on public.social_portfolio_copies for delete to authenticated using (auth.uid() = user_id);

create policy "portfolio_comments_select_auth"
  on public.social_portfolio_comments for select to authenticated using (true);
create policy "portfolio_comments_insert_own"
  on public.social_portfolio_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "portfolio_comments_delete_own_or_owner"
  on public.social_portfolio_comments for delete to authenticated using (
    auth.uid() = author_id
    or exists (
      select 1 from public.social_portfolios p
      where p.id = portfolio_id and p.owner_id = auth.uid()
    )
  );

create policy "portfolio_comment_reads_select_own"
  on public.social_portfolio_comment_reads for select to authenticated using (auth.uid() = user_id);
create policy "portfolio_comment_reads_upsert_own"
  on public.social_portfolio_comment_reads for insert to authenticated with check (auth.uid() = user_id);
create policy "portfolio_comment_reads_update_own"
  on public.social_portfolio_comment_reads for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Username helper + auto-provision on signup
-- ---------------------------------------------------------------------------

create or replace function public.social_sanitize_username(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  base text := lower(regexp_replace(coalesce(p_raw, ''), '[^a-z0-9_]', '', 'g'));
  candidate text;
  n integer := 0;
begin
  if base = '' or char_length(base) < 3 then
    base := 'investor';
  end if;
  base := left(base, 30);
  candidate := base;
  while exists (select 1 from public.social_profiles where lower(username) = candidate) loop
    n := n + 1;
    candidate := left(base, greatest(1, 30 - char_length(n::text))) || n::text;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_social_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_local text;
  suggested text;
begin
  email_local := split_part(coalesce(new.email, ''), '@', 1);
  suggested := public.social_sanitize_username(email_local);
  insert into public.social_profiles (user_id, username, display_name)
  values (
    new.id,
    suggested,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Investor')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_social_profile on auth.users;
create trigger on_auth_user_created_social_profile
  after insert on auth.users
  for each row execute function public.handle_new_social_user();

-- ---------------------------------------------------------------------------
-- RPC: public profile (anon + auth) — name, username, avatar only
-- ---------------------------------------------------------------------------

create or replace function public.get_social_profile_public(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.social_profiles;
begin
  select * into row
  from public.social_profiles
  where lower(username) = lower(trim(p_username));

  if row.user_id is null then
    return null;
  end if;

  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'avatar_url', row.avatar_url
  );
end;
$$;

revoke all on function public.get_social_profile_public(text) from public;
grant execute on function public.get_social_profile_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: full profile for signed-in users
-- ---------------------------------------------------------------------------

create or replace function public.get_social_profile(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_profiles;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into row
  from public.social_profiles
  where lower(username) = lower(trim(p_username));

  if row.user_id is null then
    return null;
  end if;

  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'location', row.location,
    'focus', row.focus,
    'created_at', row.created_at,
    'updated_at', row.updated_at,
    'is_self', row.user_id = uid
  );
end;
$$;

revoke all on function public.get_social_profile(text) from public;
grant execute on function public.get_social_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: ensure profile exists for current user (OAuth users created before trigger)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_social_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u auth.users;
  row public.social_profiles;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into row from public.social_profiles where user_id = uid;
  if row.user_id is not null then
    return json_build_object(
      'user_id', row.user_id,
      'username', row.username,
      'display_name', row.display_name,
      'bio', row.bio,
      'avatar_url', row.avatar_url,
      'location', row.location,
      'focus', row.focus,
      'is_self', true
    );
  end if;

  select * into u from auth.users where id = uid;
  insert into public.social_profiles (user_id, username, display_name)
  values (
    uid,
    public.social_sanitize_username(split_part(coalesce(u.email, ''), '@', 1)),
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
  )
  returning * into row;

  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'location', row.location,
    'focus', row.focus,
    'is_self', true
  );
end;
$$;

revoke all on function public.ensure_social_profile() from public;
grant execute on function public.ensure_social_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: portfolio engagement snapshot
-- ---------------------------------------------------------------------------

create or replace function public.get_portfolio_engagement(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  liked boolean := false;
  copied boolean := false;
  unread integer := 0;
  last_read timestamptz;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select owner_id into owner from public.social_portfolios where id = p_portfolio_id;
  if owner is null then
    raise exception 'Portfolio not found';
  end if;

  select exists (
    select 1 from public.social_portfolio_likes
    where portfolio_id = p_portfolio_id and user_id = uid
  ) into liked;

  select exists (
    select 1 from public.social_portfolio_copies
    where portfolio_id = p_portfolio_id and user_id = uid
  ) into copied;

  if owner = uid then
    select last_read_at into last_read
    from public.social_portfolio_comment_reads
    where portfolio_id = p_portfolio_id and user_id = uid;

    select count(*)::integer into unread
    from public.social_portfolio_comments c
    where c.portfolio_id = p_portfolio_id
      and c.author_id <> uid
      and (last_read is null or c.created_at > last_read);
  end if;

  return json_build_object(
    'likes', (select count(*)::integer from public.social_portfolio_likes where portfolio_id = p_portfolio_id),
    'shares', (select count(*)::integer from public.social_portfolio_shares where portfolio_id = p_portfolio_id),
    'copies', (select count(*)::integer from public.social_portfolio_copies where portfolio_id = p_portfolio_id),
    'comment_count', (select count(*)::integer from public.social_portfolio_comments where portfolio_id = p_portfolio_id),
    'liked', liked,
    'copied', copied,
    'unread_comments', case when owner = uid then unread else 0 end
  );
end;
$$;

revoke all on function public.get_portfolio_engagement(uuid) from public;
grant execute on function public.get_portfolio_engagement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: toggle like / copy
-- ---------------------------------------------------------------------------

create or replace function public.toggle_portfolio_like(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_liked boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.social_portfolio_likes where portfolio_id = p_portfolio_id and user_id = uid) then
    delete from public.social_portfolio_likes where portfolio_id = p_portfolio_id and user_id = uid;
    now_liked := false;
  else
    insert into public.social_portfolio_likes (portfolio_id, user_id) values (p_portfolio_id, uid);
    now_liked := true;
  end if;

  return json_build_object('liked', now_liked);
end;
$$;

revoke all on function public.toggle_portfolio_like(uuid) from public;
grant execute on function public.toggle_portfolio_like(uuid) to authenticated;

create or replace function public.toggle_portfolio_copy(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_copied boolean;
  src public.social_portfolios;
  copy_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid) then
    delete from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid;
    now_copied := false;
    copy_id := null;
  else
    select * into src from public.social_portfolios where id = p_portfolio_id;
    if src.id is null then raise exception 'Portfolio not found'; end if;
    if src.owner_id = uid then raise exception 'Cannot copy own portfolio'; end if;

    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis,
      source_portfolio_id, source_user_id, source_portfolio_name,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, src.kind, src.name, src.objective, src.thesis,
      src.id, src.owner_id, src.name,
      src.tickers, src.holdings, src.watchlist_base_investment
    )
    returning id into copy_id;

    insert into public.social_portfolio_copies (portfolio_id, user_id, copied_portfolio_id)
    values (p_portfolio_id, uid, copy_id);
    now_copied := true;
  end if;

  return json_build_object('copied', now_copied, 'copied_portfolio_id', copy_id);
end;
$$;

revoke all on function public.toggle_portfolio_copy(uuid) from public;
grant execute on function public.toggle_portfolio_copy(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record share (once per user)
-- ---------------------------------------------------------------------------

create or replace function public.record_portfolio_share(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inserted boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  with ins as (
    insert into public.social_portfolio_shares (portfolio_id, user_id)
    values (p_portfolio_id, uid)
    on conflict do nothing
    returning 1
  )
  select exists (select 1 from ins) into inserted;

  return json_build_object('recorded', inserted);
end;
$$;

revoke all on function public.record_portfolio_share(uuid) from public;
grant execute on function public.record_portfolio_share(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: comments
-- ---------------------------------------------------------------------------

create or replace function public.add_portfolio_comment(p_portfolio_id uuid, p_body text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_portfolio_comments;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  insert into public.social_portfolio_comments (portfolio_id, author_id, body)
  values (p_portfolio_id, uid, trim(p_body))
  returning * into row;

  return json_build_object(
    'id', row.id,
    'portfolio_id', row.portfolio_id,
    'author_id', row.author_id,
    'body', row.body,
    'created_at', row.created_at
  );
end;
$$;

revoke all on function public.add_portfolio_comment(uuid, text) from public;
grant execute on function public.add_portfolio_comment(uuid, text) to authenticated;

create or replace function public.mark_portfolio_comments_read(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select owner_id into owner from public.social_portfolios where id = p_portfolio_id;
  if owner is null or owner <> uid then
    raise exception 'Only portfolio owner can mark comments read';
  end if;

  insert into public.social_portfolio_comment_reads (portfolio_id, user_id, last_read_at)
  values (p_portfolio_id, uid, now())
  on conflict (portfolio_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_portfolio_comments_read(uuid) from public;
grant execute on function public.mark_portfolio_comments_read(uuid) to authenticated;
