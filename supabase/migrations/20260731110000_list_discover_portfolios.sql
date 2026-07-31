-- Discover published portfolios across owners (public-redacted payload).
-- Direct table SELECT remains owner-only; this RPC mirrors profile share visibility.

create or replace function public.list_discover_portfolios(
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  needle text := nullif(trim(p_query), '');
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(0, coalesce(p_offset, 0));
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  return coalesce(
    (
      select json_agg(row_json order by sort_updated desc)
      from (
        select
          json_build_object(
            'portfolio', public.map_social_portfolio_row_public(p),
            'owner', json_build_object(
              'id', sp.user_id,
              'name', coalesce(nullif(trim(sp.display_name), ''), sp.username),
              'handle', sp.username,
              'avatarUrl', sp.avatar_url,
              'bio', sp.bio
            )
          ) as row_json,
          p.updated_at as sort_updated
        from public.social_portfolios p
        join public.social_profiles sp on sp.user_id = p.owner_id
        where not p.is_archived
          and not p.is_draft
          and (
            needle is null
            or p.name ilike '%' || needle || '%'
            or coalesce(p.objective, '') ilike '%' || needle || '%'
            or coalesce(p.thesis, '') ilike '%' || needle || '%'
            or sp.username ilike '%' || needle || '%'
            or coalesce(sp.display_name, '') ilike '%' || needle || '%'
          )
        order by p.updated_at desc
        offset off
        limit lim
      ) ranked
    ),
    '[]'::json
  );
end;
$$;

revoke all on function public.list_discover_portfolios(text, int, int) from public, anon;
grant execute on function public.list_discover_portfolios(text, int, int) to authenticated;
