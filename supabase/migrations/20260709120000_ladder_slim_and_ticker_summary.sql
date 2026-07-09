-- Slim ibkr_fetch_ladder_results + cumulative per-ticker summary table.
-- Raw ladder rows kept ~7 days; older rows roll into ibkr_fetch_ladder_ticker_summary.

-- Step labels (for analysis; not stored per row):
--   1 = no_preflight_initial
--   2 = no_preflight_retry
--   3 = preflight_1
--   4 = preflight_2
--   5 = yahoo_backup

-- ---------------------------------------------------------------------------
-- Per-ticker cumulative ladder stats (survives raw row purge)
-- ---------------------------------------------------------------------------

create table if not exists public.ibkr_fetch_ladder_ticker_summary (
  conid bigint primary key references public.ibkr_instruments (conid) on delete cascade,
  exchange_id text,
  total_runs bigint not null default 0,
  total_priced bigint not null default 0,
  step_1 bigint not null default 0,
  step_2 bigint not null default 0,
  step_3 bigint not null default 0,
  step_4 bigint not null default 0,
  step_5 bigint not null default 0,
  total_failures bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists ibkr_fetch_ladder_ticker_summary_exchange_idx
  on public.ibkr_fetch_ladder_ticker_summary (exchange_id);

comment on table public.ibkr_fetch_ladder_ticker_summary is
  'Cumulative ladder outcomes per conid. Updated when raw ladder rows older than retention are archived.';

comment on column public.ibkr_fetch_ladder_ticker_summary.total_runs is
  'Times this conid appeared in a universe fetch run (including failures).';

comment on column public.ibkr_fetch_ladder_ticker_summary.total_priced is
  'Times a price was obtained (success_step is not null).';

alter table public.ibkr_fetch_ladder_ticker_summary enable row level security;

drop policy if exists "ibkr_fetch_ladder_ticker_summary_select_public"
  on public.ibkr_fetch_ladder_ticker_summary;
create policy "ibkr_fetch_ladder_ticker_summary_select_public"
  on public.ibkr_fetch_ladder_ticker_summary for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Slim raw ladder table (drop redundant / derivable columns)
-- ---------------------------------------------------------------------------

alter table public.ibkr_fetch_ladder_results
  drop column if exists symbol,
  drop column if exists success_step_label,
  drop column if exists last_price,
  drop column if exists created_at;

-- ---------------------------------------------------------------------------
-- Archive raw ladder rows into ticker summary, then delete raw rows
-- ---------------------------------------------------------------------------

create or replace function public.archive_ibkr_fetch_ladder_results(
  p_retention_days integer default 7,
  p_dry_run boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz;
  v_rows bigint;
  v_tickers bigint;
  v_deleted bigint;
begin
  v_cutoff := now() - make_interval(days => greatest(p_retention_days, 1));

  select count(*), count(distinct l.conid)
  into v_rows, v_tickers
  from public.ibkr_fetch_ladder_results l
  join public.universe_price_fetch_runs r on r.id = l.run_id
  where r.fetched_at < v_cutoff;

  if v_rows = 0 then
    return json_build_object(
      'dry_run', p_dry_run,
      'cutoff', v_cutoff,
      'rows_to_archive', 0,
      'tickers_affected', 0,
      'deleted_rows', 0
    );
  end if;

  if p_dry_run then
    return json_build_object(
      'dry_run', true,
      'cutoff', v_cutoff,
      'rows_to_archive', v_rows,
      'tickers_affected', v_tickers,
      'deleted_rows', 0
    );
  end if;

  insert into public.ibkr_fetch_ladder_ticker_summary (
    conid,
    exchange_id,
    total_runs,
    total_priced,
    step_1,
    step_2,
    step_3,
    step_4,
    step_5,
    total_failures,
    updated_at
  )
  select
    l.conid,
    max(l.exchange_id),
    count(*)::bigint,
    count(*) filter (where l.success_step is not null)::bigint,
    count(*) filter (where l.success_step = 1)::bigint,
    count(*) filter (where l.success_step = 2)::bigint,
    count(*) filter (where l.success_step = 3)::bigint,
    count(*) filter (where l.success_step = 4)::bigint,
    count(*) filter (where l.success_step = 5)::bigint,
    count(*) filter (where l.success_step is null)::bigint,
    now()
  from public.ibkr_fetch_ladder_results l
  join public.universe_price_fetch_runs r on r.id = l.run_id
  where r.fetched_at < v_cutoff
  group by l.conid
  on conflict (conid) do update set
    exchange_id = coalesce(excluded.exchange_id, ibkr_fetch_ladder_ticker_summary.exchange_id),
    total_runs = ibkr_fetch_ladder_ticker_summary.total_runs + excluded.total_runs,
    total_priced = ibkr_fetch_ladder_ticker_summary.total_priced + excluded.total_priced,
    step_1 = ibkr_fetch_ladder_ticker_summary.step_1 + excluded.step_1,
    step_2 = ibkr_fetch_ladder_ticker_summary.step_2 + excluded.step_2,
    step_3 = ibkr_fetch_ladder_ticker_summary.step_3 + excluded.step_3,
    step_4 = ibkr_fetch_ladder_ticker_summary.step_4 + excluded.step_4,
    step_5 = ibkr_fetch_ladder_ticker_summary.step_5 + excluded.step_5,
    total_failures = ibkr_fetch_ladder_ticker_summary.total_failures + excluded.total_failures,
    updated_at = now();

  delete from public.ibkr_fetch_ladder_results l
  using public.universe_price_fetch_runs r
  where l.run_id = r.id
    and r.fetched_at < v_cutoff;

  get diagnostics v_deleted = row_count;

  return json_build_object(
    'dry_run', false,
    'cutoff', v_cutoff,
    'archived_rows', v_rows,
    'tickers_updated', v_tickers,
    'deleted_rows', v_deleted
  );
end;
$$;

revoke all on function public.archive_ibkr_fetch_ladder_results(integer, boolean) from public;
grant execute on function public.archive_ibkr_fetch_ladder_results(integer, boolean) to service_role;
