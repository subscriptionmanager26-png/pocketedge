-- Suggested people for the feed right rail: most followers, then newest join.

create or replace function public.list_suggested_people(
  p_limit int default 5
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  focus text,
  follower_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.user_id,
    sp.username,
    coalesce(nullif(trim(sp.display_name), ''), sp.username) as display_name,
    sp.avatar_url,
    sp.focus,
    (
      select count(*)::bigint
      from public.social_follows f
      where f.followee_id = sp.user_id
    ) as follower_count,
    sp.created_at
  from public.social_profiles sp
  where sp.user_id is distinct from auth.uid()
    and coalesce(sp.username, '') <> ''
  order by
    (
      select count(*)::bigint
      from public.social_follows f
      where f.followee_id = sp.user_id
    ) desc,
    sp.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

revoke all on function public.list_suggested_people(int) from public;
grant execute on function public.list_suggested_people(int) to anon, authenticated;
