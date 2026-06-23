-- Per-ticker IBKR preflight ladder outcomes for scheduled universe fetches.

create table if not exists public.ibkr_fetch_ladder_results (
  id bigserial primary key,
  run_id uuid not null references public.universe_price_fetch_runs (id) on delete cascade,
  conid bigint not null,
  symbol text,
  exchange_id text,
  success_step smallint check (success_step between 1 and 4),
  success_step_label text,
  last_price numeric(18, 6),
  last_raw text,
  created_at timestamptz not null default now(),
  unique (run_id, conid)
);

create index if not exists ibkr_fetch_ladder_results_run_idx
  on public.ibkr_fetch_ladder_results (run_id);

create index if not exists ibkr_fetch_ladder_results_step_idx
  on public.ibkr_fetch_ladder_results (success_step)
  where success_step is not null;

alter table public.ibkr_fetch_ladder_results enable row level security;

create policy "ibkr_fetch_ladder_results_select_public"
  on public.ibkr_fetch_ladder_results for select
  to anon, authenticated
  using (true);

comment on table public.ibkr_fetch_ladder_results is
  'Which of the 4 IBKR preflight ladder steps priced each conid for a universe fetch run.';

comment on column public.ibkr_fetch_ladder_results.success_step is
  '1=no_preflight_initial, 2=no_preflight_retry, 3=preflight_1, 4=preflight_2';
