-- The market catalog retains assets whose upstream quote was unavailable on
-- a later refresh. Read APIs must never present those old prices as live.

create or replace function public.lookup_social_market_asset(p_key text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond')
    group by asset_type
  )
  select json_build_object(
    'asset_type', a.asset_type,
    'asset_key', a.asset_key,
    'name', a.name,
    'price', a.price,
    'change_pct', a.change_pct,
    'previous_close', a.previous_close,
    'as_of_date', a.as_of_date,
    'price_source', a.price_source,
    'synced_at', a.synced_at,
    'exchange', a.exchange,
    'exchange_symbol', a.exchange_symbol,
    'isin', a.isin
  )
  from public.social_market_assets a
  join latest_dates d
    on d.asset_type = a.asset_type
   and d.as_of_date = a.as_of_date
  where (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = upper(trim(p_key)))
     or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
  order by case a.asset_type
    when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 when 'bond' then 3 else 4 end
  limit 1;
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

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity')
    group by asset_type
  ),
  scored as (
    select
      a.*,
      case
        when lower(a.asset_key) = q then 100
        when lower(a.exchange_symbol) = q then 95
        when lower(a.isin) = q then 90
        when lower(a.asset_key) like q || '%' then 80
        when lower(a.exchange_symbol) like q || '%' then 75
        when lower(a.name) like q || '%' then 60
        when lower(a.asset_key) like '%' || q || '%' then 45
        when lower(a.exchange_symbol) like '%' || q || '%' then 43
        when lower(a.isin) like '%' || q || '%' then 42
        when lower(a.name) like '%' || q || '%' then 40
        else 0
      end as score
    from public.social_market_assets a
    join latest_dates d
      on d.asset_type = a.asset_type
     and d.as_of_date = a.as_of_date
    where (p_asset_type is null or a.asset_type = p_asset_type)
      and (
        lower(a.asset_key) like '%' || q || '%'
        or lower(a.exchange_symbol) like '%' || q || '%'
        or lower(a.isin) like '%' || q || '%'
        or lower(a.name) like '%' || q || '%'
      )
  ),
  ranked as (
    select * from scored
    where score > 0
    order by score desc, asset_key asc
    limit lim
  )
  select json_build_object(
    'items', coalesce(json_agg(json_build_object(
      'asset_type', r.asset_type,
      'asset_key', r.asset_key,
      'name', r.name,
      'price', r.price,
      'change_pct', r.change_pct,
      'previous_close', r.previous_close,
      'as_of_date', r.as_of_date,
      'price_source', r.price_source,
      'synced_at', r.synced_at,
      'exchange', r.exchange,
      'exchange_symbol', r.exchange_symbol,
      'isin', r.isin,
      'score', r.score
    ) order by r.score desc, r.asset_key asc), '[]'::json),
    'total', (select count(*)::int from scored where score > 0)
  ) into result
  from ranked r;

  return coalesce(result, json_build_object('items', '[]'::json, 'total', 0));
end;
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

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond')
    group by asset_type
  )
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
      a.synced_at,
      a.exchange,
      a.exchange_symbol,
      a.isin
    from (
      select trim(k) as raw_key, upper(trim(k)) as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*
      from public.social_market_assets a
      join latest_dates d
        on d.asset_type = a.asset_type
       and d.as_of_date = a.as_of_date
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
         or i.isin = keys.norm_key
      order by case a.asset_type
        when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 when 'bond' then 3 else 4 end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
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
  latest_date date;
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund', 'commodity') then
    raise exception 'Invalid asset type';
  end if;

  select max(as_of_date)
  into latest_date
  from public.social_market_assets
  where asset_type = p_asset_type;

  if p_asset_type = 'fund' then
    select json_build_object(
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = 'fund' and as_of_date = latest_date),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select a.asset_type, a.asset_key, a.name, a.price, a.change_pct,
        a.previous_close, a.as_of_date, a.price_source, a.synced_at,
        a.exchange, a.exchange_symbol, a.isin
      from public.social_market_assets a
      where a.asset_type = 'fund'
        and a.as_of_date = latest_date
        and a.price is not null
        and a.name ~* 'direct'
        and a.name ~* 'growth'
      order by a.name asc
      limit lim
    ) t;
  else
    select json_build_object(
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = p_asset_type and as_of_date = latest_date),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select a.asset_type, a.asset_key, a.name, a.price, a.change_pct,
        a.previous_close, a.as_of_date, a.price_source, a.synced_at,
        a.exchange, a.exchange_symbol, a.isin
      from public.social_market_assets a
      where a.asset_type = p_asset_type
        and a.as_of_date = latest_date
        and a.price is not null
      order by abs(coalesce(a.change_pct, 0)) desc, a.asset_key asc
      limit lim
    ) t;
  end if;

  return coalesce(result, json_build_object('synced_at', null, 'items', '[]'::json));
end;
$$;

grant execute on function public.lookup_social_market_asset(text) to authenticated;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
grant execute on function public.search_social_market_assets(text, text, integer) to authenticated;
grant execute on function public.list_social_market_preview(text, integer) to authenticated;
