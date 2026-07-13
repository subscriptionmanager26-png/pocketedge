-- Allow MCX commodity spot quotes in social market catalog + history.

alter table public.social_market_assets
  drop constraint if exists social_market_assets_asset_type_check;
alter table public.social_market_assets
  add constraint social_market_assets_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'commodity'));

alter table public.social_market_price_history
  drop constraint if exists social_market_price_history_asset_type_check;
alter table public.social_market_price_history
  add constraint social_market_price_history_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'commodity'));

alter table public.social_market_price_fetch_runs
  drop constraint if exists social_market_price_fetch_runs_mode_check;
alter table public.social_market_price_fetch_runs
  add constraint social_market_price_fetch_runs_mode_check
  check (mode in ('equity', 'funds', 'commodities', 'all'));

alter table public.social_market_price_fetch_runs
  add column if not exists commodity_updated integer not null default 0;

comment on column public.social_market_assets.price_source is
  'Upstream quote source, e.g. nse | amfi | mcx.';

-- ---------------------------------------------------------------------------
-- Read APIs: allow commodity
-- ---------------------------------------------------------------------------

create or replace function public.lookup_social_market_asset(p_key text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'asset_type', a.asset_type,
    'asset_key', a.asset_key,
    'name', a.name,
    'price', a.price,
    'change_pct', a.change_pct,
    'previous_close', a.previous_close,
    'as_of_date', a.as_of_date,
    'price_source', a.price_source,
    'synced_at', a.synced_at
  )
  from public.social_market_assets a
  where (a.asset_type in ('stock', 'etf', 'commodity') and a.asset_key = upper(trim(p_key)))
     or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
  order by case a.asset_type
    when 'stock' then 0
    when 'etf' then 1
    when 'commodity' then 2
    else 3
  end
  limit 1;
$$;

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
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      a.price_source,
      a.synced_at
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
      where (a.asset_type in ('stock', 'etf', 'commodity') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
      order by case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'commodity' then 2
        else 3
      end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

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

  if p_asset_type is not null and p_asset_type not in ('stock', 'etf', 'fund', 'commodity') then
    raise exception 'Invalid asset type';
  end if;

  with scored as (
    select
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      a.price_source,
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
        'previous_close', r.previous_close,
        'as_of_date', r.as_of_date,
        'price_source', r.price_source,
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

create or replace function public.list_social_market_preview(
  p_asset_type text,
  p_limit integer default 40
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 40), 100));
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund', 'commodity') then
    raise exception 'Invalid asset type';
  end if;

  if p_asset_type = 'fund' then
    select json_build_object(
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = 'fund'),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select
        a.asset_type,
        a.asset_key,
        a.name,
        a.price,
        a.change_pct,
        a.previous_close,
        a.as_of_date,
        a.price_source,
        a.synced_at
      from public.social_market_assets a
      where a.asset_type = 'fund'
        and a.price is not null
        and a.name ~* 'direct'
        and a.name ~* 'growth'
      order by a.name asc
      limit lim
    ) t;
  else
    select json_build_object(
      'synced_at', (
        select max(synced_at) from public.social_market_assets where asset_type = p_asset_type
      ),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select
        a.asset_type,
        a.asset_key,
        a.name,
        a.price,
        a.change_pct,
        a.previous_close,
        a.as_of_date,
        a.price_source,
        a.synced_at
      from public.social_market_assets a
      where a.asset_type = p_asset_type
        and a.price is not null
      order by abs(coalesce(a.change_pct, 0)) desc, a.asset_key asc
      limit lim
    ) t;
  end if;

  return coalesce(result, json_build_object('synced_at', null, 'items', '[]'::json));
end;
$$;

create or replace function public.get_social_market_price_history(
  p_asset_type text,
  p_asset_key text,
  p_limit integer default 120
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 120), 500));
  key text;
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund', 'commodity') then
    raise exception 'Invalid asset type';
  end if;

  key := case
    when p_asset_type = 'fund' then trim(p_asset_key)
    else upper(trim(p_asset_key))
  end;

  if key is null or key = '' then
    return '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.as_of_date desc), '[]'::json)
  into result
  from (
    select
      h.asset_type,
      h.asset_key,
      h.as_of_date,
      h.close_price,
      h.previous_close,
      h.change_pct,
      h.source,
      h.synced_at
    from public.social_market_price_history h
    where h.asset_type = p_asset_type
      and h.asset_key = key
    order by h.as_of_date desc
    limit lim
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;
