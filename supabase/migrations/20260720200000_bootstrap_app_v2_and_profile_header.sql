-- Consolidated app bootstrap + profile header + portfolio summary + markets index.

-- Markets preview: speed up top movers by asset type.
create index if not exists social_market_assets_type_change_idx
  on public.social_market_assets (asset_type, change_pct desc nulls last)
  where price is not null;

-- Profile header: person + follow counts + influencing in one round-trip.
create or replace function public.get_profile_header(p_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile_row public.social_profiles;
  counts json;
  influencing text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then return null; end if;

  select * into profile_row
  from public.social_profiles sp
  where sp.user_id = p_user_id;

  counts := public.get_follow_counts(p_user_id);
  influencing := public.get_influencing_bucket(p_user_id);

  return json_build_object(
    'profile', case
      when profile_row.user_id is null then null
      else json_build_object(
        'user_id', profile_row.user_id,
        'username', profile_row.username,
        'display_name', profile_row.display_name,
        'bio', profile_row.bio,
        'avatar_url', profile_row.avatar_url
      )
    end,
    'follow_counts', counts,
    'influencing', influencing
  );
end;
$$;

revoke all on function public.get_profile_header(uuid) from public;
grant execute on function public.get_profile_header(uuid) to authenticated;

-- Portfolio list cards: metadata + top 5 holdings only.
create or replace function public.list_user_portfolios_summary(p_owner_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result json;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if p_owner_id = uid then
    select coalesce(
      json_agg(
        json_build_object(
          'id', row.id,
          'kind', row.kind,
          'name', row.name,
          'objective', row.objective,
          'thesis', row.thesis,
          'is_draft', row.is_draft,
          'is_archived', row.is_archived,
          'tickers', row.tickers,
          'holdings', (
            select coalesce(json_agg(sub.h order by (sub.h->>'weightPct')::numeric desc nulls last), '[]'::json)
            from (
              select h as h
              from jsonb_array_elements(public.enrich_portfolio_holdings(row.holdings)) as h
              limit 5
            ) sub
          ),
          'total_return_pct', public.portfolio_total_return_pct(row.holdings),
          'created_at', row.created_at,
          'updated_at', row.updated_at
        )
        order by row.updated_at desc
      ),
      '[]'::json
    )
    into result
    from public.social_portfolios row
    where row.owner_id = p_owner_id
      and not row.is_archived
      and not row.is_draft;
  else
    select coalesce(
      json_agg(public.map_social_portfolio_row_public(row) order by row.updated_at desc),
      '[]'::json
    )
    into result
    from public.social_portfolios row
    where row.owner_id = p_owner_id
      and not row.is_archived
      and not row.is_draft;
  end if;

  return result;
end;
$$;

revoke all on function public.list_user_portfolios_summary(uuid) from public;
grant execute on function public.list_user_portfolios_summary(uuid) to authenticated;

-- Single RPC cold-start bootstrap for authenticated users.
create or replace function public.bootstrap_app_v2(p_feed_limit integer default 50)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile json;
  feed json;
  portfolios json;
  markets json;
  counts json;
  influencing text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  profile := public.ensure_social_profile();
  feed := public.list_feed_posts(greatest(1, least(coalesce(p_feed_limit, 50), 100)), 0);
  portfolios := public.list_user_portfolios(uid);
  markets := public.list_social_market_preview('stock', 40);
  counts := public.get_follow_counts(uid);
  influencing := public.get_influencing_bucket(uid);

  return json_build_object(
    'profile', profile,
    'feed', feed,
    'portfolios', coalesce(portfolios, '[]'::json),
    'markets_preview', markets,
    'follow_counts', counts,
    'influencing', influencing
  );
end;
$$;

revoke all on function public.bootstrap_app_v2(integer) from public;
grant execute on function public.bootstrap_app_v2(integer) to authenticated;
