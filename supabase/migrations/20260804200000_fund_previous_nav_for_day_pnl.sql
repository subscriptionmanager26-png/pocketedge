-- Expose previous NAV observation (nav + as_of_date + change_pct) on market
-- lookup and portfolio enrich so Day's PnL can keep using yesterday's fund move
-- after same-day NAVs publish (typically ~23:30 IST).

create or replace function public.enrich_portfolio_holdings(p_holdings jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with elems as (
    select ordinality as ord, value as elem
    from jsonb_array_elements(coalesce(p_holdings, '[]'::jsonb)) with ordinality
  ),
  keyed as (
    select
      e.ord,
      e.elem,
      coalesce(
        nullif(trim(e.elem->>'ticker'), ''),
        nullif(trim(e.elem->>'symbol'), '')
      ) as ticker
    from elems e
  ),
  by_key as (
    select distinct on (k.ord)
      k.ord,
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      a.isin,
      a.logo_url,
      a.logo_icon_url
    from keyed k
    join public.social_market_assets a
      on k.ticker is not null
     and (
       (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = upper(k.ticker))
       or (a.asset_type = 'fund' and a.asset_key = k.ticker)
     )
    order by
      k.ord,
      case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        when 'bond' then 3
        else 4
      end
  ),
  by_isin as (
    select distinct on (k.ord)
      k.ord,
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      coalesce(a.isin, i.isin) as isin,
      a.logo_url,
      a.logo_icon_url
    from keyed k
    join public.social_market_asset_isins i
      on i.isin = upper(k.ticker)
    join public.social_market_assets a
      on a.asset_type = i.asset_type
     and a.asset_key = i.asset_key
    where k.ticker is not null
      and not exists (select 1 from by_key b where b.ord = k.ord)
    order by
      k.ord,
      case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        when 'bond' then 3
        else 4
      end
  ),
  matched as (
    select * from by_key
    union all
    select * from by_isin
  ),
  with_prior as (
    select
      m.*,
      p.as_of_date as previous_as_of_date,
      p.close_price as previous_nav,
      coalesce(
        p.change_pct,
        case
          when p.previous_close is not null and p.previous_close <> 0
          then ((p.close_price - p.previous_close) / p.previous_close) * 100
          else null
        end
      ) as previous_change_pct
    from matched m
    left join lateral (
      select h.as_of_date, h.close_price, h.previous_close, h.change_pct
      from public.social_market_price_history h
      where h.asset_type = m.asset_type
        and h.asset_key = m.asset_key
        and m.as_of_date is not null
        and h.as_of_date < m.as_of_date
      order by h.as_of_date desc
      limit 1
    ) p on true
  ),
  priced as (
    select
      k.ord,
      case
        when m.asset_key is null then k.elem
        else k.elem || jsonb_build_object(
          'ticker', m.asset_key,
          'assetType', m.asset_type,
          'assetName', m.name,
          'price', coalesce(m.price, nullif(k.elem->>'price', '')::numeric),
          'previousClose', coalesce(
            m.previous_close,
            nullif(k.elem->>'previousClose', '')::numeric
          ),
          'changePct', coalesce(
            m.change_pct,
            case
              when m.price is not null
                and m.previous_close is not null
                and m.previous_close <> 0
              then ((m.price - m.previous_close) / m.previous_close) * 100
              else nullif(k.elem->>'changePct', '')::numeric
            end
          ),
          'asOfDate', coalesce(
            m.as_of_date::text,
            nullif(k.elem->>'asOfDate', ''),
            nullif(k.elem->>'as_of_date', ''),
            nullif(k.elem->>'navDate', ''),
            nullif(k.elem->>'nav_date', '')
          ),
          'navDate', coalesce(
            m.as_of_date::text,
            nullif(k.elem->>'navDate', ''),
            nullif(k.elem->>'asOfDate', ''),
            nullif(k.elem->>'as_of_date', ''),
            nullif(k.elem->>'nav_date', '')
          ),
          'previousAsOfDate', coalesce(
            m.previous_as_of_date::text,
            nullif(k.elem->>'previousAsOfDate', ''),
            nullif(k.elem->>'previous_as_of_date', '')
          ),
          'previousNav', coalesce(
            m.previous_nav,
            m.previous_close,
            nullif(k.elem->>'previousNav', '')::numeric,
            nullif(k.elem->>'previous_nav', '')::numeric,
            nullif(k.elem->>'previousClose', '')::numeric
          ),
          'previousChangePct', coalesce(
            m.previous_change_pct,
            nullif(k.elem->>'previousChangePct', '')::numeric,
            nullif(k.elem->>'previous_change_pct', '')::numeric
          ),
          'isin', coalesce(m.isin, nullif(k.elem->>'isin', '')),
          'logoUrl', coalesce(m.logo_url, nullif(k.elem->>'logoUrl', ''), nullif(k.elem->>'logo_url', '')),
          'logoIconUrl', coalesce(
            m.logo_icon_url,
            nullif(k.elem->>'logoIconUrl', ''),
            nullif(k.elem->>'logo_icon_url', '')
          )
        )
      end as elem
    from keyed k
    left join with_prior m on m.ord = k.ord
  ),
  recomputed as (
    select
      p.ord,
      case
        when coalesce(nullif(p.elem->>'qty', '')::numeric, 0) > 0 then
          p.elem || jsonb_build_object(
            'value',
              coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
              * coalesce(
                  nullif(p.elem->>'price', '')::numeric,
                  nullif(p.elem->>'avg', '')::numeric,
                  0
                ),
            'pnl',
              (
                coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                * coalesce(
                    nullif(p.elem->>'price', '')::numeric,
                    nullif(p.elem->>'avg', '')::numeric,
                    0
                  )
              )
              - (
                coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                * coalesce(nullif(p.elem->>'avg', '')::numeric, 0)
              ),
            'pnlPct',
              case
                when coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                     * coalesce(nullif(p.elem->>'avg', '')::numeric, 0) > 0
                then (
                  (
                    (
                      coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                      * coalesce(
                          nullif(p.elem->>'price', '')::numeric,
                          nullif(p.elem->>'avg', '')::numeric,
                          0
                        )
                    )
                    - (
                      coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                      * coalesce(nullif(p.elem->>'avg', '')::numeric, 0)
                    )
                  )
                  / (
                    coalesce(nullif(p.elem->>'qty', '')::numeric, 0)
                    * coalesce(nullif(p.elem->>'avg', '')::numeric, 0)
                  )
                ) * 100
                else nullif(p.elem->>'pnlPct', '')::numeric
              end
          )
        else p.elem
      end as elem
    from priced p
  )
  select coalesce(
    jsonb_agg(r.elem order by r.ord),
    '[]'::jsonb
  )
  from recomputed r;
$$;

revoke all on function public.enrich_portfolio_holdings(jsonb) from public, anon;
grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;

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
  ),
  with_prior as (
    select
      p.query_key,
      p.asset_type,
      p.asset_key,
      p.name,
      p.price,
      p.change_pct,
      p.previous_close,
      p.as_of_date,
      p.price_source,
      p.synced_at,
      p.exchange,
      p.exchange_symbol,
      p.isin,
      p.logo_url,
      p.logo_icon_url,
      p.nav,
      pr.as_of_date as previous_as_of_date,
      coalesce(pr.close_price, p.previous_close) as previous_nav,
      coalesce(
        pr.change_pct,
        case
          when pr.previous_close is not null and pr.previous_close <> 0
          then ((pr.close_price - pr.previous_close) / pr.previous_close) * 100
          else null
        end
      ) as previous_change_pct
    from picked p
    left join lateral (
      select h.as_of_date, h.close_price, h.previous_close, h.change_pct
      from public.social_market_price_history h
      where h.asset_type = p.asset_type
        and h.asset_key = p.asset_key
        and p.as_of_date is not null
        and h.as_of_date < p.as_of_date
      order by h.as_of_date desc
      limit 1
    ) pr on true
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from with_prior t;

  return coalesce(result, '[]'::json);
end;
$function$;

revoke all on function public.lookup_social_market_assets_batch(text[]) from public;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
