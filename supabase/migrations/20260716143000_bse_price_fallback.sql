-- BSE fallback listings require a stable venue-specific key because a bare
-- tradable symbol can collide with an NSE listing.

alter table public.social_market_assets
  add column if not exists exchange text,
  add column if not exists exchange_symbol text,
  add column if not exists isin text;

comment on column public.social_market_assets.exchange is
  'Listing venue for exchange-backed instruments, e.g. NSE or BSE.';
comment on column public.social_market_assets.exchange_symbol is
  'Tradable symbol at the listing venue; asset_key remains canonical.';
comment on column public.social_market_assets.isin is
  'ISIN supplied by the approved BSE fallback universe.';

create index if not exists social_market_assets_exchange_symbol_lower_pattern_idx
  on public.social_market_assets (lower(exchange_symbol) text_pattern_ops)
  where exchange_symbol is not null;
create index if not exists social_market_assets_isin_lower_pattern_idx
  on public.social_market_assets (lower(isin) text_pattern_ops)
  where isin is not null;

create or replace function public.bulk_upsert_social_market_assets(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.social_market_assets (
    asset_type, asset_key, name, price, change_pct, synced_at,
    previous_close, as_of_date, price_source, exchange, exchange_symbol, isin
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
    nullif(upper(trim(r.isin)), '')
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
    isin text
  )
  on conflict (asset_type, asset_key) do update set
    name = case
      when excluded.name is not null and excluded.name <> excluded.asset_key
        then excluded.name
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
    isin = coalesce(excluded.isin, public.social_market_assets.isin);

  get diagnostics n = row_count;
  return n;
end;
$$;

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
    'synced_at', a.synced_at,
    'exchange', a.exchange,
    'exchange_symbol', a.exchange_symbol,
    'isin', a.isin
  )
  from public.social_market_assets a
  where (a.asset_type in ('stock', 'etf', 'commodity') and a.asset_key = upper(trim(p_key)))
     or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
  order by case a.asset_type
    when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 else 3 end
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

  with scored as (
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
