-- Include logo URLs when enriching portfolio holdings for UI AssetLogo.

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
  )
  select coalesce(
    jsonb_agg(
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
          'isin', coalesce(m.isin, nullif(k.elem->>'isin', '')),
          'logoUrl', m.logo_url,
          'logoIconUrl', m.logo_icon_url
        )
      end
      order by k.ord
    ),
    '[]'::jsonb
  )
  from keyed k
  left join matched m on m.ord = k.ord;
$$;

grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;
