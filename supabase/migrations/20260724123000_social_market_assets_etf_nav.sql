-- Store NSE ETF NAV alongside LTP so Resources iNAV tracker can read quotes from DB.

alter table public.social_market_assets
  add column if not exists nav numeric;

comment on column public.social_market_assets.nav is
  'NSE published NAV / iNAV for ETFs (null for non-ETF assets).';

create or replace function public.bulk_upsert_social_market_assets(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer;
begin
  insert into public.social_market_assets (
    asset_type,
    asset_key,
    name,
    price,
    change_pct,
    synced_at,
    previous_close,
    as_of_date,
    price_source,
    exchange,
    exchange_symbol,
    isin,
    nav
  )
  select
    r.asset_type,
    r.asset_key,
    coalesce(nullif(trim(r.name), ''), r.asset_key),
    r.price,
    r.change_pct,
    coalesce(r.synced_at::timestamptz, now()),
    r.previous_close,
    r.as_of_date::date,
    r.price_source,
    nullif(upper(trim(r.exchange)), ''),
    nullif(upper(trim(r.exchange_symbol)), ''),
    nullif(upper(trim(r.isin)), ''),
    r.nav
  from jsonb_to_recordset(p_rows) as r(
    asset_type text,
    asset_key text,
    name text,
    price numeric,
    change_pct numeric,
    synced_at text,
    previous_close numeric,
    as_of_date text,
    price_source text,
    exchange text,
    exchange_symbol text,
    isin text,
    nav numeric
  )
  on conflict (asset_type, asset_key) do update set
    name = case
      when excluded.name is not null and excluded.name <> excluded.asset_key then excluded.name
      else public.social_market_assets.name
    end,
    price = coalesce(excluded.price, public.social_market_assets.price),
    change_pct = coalesce(excluded.change_pct, public.social_market_assets.change_pct),
    synced_at = excluded.synced_at,
    previous_close = coalesce(excluded.previous_close, public.social_market_assets.previous_close),
    as_of_date = coalesce(excluded.as_of_date, public.social_market_assets.as_of_date),
    price_source = coalesce(excluded.price_source, public.social_market_assets.price_source),
    exchange = coalesce(excluded.exchange, public.social_market_assets.exchange),
    exchange_symbol = coalesce(excluded.exchange_symbol, public.social_market_assets.exchange_symbol),
    isin = coalesce(excluded.isin, public.social_market_assets.isin),
    nav = coalesce(excluded.nav, public.social_market_assets.nav);

  get diagnostics n = row_count;
  return n;
end;
$function$;

create or replace function public.lookup_social_market_assets_batch(p_keys text[])
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  result json;
begin
  if p_keys is null or cardinality(p_keys) = 0 then
    return '[]'::json;
  end if;

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond', 'index')
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
      coalesce(a.isin, a.mapped_isin) as isin,
      a.logo_url,
      a.logo_icon_url,
      a.nav
    from (
      select trim(k) as raw_key, upper(trim(k)) as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*, i.isin as mapped_isin
      from public.social_market_assets a
      left join latest_dates d on d.asset_type = a.asset_type
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
        and (
          (a.asset_type in ('stock', 'etf', 'commodity', 'bond', 'index') and a.asset_key = keys.norm_key)
          or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
          or i.isin = keys.norm_key
        )
      order by case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        when 'bond' then 3
        when 'index' then 4
        else 5
      end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$function$;

create or replace function public.lookup_social_market_asset(p_key text)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond', 'index')
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
    'isin', a.isin,
    'logo_url', a.logo_url,
    'logo_icon_url', a.logo_icon_url,
    'nav', a.nav
  )
  from public.social_market_assets a
  left join latest_dates d on d.asset_type = a.asset_type
  where (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
    and (
      (a.asset_type in ('stock', 'etf', 'commodity', 'bond', 'index') and a.asset_key = upper(trim(p_key)))
      or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
    )
  order by case a.asset_type
    when 'stock' then 0
    when 'etf' then 1
    when 'fund' then 2
    when 'bond' then 3
    when 'index' then 4
    else 5
  end
  limit 1;
$function$;

create or replace function public.list_social_market_preview(p_asset_type text, p_limit integer default 40)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 40), 100));
  latest_date date;
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund', 'commodity', 'index') then
    raise exception 'Invalid asset type';
  end if;

  select max(as_of_date) into latest_date
  from public.social_market_assets
  where asset_type = p_asset_type;

  if p_asset_type = 'fund' then
    select json_build_object(
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = 'fund'),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select a.asset_type, a.asset_key, a.name, a.price, a.change_pct,
        a.previous_close, a.as_of_date, a.price_source, a.synced_at,
        a.exchange, a.exchange_symbol, a.isin, a.logo_url, a.logo_icon_url, a.nav
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
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = p_asset_type and as_of_date = latest_date),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select a.asset_type, a.asset_key, a.name, a.price, a.change_pct,
        a.previous_close, a.as_of_date, a.price_source, a.synced_at,
        a.exchange, a.exchange_symbol, a.isin, a.logo_url, a.logo_icon_url, a.nav
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
$function$;
