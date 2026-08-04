-- Restore logos + live reprice on enrich_portfolio_holdings, and keep asOfDate/navDate.
-- The prior asOfDate-only migration accidentally dropped logo URLs and qty×price reprice,
-- which forced a full client market batch on every Portfolio open.

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
    left join matched m on m.ord = k.ord
  ),
  -- Recompute economics from live price when qty is present (live books).
  -- Do not overwrite weightPct — watchlists keep declared weights.
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
