-- Speed path for Portfolio / Profile / Market search:
-- 1. Prefer live quotes when enriching holdings (was preferring saved snapshots).
-- 2. Set-based enrich instead of per-holding lookup RPCs.
-- 3. Faster market search: prefix-first, skip expensive full-score totals,
--    and index as_of_date for latest-quote filtering.

create index if not exists social_market_assets_type_as_of_date_idx
  on public.social_market_assets (asset_type, as_of_date desc);

create or replace function public.enrich_portfolio_holdings(p_holdings jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' then
    return '[]'::jsonb;
  end if;

  with elems as (
    select ordinality as ord, value as elem
    from jsonb_array_elements(p_holdings) with ordinality
  ),
  keyed as (
    select
      e.ord,
      e.elem,
      coalesce(nullif(trim(e.elem->>'ticker'), ''), nullif(trim(e.elem->>'symbol'), '')) as ticker
    from elems e
  ),
  latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond')
    group by asset_type
  ),
  matched as (
    select distinct on (k.ord)
      k.ord,
      k.elem,
      k.ticker,
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      coalesce(a.isin, i.isin) as isin
    from keyed k
    left join lateral (
      select a.*
      from public.social_market_assets a
      left join latest_dates d
        on d.asset_type = a.asset_type
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where k.ticker is not null
        and (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
        and (
          (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = upper(k.ticker))
          or (a.asset_type = 'fund' and a.asset_key = k.ticker)
          or i.isin = upper(k.ticker)
        )
      order by case a.asset_type
        when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 when 'bond' then 3 else 4 end
      limit 1
    ) a on true
    left join public.social_market_asset_isins i
      on i.asset_type = a.asset_type and i.asset_key = a.asset_key
    order by k.ord
  ),
  merged as (
    select
      m.ord,
      case
        when m.asset_key is null then m.elem
        else m.elem || jsonb_build_object(
          'ticker', m.asset_key,
          'assetType', m.asset_type,
          'assetName', m.name,
          -- Live quote wins. Stored snapshot is only a fallback.
          'price', coalesce(m.price, nullif(m.elem->>'price', '')::numeric),
          'previousClose', coalesce(
            m.previous_close,
            nullif(m.elem->>'previousClose', '')::numeric
          ),
          'changePct', coalesce(
            m.change_pct,
            case
              when m.price is not null
                and m.previous_close is not null
                and m.previous_close <> 0
              then ((m.price - m.previous_close) / m.previous_close) * 100
              else nullif(m.elem->>'changePct', '')::numeric
            end
          ),
          'isin', coalesce(m.isin, nullif(m.elem->>'isin', ''))
        )
      end as elem
    from matched m
  )
  select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
  into result
  from merged;

  return coalesce(result, '[]'::jsonb);
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

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity')
    group by asset_type
  ),
  candidates as (
    select a.*
    from public.social_market_assets a
    left join latest_dates d on d.asset_type = a.asset_type
    where (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
      and (p_asset_type is null or a.asset_type = p_asset_type)
      and (
        -- Prefix matches use the existing pattern indexes.
        lower(a.asset_key) like q || '%'
        or lower(coalesce(a.exchange_symbol, '')) like q || '%'
        or lower(a.name) like q || '%'
        or lower(coalesce(a.isin, '')) like q || '%'
        -- Contains search only for longer queries to avoid full scans on short needles.
        or (
          char_length(q) >= 4
          and (
            lower(a.asset_key) like '%' || q || '%'
            or lower(coalesce(a.exchange_symbol, '')) like '%' || q || '%'
            or lower(coalesce(a.isin, '')) like '%' || q || '%'
            or lower(a.name) like '%' || q || '%'
          )
        )
      )
  ),
  scored as (
    select
      c.*,
      case
        when lower(c.asset_key) = q then 100
        when lower(coalesce(c.exchange_symbol, '')) = q then 95
        when lower(coalesce(c.isin, '')) = q then 90
        when lower(c.asset_key) like q || '%' then 80
        when lower(coalesce(c.exchange_symbol, '')) like q || '%' then 75
        when lower(c.name) like q || '%' then 60
        when lower(c.asset_key) like '%' || q || '%' then 45
        when lower(coalesce(c.exchange_symbol, '')) like '%' || q || '%' then 43
        when lower(coalesce(c.isin, '')) like '%' || q || '%' then 42
        when lower(c.name) like '%' || q || '%' then 40
        else 0
      end as score
    from candidates c
  ),
  ranked as (
    select * from scored
    where score > 0
    order by score desc, asset_key asc
    limit lim
  )
  select json_build_object(
    'items', coalesce((
      select json_agg(json_build_object(
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
      ) order by r.score desc, r.asset_key asc)
      from ranked r
    ), '[]'::json),
    'total', (select count(*)::int from ranked)
  ) into result;

  return coalesce(result, json_build_object('items', '[]'::json, 'total', 0));
end;
$$;

grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;
grant execute on function public.search_social_market_assets(text, text, integer) to authenticated;
