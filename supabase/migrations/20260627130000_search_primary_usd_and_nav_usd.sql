-- Prefer primary + USD listings in search; compute constituent drift in USD.

drop function if exists public.search_ibkr_instruments(text, integer);

create or replace function public.search_ibkr_instruments(
  p_query text,
  p_limit integer default 20
)
returns table (
  conid bigint,
  symbol text,
  name text,
  exchange_id text,
  currency text,
  country text,
  is_prime boolean,
  instrument_type text,
  isin text,
  local_symbol text,
  ucits boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      trim(upper(coalesce(p_query, ''))) as term,
      greatest(1, least(coalesce(p_limit, 20), 50)) as lim
  )
  select
    i.conid,
    i.symbol,
    i.name,
    i.exchange_id,
    i.currency,
    i.country,
    i.is_prime,
    i.instrument_type,
    i.isin,
    i.local_symbol,
    i.ucits
  from public.ibkr_instruments i, q
  where length(q.term) >= 1
    and (
      i.symbol ilike q.term || '%'
      or i.name ilike '%' || q.term || '%'
      or coalesce(i.local_symbol, '') ilike q.term || '%'
      or coalesce(i.isin, '') ilike q.term || '%'
    )
  order by
    case
      when i.symbol = q.term then 0
      when i.symbol ilike q.term || '%' then 1
      when coalesce(i.local_symbol, '') ilike q.term || '%' then 2
      else 3
    end,
    case
      when i.is_prime and i.currency = 'USD' then 0
      when i.is_prime then 1
      when i.currency = 'USD' then 2
      when i.country = 'US' then 3
      else 4
    end,
    case when i.instrument_type = 'STK' then 0 when i.instrument_type = 'ETF' then 1 else 2 end,
    i.symbol,
    i.exchange_id
  limit (select lim from q);
$$;

revoke all on function public.search_ibkr_instruments(text, integer) from public;
grant execute on function public.search_ibkr_instruments(text, integer) to anon, authenticated;

-- Drift weights using USD-normalized prices when available.

create or replace function public.get_basket_constituent_weights(p_basket_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  state_row public.basket_nav_state;
  version_row public.basket_versions;
  result json;
begin
  select s.* into state_row
  from public.basket_nav_state s
  join public.baskets b on b.id = s.basket_id
  where s.basket_id = p_basket_id and not b.is_deleted;

  if not found then
    return '[]'::json;
  end if;

  select v.* into version_row
  from public.basket_versions v
  join public.baskets b on b.id = v.basket_id
  where v.basket_id = p_basket_id
    and v.version_number = b.current_version
    and not b.is_deleted;

  if not found then
    return '[]'::json;
  end if;

  if state_row.is_activated and state_row.last_fetch_at is not null then
    with base as (
      select
        (c->>'conid')::bigint as conid,
        coalesce((c->>'symbol')::text, c->>'conid') as symbol,
        coalesce((c->>'name')::text, '') as name,
        coalesce((c->>'weight')::numeric, 0) as base_weight
      from jsonb_array_elements(state_row.return_constituents) as c
      where (c->>'conid') is not null
    ),
    target as (
      select
        (c->>'conid')::bigint as conid,
        coalesce((c->>'symbol')::text, c->>'conid') as symbol,
        coalesce((c->>'name')::text, '') as name,
        coalesce((c->>'weight')::numeric, 0) as target_weight
      from jsonb_array_elements(version_row.constituents) as c
      where (c->>'conid') is not null
    ),
    merged as (
      select
        coalesce(t.conid, b.conid) as conid,
        coalesce(t.symbol, b.symbol) as symbol,
        coalesce(nullif(t.name, ''), b.name) as name,
        coalesce(t.target_weight, b.base_weight) as target_weight,
        b.base_weight,
        coalesce(
          p_now.price_usd,
          case when p_now.currency = 'USD' then p_now.price else null end,
          case
            when p_now.price > 0 and fx_now.rate_to_usd is not null then p_now.price * fx_now.rate_to_usd
            else null
          end,
          0
        ) as price_now,
        coalesce(
          p_then.price_usd,
          case when p_then.currency = 'USD' then p_then.price else null end,
          case
            when p_then.price > 0 and fx_then.rate_to_usd is not null then p_then.price * fx_then.rate_to_usd
            else null
          end,
          0
        ) as price_then
      from target t
      full outer join base b on b.conid = t.conid
      left join public.instrument_prices p_now on p_now.conid = coalesce(t.conid, b.conid)
      left join public.fx_rates_to_usd fx_now on fx_now.currency = p_now.currency
      left join public.instrument_price_history p_then
        on p_then.conid = coalesce(t.conid, b.conid)
        and p_then.fetched_at = state_row.last_fetch_at
      left join public.fx_rates_to_usd fx_then on fx_then.currency = p_then.currency
    ),
    valued as (
      select
        *,
        case
          when base_weight > 0 and price_then > 0 and price_now > 0
            then base_weight * (price_now / price_then)
          when target_weight > 0 then target_weight
          else 0
        end as drift_value
      from merged
    ),
    normalized as (
      select
        conid,
        symbol,
        name,
        target_weight,
        drift_value,
        sum(drift_value) over () as total_drift
      from valued
    )
    select coalesce(
      json_agg(
        json_build_object(
          'conid', conid,
          'symbol', symbol,
          'name', name,
          'target_weight', round(target_weight::numeric, 2),
          'current_weight', case
            when total_drift > 0 then round((drift_value / total_drift * 100)::numeric, 2)
            else round(target_weight::numeric, 2)
          end
        )
        order by symbol
      ),
      '[]'::json
    )
    into result
    from normalized;
  else
    select coalesce(
      json_agg(
        json_build_object(
          'conid', (c->>'conid')::bigint,
          'symbol', coalesce(c->>'symbol', c->>'conid'),
          'name', coalesce(c->>'name', ''),
          'target_weight', round(coalesce((c->>'weight')::numeric, 0), 2),
          'current_weight', round(coalesce((c->>'weight')::numeric, 0), 2)
        )
        order by coalesce(c->>'symbol', c->>'conid')
      ),
      '[]'::json
    )
    into result
    from jsonb_array_elements(version_row.constituents) as c
    where (c->>'conid') is not null;
  end if;

  return result;
end;
$$;
