-- Slim instrument_price_history + FX rate history for NAV backfill.
-- NAV uses live fx_rates_to_usd for current boundary and fx_rates_history for prior boundary.

-- ---------------------------------------------------------------------------
-- Historical FX snapshots (one row per currency per fetch timestamp)
-- ---------------------------------------------------------------------------

create table if not exists public.fx_rates_history (
  id bigserial primary key,
  currency text not null,
  rate_to_usd numeric(18, 8) not null check (rate_to_usd > 0),
  source text not null default 'yahoo',
  fetched_at timestamptz not null
);

create unique index if not exists fx_rates_history_currency_fetched_idx
  on public.fx_rates_history (currency, fetched_at);

create index if not exists fx_rates_history_fetched_idx
  on public.fx_rates_history (fetched_at desc);

alter table public.fx_rates_history enable row level security;

drop policy if exists "fx_rates_history_select_public" on public.fx_rates_history;
create policy "fx_rates_history_select_public"
  on public.fx_rates_history for select
  to anon, authenticated
  using (true);

comment on table public.fx_rates_history is
  'Point-in-time FX rates captured at each price fetch. Used for NAV backfill at historical boundaries.';

-- Seed history from current live rates (best-effort backfill for existing NAV state).
insert into public.fx_rates_history (currency, rate_to_usd, source, fetched_at)
select currency, rate_to_usd, source, fetched_at
from public.fx_rates_to_usd
on conflict (currency, fetched_at) do nothing;

-- ---------------------------------------------------------------------------
-- Slim instrument_price_history (NAV boundary prices only)
-- ---------------------------------------------------------------------------

update public.instrument_price_history
set fx_rate_to_usd = 1
where upper(coalesce(currency, 'USD')) = 'USD'
  and fx_rate_to_usd is null
  and price > 0;

alter table public.instrument_price_history
  drop column if exists source,
  drop column if exists exchange_id,
  drop column if exists yahoo_symbol,
  drop column if exists ibkr_reference_price,
  drop column if exists quote_confidence,
  drop column if exists price_usd;

-- ---------------------------------------------------------------------------
-- RPC: FX rates effective at a historical timestamp
-- ---------------------------------------------------------------------------

create or replace function public.get_fx_rates_at_timestamp(p_fetched_at timestamptz)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    json_object_agg(currency, rate_to_usd),
    '{"USD": 1}'::json
  )
  from (
    select distinct on (currency)
      currency,
      rate_to_usd
    from public.fx_rates_history
    where fetched_at <= p_fetched_at
    order by currency, fetched_at desc
  ) s;
$$;

revoke all on function public.get_fx_rates_at_timestamp(timestamptz) from public;
grant execute on function public.get_fx_rates_at_timestamp(timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: slim price history for a conid
-- ---------------------------------------------------------------------------

create or replace function public.get_instrument_price_history(
  p_conid bigint,
  p_limit integer default 120
)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'price', h.price,
        'currency', h.currency,
        'fx_rate_to_usd', h.fx_rate_to_usd,
        'fetch_slot', h.fetch_slot,
        'fetched_at', h.fetched_at
      )
      order by h.fetched_at desc
    ),
    '[]'::json
  )
  from (
    select *
    from public.instrument_price_history
    where conid = p_conid
    order by fetched_at desc
    limit greatest(p_limit, 1)
  ) h;
$$;

-- ---------------------------------------------------------------------------
-- Basket constituent drift — live FX for current, historical FX for prior
-- ---------------------------------------------------------------------------

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
          case when p_now.currency = 'USD' then p_now.price else null end,
          case
            when p_now.price > 0 and fx_now.rate_to_usd is not null then p_now.price * fx_now.rate_to_usd
            else null
          end,
          0
        ) as price_now,
        coalesce(
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
      left join lateral (
        select distinct on (h.currency)
          h.currency,
          h.rate_to_usd
        from public.fx_rates_history h
        where h.fetched_at <= state_row.last_fetch_at
          and h.currency = p_then.currency
        order by h.currency, h.fetched_at desc
      ) fx_then on true
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
        order by c->>'symbol'
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

-- ---------------------------------------------------------------------------
-- Clear raw ladder rows (ticker summary table preserved)
-- ---------------------------------------------------------------------------

truncate table public.ibkr_fetch_ladder_results;
