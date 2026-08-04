-- Speed up lookup_social_market_assets_batch: replace per-key LATERAL + OR
-- with set-based joins. Old plan ~3s for 20 keys (statement timeout → HTTP 500);
-- new plan ~40ms for the same keys.

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

  with keys as (
    select distinct trim(k) as raw_key, upper(trim(k)) as norm_key
    from unnest(p_keys) as k
    where trim(coalesce(k, '')) <> ''
  ),
  latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond', 'index')
    group by asset_type
  ),
  direct as (
    select
      k.norm_key as query_key,
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
      a.isin,
      a.logo_url,
      a.logo_icon_url,
      a.nav,
      0 as prio
    from keys k
    join public.social_market_assets a
      on a.asset_key = k.norm_key
     and a.asset_type in ('stock', 'etf', 'commodity', 'bond', 'index')
    join latest_dates d
      on d.asset_type = a.asset_type
     and a.as_of_date = d.as_of_date
  ),
  funds as (
    select
      k.norm_key as query_key,
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
      a.isin,
      a.logo_url,
      a.logo_icon_url,
      a.nav,
      1 as prio
    from keys k
    join public.social_market_assets a
      on a.asset_type = 'fund'
     and a.asset_key = k.raw_key
  ),
  by_isin as (
    select
      k.norm_key as query_key,
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
      coalesce(a.isin, i.isin) as isin,
      a.logo_url,
      a.logo_icon_url,
      a.nav,
      2 as prio
    from keys k
    join public.social_market_asset_isins i
      on i.isin = k.norm_key
    join public.social_market_assets a
      on a.asset_type = i.asset_type
     and a.asset_key = i.asset_key
    left join latest_dates d on d.asset_type = a.asset_type
    where a.asset_type = 'fund' or a.as_of_date = d.as_of_date
  ),
  all_matches as (
    select * from direct
    union all
    select * from funds
    union all
    select * from by_isin
  ),
  picked as (
    select distinct on (query_key)
      query_key,
      asset_type,
      asset_key,
      name,
      price,
      change_pct,
      previous_close,
      as_of_date,
      price_source,
      synced_at,
      exchange,
      exchange_symbol,
      isin,
      logo_url,
      logo_icon_url,
      nav
    from all_matches
    order by
      query_key,
      case asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        when 'bond' then 3
        when 'index' then 4
        else 5
      end,
      prio
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from picked t;

  return coalesce(result, '[]'::json);
end;
$function$;

revoke all on function public.lookup_social_market_assets_batch(text[]) from public;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
