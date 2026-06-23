-- Enhanced instrument price history for us_close / overnight schedules.

-- ---------------------------------------------------------------------------
-- Extend current + history tables with quote metadata
-- ---------------------------------------------------------------------------

alter table public.instrument_prices
  add column if not exists exchange_id text,
  add column if not exists yahoo_symbol text,
  add column if not exists ibkr_reference_price numeric(18, 6),
  add column if not exists quote_confidence text
    check (quote_confidence in ('high', 'low', 'rejected'));

alter table public.instrument_price_history
  add column if not exists exchange_id text,
  add column if not exists yahoo_symbol text,
  add column if not exists ibkr_reference_price numeric(18, 6),
  add column if not exists quote_confidence text
    check (quote_confidence in ('high', 'low', 'rejected'));

create index if not exists instrument_price_history_conid_slot_idx
  on public.instrument_price_history (conid, fetch_slot, fetched_at desc);

create unique index if not exists instrument_price_history_slot_point_idx
  on public.instrument_price_history (conid, fetch_slot, fetched_at);

-- ---------------------------------------------------------------------------
-- Batch metadata for scheduled universe fetches
-- ---------------------------------------------------------------------------

create table if not exists public.universe_price_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  fetch_slot text not null check (fetch_slot in ('us_close', 'overnight')),
  fetched_at timestamptz not null,
  universe_size integer not null default 0,
  ibkr_priced integer not null default 0,
  yahoo_priced integer not null default 0,
  finra_priced integer not null default 0,
  missing integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists universe_price_fetch_runs_slot_fetched_idx
  on public.universe_price_fetch_runs (fetch_slot, fetched_at desc);

alter table public.universe_price_fetch_runs enable row level security;

create policy "universe_price_fetch_runs_select_public"
  on public.universe_price_fetch_runs for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RPC: all IBKR universe conids (for scheduled full-universe price fetch)
-- ---------------------------------------------------------------------------

create or replace function public.list_universe_conids_for_price_fetch()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(json_agg(conid order by conid), '[]'::json)
  from public.ibkr_instruments;
$$;

-- ---------------------------------------------------------------------------
-- RPC: price history for a conid (both schedules)
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
        'source', h.source,
        'fetch_slot', h.fetch_slot,
        'fetched_at', h.fetched_at,
        'yahoo_symbol', h.yahoo_symbol,
        'exchange_id', h.exchange_id,
        'quote_confidence', h.quote_confidence
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

revoke all on function public.list_universe_conids_for_price_fetch() from public;
grant execute on function public.list_universe_conids_for_price_fetch() to service_role;

revoke all on function public.get_instrument_price_history(bigint, integer) from public;
grant execute on function public.get_instrument_price_history(bigint, integer) to anon, authenticated, service_role;
