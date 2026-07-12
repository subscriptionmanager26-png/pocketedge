-- Phase 3/4: server market search + batch lookup + app bootstrap.

create index if not exists social_market_assets_key_lower_pattern_idx
  on public.social_market_assets (lower(asset_key) text_pattern_ops);

create index if not exists social_market_assets_name_lower_pattern_idx
  on public.social_market_assets (lower(name) text_pattern_ops);

create index if not exists social_market_assets_type_key_idx
  on public.social_market_assets (asset_type, asset_key);

-- Prefix / contains search for stocks, ETFs, and funds.
create or replace function public.search_social_market_assets(
  p_query text,
  p_asset_type text default null,
  p_limit integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  result json;
begin
  if char_length(q) < 2 then
    return json_build_object('items', '[]'::json, 'total', 0);
  end if;

  if p_asset_type is not null and p_asset_type not in ('stock', 'etf', 'fund') then
    raise exception 'Invalid asset type';
  end if;

  with scored as (
    select
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.synced_at,
      case
        when lower(a.asset_key) = q then 100
        when lower(a.asset_key) like q || '%' then 80
        when lower(a.name) like q || '%' then 60
        when lower(a.asset_key) like '%' || q || '%' then 45
        when lower(a.name) like '%' || q || '%' then 40
        else 0
      end as score
    from public.social_market_assets a
    where (p_asset_type is null or a.asset_type = p_asset_type)
      and (
        lower(a.asset_key) like q || '%'
        or lower(a.asset_key) like '%' || q || '%'
        or lower(a.name) like q || '%'
        or lower(a.name) like '%' || q || '%'
      )
  ),
  ranked as (
    select *
    from scored
    where score > 0
    order by score desc, asset_key asc
    limit lim
  )
  select json_build_object(
    'items', coalesce(json_agg(
      json_build_object(
        'asset_type', r.asset_type,
        'asset_key', r.asset_key,
        'name', r.name,
        'price', r.price,
        'change_pct', r.change_pct,
        'synced_at', r.synced_at,
        'score', r.score
      )
      order by r.score desc, r.asset_key asc
    ), '[]'::json),
    'total', (select count(*)::int from scored where score > 0)
  )
  into result
  from ranked r;

  return coalesce(result, json_build_object('items', '[]'::json, 'total', 0));
end;
$$;

-- Batch lookup for portfolio holdings enrichment / resolution.
create or replace function public.lookup_social_market_assets_batch(p_keys text[])
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_keys is null or cardinality(p_keys) = 0 then
    return '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select distinct on (norm_key)
      norm_key as query_key,
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct
    from (
      select
        trim(k) as raw_key,
        case
          when trim(k) ~ '^[0-9]+$' then trim(k)
          else upper(trim(k))
        end as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*
      from public.social_market_assets a
      where (a.asset_type in ('stock', 'etf') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
      order by case a.asset_type when 'stock' then 0 when 'etf' then 1 else 2 end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

-- Single round-trip bootstrap: profile + feed.
create or replace function public.bootstrap_social_app(p_feed_limit integer default 50)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile json;
  feed json;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  profile := public.ensure_social_profile();
  feed := public.list_feed_posts(greatest(1, least(coalesce(p_feed_limit, 50), 100)), 0);

  return json_build_object(
    'profile', profile,
    'feed', feed
  );
end;
$$;

revoke all on function public.search_social_market_assets(text, text, integer) from public;
revoke all on function public.lookup_social_market_assets_batch(text[]) from public;
revoke all on function public.bootstrap_social_app(integer) from public;

grant execute on function public.search_social_market_assets(text, text, integer) to authenticated;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
grant execute on function public.bootstrap_social_app(integer) to authenticated;
grant execute on function public.lookup_social_market_asset(text) to authenticated;
