-- Persist NSE live market cap from /api/live-analysis-stocksTraded
-- (totalMarketCap is already in ₹ crore on that endpoint).

comment on column public.social_market_assets.market_cap_rs is
  'Absolute market cap in INR. From NSE stocks-traded totalMarketCap * 1e7.';

comment on column public.social_market_assets.market_cap_cr is
  'Market cap in INR crore from NSE stocks-traded totalMarketCap. Used for Top 100 / 100-250 / 250-500 ranking.';

comment on column public.social_market_assets.market_cap_as_of is
  'IST trading date when market_cap_* was last refreshed from NSE.';

comment on column public.social_market_assets.market_cap_series is
  'NSE series at mcap refresh (EQ preferred for ranking).';

comment on column public.social_market_assets.market_cap_source is
  'Provenance, e.g. nse_stocks_traded.';

comment on column public.social_market_assets.market_cap_synced_at is
  'Timestamp when market_cap_* was last written.';

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
    nav,
    market_cap_rs,
    market_cap_cr,
    market_cap_as_of,
    market_cap_series,
    market_cap_source,
    market_cap_synced_at
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
    r.nav,
    r.market_cap_rs,
    r.market_cap_cr,
    r.market_cap_as_of::date,
    nullif(upper(trim(r.market_cap_series)), ''),
    nullif(trim(r.market_cap_source), ''),
    r.market_cap_synced_at::timestamptz
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
    nav numeric,
    market_cap_rs numeric,
    market_cap_cr numeric,
    market_cap_as_of text,
    market_cap_series text,
    market_cap_source text,
    market_cap_synced_at text
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
    nav = coalesce(excluded.nav, public.social_market_assets.nav),
    market_cap_rs = coalesce(excluded.market_cap_rs, public.social_market_assets.market_cap_rs),
    market_cap_cr = coalesce(excluded.market_cap_cr, public.social_market_assets.market_cap_cr),
    market_cap_as_of = coalesce(excluded.market_cap_as_of, public.social_market_assets.market_cap_as_of),
    market_cap_series = coalesce(excluded.market_cap_series, public.social_market_assets.market_cap_series),
    market_cap_source = coalesce(excluded.market_cap_source, public.social_market_assets.market_cap_source),
    market_cap_synced_at = coalesce(
      excluded.market_cap_synced_at,
      public.social_market_assets.market_cap_synced_at
    );

  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.bulk_upsert_social_market_assets(jsonb) from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_assets(jsonb) to service_role;
