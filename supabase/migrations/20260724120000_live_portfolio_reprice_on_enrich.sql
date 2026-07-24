-- Live portfolios: reprice value/pnl from market prices on enrich/read.
-- Watchlists keep declared weightPct (allocation is not market-driven).

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
          'isin', coalesce(m.isin, nullif(k.elem->>'isin', '')),
          'logoUrl', m.logo_url,
          'logoIconUrl', m.logo_icon_url
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

create or replace function public.portfolio_total_return_pct(p_holdings jsonb)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with enriched as (
    select value as h
    from jsonb_array_elements(public.enrich_portfolio_holdings(coalesce(p_holdings, '[]'::jsonb)))
  ),
  sums as (
    select
      coalesce(sum(
        coalesce(nullif(h->>'qty', '')::numeric, 0)
        * coalesce(nullif(h->>'avg', '')::numeric, 0)
      ), 0) as cost,
      coalesce(sum(
        coalesce(nullif(h->>'qty', '')::numeric, 0)
        * coalesce(
            nullif(h->>'price', '')::numeric,
            nullif(h->>'avg', '')::numeric,
            0
          )
      ), 0) as market_value
    from enriched
  )
  select case
    when cost > 0 then ((market_value - cost) / cost) * 100
    else null
  end
  from sums;
$$;

create or replace function public.redact_holdings_for_public(
  p_holdings jsonb,
  p_kind text default 'live'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  enriched jsonb := public.enrich_portfolio_holdings(coalesce(p_holdings, '[]'::jsonb));
  total_value numeric := 0;
  h jsonb;
  qty numeric;
  price numeric;
  avg_px numeric;
  val numeric;
  weight numeric;
  live_pnl_pct numeric;
  out_arr jsonb := '[]'::jsonb;
  is_watchlist boolean := lower(coalesce(p_kind, 'live')) = 'watchlist';
begin
  for h in select value from jsonb_array_elements(enriched)
  loop
    qty := coalesce(nullif(h->>'qty', '')::numeric, 0);
    price := coalesce(
      nullif(h->>'price', '')::numeric,
      nullif(h->>'avg', '')::numeric,
      0
    );
    val := qty * price;
    if val > 0 then
      total_value := total_value + val;
    end if;
  end loop;

  for h in select value from jsonb_array_elements(enriched)
  loop
    qty := coalesce(nullif(h->>'qty', '')::numeric, 0);
    avg_px := coalesce(nullif(h->>'avg', '')::numeric, 0);
    price := coalesce(
      nullif(h->>'price', '')::numeric,
      avg_px,
      0
    );
    val := qty * price;

    if is_watchlist then
      weight := coalesce(
        nullif(h->>'weightPct', '')::numeric,
        nullif(h->>'weight', '')::numeric,
        case when total_value > 0 and val > 0 then (val / total_value) * 100 else null end
      );
    else
      weight := case
        when total_value > 0 and val > 0 then (val / total_value) * 100
        else coalesce(
          nullif(h->>'weightPct', '')::numeric,
          nullif(h->>'weight', '')::numeric
        )
      end;
    end if;

    if qty > 0 and avg_px > 0 then
      live_pnl_pct := ((price - avg_px) / avg_px) * 100;
    else
      live_pnl_pct := coalesce(
        nullif(h->>'pnlPct', '')::numeric,
        nullif(h->>'pnl_pct', '')::numeric
      );
    end if;

    if coalesce(nullif(trim(h->>'ticker'), ''), nullif(trim(h->>'symbol'), '')) is null then
      continue;
    end if;

    out_arr := out_arr || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'ticker', coalesce(nullif(trim(h->>'ticker'), ''), nullif(trim(h->>'symbol'), '')),
          'symbol', nullif(trim(h->>'symbol'), ''),
          'assetName', coalesce(nullif(h->>'assetName', ''), nullif(h->>'name', '')),
          'assetType', nullif(h->>'assetType', ''),
          'isin', nullif(h->>'isin', ''),
          'logoUrl', nullif(h->>'logoUrl', ''),
          'logoIconUrl', nullif(h->>'logoIconUrl', ''),
          'logo_url', nullif(h->>'logo_url', ''),
          'logo_icon_url', nullif(h->>'logo_icon_url', ''),
          'weightPct', weight,
          'pnlPct', live_pnl_pct,
          'changePct', coalesce(
            nullif(h->>'changePct', '')::numeric,
            nullif(h->>'change_pct', '')::numeric
          )
        )
      )
    );
  end loop;

  return out_arr;
end;
$$;

-- Keep legacy 1-arg callers on live-default behavior.
create or replace function public.redact_holdings_for_public(p_holdings jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.redact_holdings_for_public(p_holdings, 'live'::text);
$$;

-- Prefer 2-arg redaction with portfolio kind.
create or replace function public.map_social_portfolio_row_public(p public.social_portfolios)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', p.id,
    'owner_id', p.owner_id,
    'kind', p.kind,
    'name', p.name,
    'objective', p.objective,
    'thesis', p.thesis,
    'is_draft', p.is_draft,
    'is_archived', p.is_archived,
    'source_portfolio_id', p.source_portfolio_id,
    'source_user_id', p.source_user_id,
    'source_portfolio_name', p.source_portfolio_name,
    'source_user_name', p.source_user_name,
    'tickers', p.tickers,
    'holdings', public.redact_holdings_for_public(p.holdings, p.kind),
    'total_return_pct', public.portfolio_total_return_pct(p.holdings),
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

create or replace function public.materialize_holdings_from_public(
  p_holdings jsonb,
  p_notional numeric default 100000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  redacted jsonb := public.redact_holdings_for_public(p_holdings, 'live');
  h jsonb;
  weight numeric;
  price numeric;
  qty numeric;
  avg_px numeric;
  out_arr jsonb := '[]'::jsonb;
  notional numeric := greatest(coalesce(p_notional, 100000), 1);
begin
  for h in select value from jsonb_array_elements(redacted)
  loop
    weight := coalesce(nullif(h->>'weightPct', '')::numeric, 0);
    if weight <= 0 then
      continue;
    end if;

    select a.price into price
    from public.social_market_assets a
    where (
      (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = upper(h->>'ticker'))
      or (a.asset_type = 'fund' and a.asset_key = h->>'ticker')
    )
    order by
      case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        else 3
      end
    limit 1;

    avg_px := coalesce(nullif(price, 0), 1);
    qty := (notional * (weight / 100.0)) / avg_px;

    out_arr := out_arr || jsonb_build_array(
      h || jsonb_build_object(
        'qty', qty,
        'avg', avg_px,
        'price', avg_px,
        'value', qty * avg_px,
        'invested', qty * avg_px,
        'weightPct', weight
      )
    );
  end loop;

  return public.enrich_portfolio_holdings(out_arr);
end;
$$;

revoke all on function public.enrich_portfolio_holdings(jsonb) from public, anon;
grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;

revoke all on function public.portfolio_total_return_pct(jsonb) from public, anon, authenticated;
revoke all on function public.redact_holdings_for_public(jsonb) from public, anon, authenticated;
revoke all on function public.redact_holdings_for_public(jsonb, text) from public, anon, authenticated;
