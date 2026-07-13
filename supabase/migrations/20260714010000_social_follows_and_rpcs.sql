-- Live social follow graph (was localStorage-only before).

create table if not exists public.social_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint social_follows_no_self check (follower_id <> followee_id)
);

create index if not exists social_follows_followee_idx
  on public.social_follows (followee_id, created_at desc);

create index if not exists social_follows_follower_idx
  on public.social_follows (follower_id, created_at desc);

alter table public.social_follows enable row level security;

drop policy if exists social_follows_select_authenticated on public.social_follows;
create policy social_follows_select_authenticated
  on public.social_follows for select
  to authenticated
  using (true);

drop policy if exists social_follows_insert_own on public.social_follows;
create policy social_follows_insert_own
  on public.social_follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists social_follows_delete_own on public.social_follows;
create policy social_follows_delete_own
  on public.social_follows for delete
  to authenticated
  using (auth.uid() = follower_id);

create or replace function public.follow_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then raise exception 'User required'; end if;
  if p_user_id = uid then raise exception 'Cannot follow yourself'; end if;

  insert into public.social_follows (follower_id, followee_id)
  values (uid, p_user_id)
  on conflict do nothing;

  return exists (
    select 1 from public.social_follows
    where follower_id = uid and followee_id = p_user_id
  );
end;
$$;

create or replace function public.unfollow_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then raise exception 'User required'; end if;

  delete from public.social_follows
  where follower_id = uid and followee_id = p_user_id;

  return not exists (
    select 1 from public.social_follows
    where follower_id = uid and followee_id = p_user_id
  );
end;
$$;

create or replace function public.is_following(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if p_user_id is null then return false; end if;
  return exists (
    select 1 from public.social_follows
    where follower_id = uid and followee_id = p_user_id
  );
end;
$$;

create or replace function public.list_following(p_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  items json;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then
    return json_build_object('items', '[]'::json);
  end if;

  select coalesce(json_agg(f.followee_id order by f.created_at desc), '[]'::json)
  into items
  from public.social_follows f
  where f.follower_id = p_user_id;

  return json_build_object('items', coalesce(items, '[]'::json));
end;
$$;

create or replace function public.list_followers(p_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  items json;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then
    return json_build_object('items', '[]'::json);
  end if;

  select coalesce(json_agg(f.follower_id order by f.created_at desc), '[]'::json)
  into items
  from public.social_follows f
  where f.followee_id = p_user_id;

  return json_build_object('items', coalesce(items, '[]'::json));
end;
$$;

create or replace function public.get_follow_counts(p_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  followers_count integer := 0;
  following_count integer := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then
    return json_build_object('followers', 0, 'following', 0);
  end if;

  select count(*)::integer into followers_count
  from public.social_follows where followee_id = p_user_id;

  select count(*)::integer into following_count
  from public.social_follows where follower_id = p_user_id;

  return json_build_object(
    'followers', followers_count,
    'following', following_count
  );
end;
$$;

revoke all on function public.follow_user(uuid) from public;
revoke all on function public.unfollow_user(uuid) from public;
revoke all on function public.is_following(uuid) from public;
revoke all on function public.list_following(uuid) from public;
revoke all on function public.list_followers(uuid) from public;
revoke all on function public.get_follow_counts(uuid) from public;

grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.is_following(uuid) to authenticated;
grant execute on function public.list_following(uuid) to authenticated;
grant execute on function public.list_followers(uuid) to authenticated;
grant execute on function public.get_follow_counts(uuid) to authenticated;
