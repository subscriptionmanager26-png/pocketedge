-- Universe price fetch scheduling: enhanced history, ladder tracking, Yahoo mappings.

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

alter table public.universe_price_fetch_runs
  add column if not exists status text not null default 'completed'
    check (status in ('running', 'completed', 'failed')),
  add column if not exists chunk_offset integer not null default 0,
  add column if not exists chunk_size integer,
  add column if not exists processed_count integer not null default 0,
  add column if not exists ibkr_step_1 integer not null default 0,
  add column if not exists ibkr_step_2 integer not null default 0,
  add column if not exists ibkr_step_3 integer not null default 0,
  add column if not exists ibkr_step_4 integer not null default 0,
  add column if not exists yahoo_backup integer not null default 0,
  add column if not exists runtime text,
  add column if not exists error_message text;

create index if not exists universe_price_fetch_runs_slot_fetched_idx
  on public.universe_price_fetch_runs (fetch_slot, fetched_at desc);

create index if not exists universe_price_fetch_runs_status_idx
  on public.universe_price_fetch_runs (status, fetch_slot)
  where status = 'running';

alter table public.universe_price_fetch_runs enable row level security;

drop policy if exists "universe_price_fetch_runs_select_public" on public.universe_price_fetch_runs;
create policy "universe_price_fetch_runs_select_public"
  on public.universe_price_fetch_runs for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Per-ticker ladder outcomes (IBKR steps 1-4, Yahoo backup = step 5)
-- ---------------------------------------------------------------------------

create table if not exists public.ibkr_fetch_ladder_results (
  id bigserial primary key,
  run_id uuid not null references public.universe_price_fetch_runs (id) on delete cascade,
  conid bigint not null,
  symbol text,
  exchange_id text,
  success_step smallint check (success_step between 1 and 5),
  success_step_label text,
  last_price numeric(18, 6),
  last_raw text,
  price_source text,
  created_at timestamptz not null default now(),
  unique (run_id, conid)
);

create index if not exists ibkr_fetch_ladder_results_run_idx
  on public.ibkr_fetch_ladder_results (run_id);

create index if not exists ibkr_fetch_ladder_results_step_idx
  on public.ibkr_fetch_ladder_results (success_step)
  where success_step is not null;

alter table public.ibkr_fetch_ladder_results enable row level security;

drop policy if exists "ibkr_fetch_ladder_results_select_public" on public.ibkr_fetch_ladder_results;
create policy "ibkr_fetch_ladder_results_select_public"
  on public.ibkr_fetch_ladder_results for select
  to anon, authenticated
  using (true);

comment on column public.ibkr_fetch_ladder_results.success_step is
  '1=no_preflight_initial, 2=no_preflight_retry, 3=preflight_1, 4=preflight_2, 5=yahoo_backup';

-- ---------------------------------------------------------------------------
-- Yahoo symbol mappings (synced from local mapping.json for server-side backup)
-- ---------------------------------------------------------------------------

create table if not exists public.instrument_yahoo_mappings (
  conid bigint primary key references public.ibkr_instruments (conid) on delete cascade,
  yahoo_symbol text not null,
  exchange_id text,
  currency text,
  status text not null default 'mapped',
  updated_at timestamptz not null default now()
);

create index if not exists instrument_yahoo_mappings_symbol_idx
  on public.instrument_yahoo_mappings (yahoo_symbol);

alter table public.instrument_yahoo_mappings enable row level security;

create policy "instrument_yahoo_mappings_select_public"
  on public.instrument_yahoo_mappings for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- RPCs for scheduled fetch
-- ---------------------------------------------------------------------------

create or replace function public.count_universe_instruments_for_price_fetch()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.ibkr_instruments;
$$;

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

create or replace function public.list_universe_instruments_for_price_fetch(
  p_offset integer default 0,
  p_limit integer default 2000
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
        'conid', s.conid,
        'symbol', s.symbol,
        'exchange_id', s.exchange_id,
        'currency', s.currency,
        'isin', s.isin,
        'instrument_type', s.instrument_type,
        'yahoo_symbol', s.yahoo_symbol
      )
      order by s.conid
    ),
    '[]'::json
  )
  from (
    select
      i.conid,
      i.symbol,
      i.exchange_id,
      i.currency,
      i.isin,
      i.instrument_type,
      m.yahoo_symbol
    from public.ibkr_instruments i
    left join public.instrument_yahoo_mappings m on m.conid = i.conid
    order by i.conid
    offset greatest(p_offset, 0)
    limit greatest(p_limit, 1)
  ) s;
$$;

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

revoke all on function public.count_universe_instruments_for_price_fetch() from public;
grant execute on function public.count_universe_instruments_for_price_fetch() to service_role;

revoke all on function public.list_universe_conids_for_price_fetch() from public;
grant execute on function public.list_universe_conids_for_price_fetch() to service_role;

revoke all on function public.list_universe_instruments_for_price_fetch(integer, integer) from public;
grant execute on function public.list_universe_instruments_for_price_fetch(integer, integer) to service_role;

revoke all on function public.get_instrument_price_history(bigint, integer) from public;
grant execute on function public.get_instrument_price_history(bigint, integer) to anon, authenticated, service_role;
