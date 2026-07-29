-- Preserve first-seen time for each (asset, NAV date) and record per-poll
-- AMFI date distributions so evening NAV arrival can be measured accurately.

-- ---------------------------------------------------------------------------
-- History: synced_at = first ingest; last_synced_at = most recent upsert
-- ---------------------------------------------------------------------------

alter table public.social_market_price_history
  add column if not exists last_synced_at timestamptz;

update public.social_market_price_history
set last_synced_at = coalesce(last_synced_at, synced_at)
where last_synced_at is null;

comment on column public.social_market_price_history.synced_at is
  'First time this (asset_type, asset_key, as_of_date) NAV/close was ingested.';
comment on column public.social_market_price_history.last_synced_at is
  'Most recent upsert of this history row (same-day AMFI re-polls).';

create or replace function public.bulk_upsert_social_market_price_history(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.social_market_price_history (
    asset_type, asset_key, as_of_date, close_price, previous_close, change_pct,
    source, synced_at, last_synced_at
  )
  select
    r.asset_type,
    r.asset_key,
    r.as_of_date::date,
    r.close_price,
    r.previous_close,
    r.change_pct,
    coalesce(nullif(trim(r.source), ''), 'unknown'),
    coalesce(r.synced_at::timestamptz, now()),
    coalesce(r.synced_at::timestamptz, now())
  from jsonb_to_recordset(p_rows) as r(
    asset_type text,
    asset_key text,
    as_of_date text,
    close_price numeric,
    previous_close numeric,
    change_pct numeric,
    source text,
    synced_at text
  )
  where r.as_of_date is not null
    and r.close_price is not null
  on conflict (asset_type, asset_key, as_of_date) do update set
    close_price = excluded.close_price,
    previous_close = coalesce(excluded.previous_close, public.social_market_price_history.previous_close),
    change_pct = coalesce(excluded.change_pct, public.social_market_price_history.change_pct),
    source = excluded.source,
    -- Keep the original first-seen timestamp.
    synced_at = public.social_market_price_history.synced_at,
    last_synced_at = excluded.last_synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.bulk_upsert_social_market_price_history(jsonb)
  from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_price_history(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Per-poll AMFI NAV arrival snapshots (queryable in SQL / GH logs)
-- ---------------------------------------------------------------------------

create table if not exists public.social_market_nav_ingest_runs (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  ist_date date not null,
  total_schemes integer not null default 0,
  today_nav_count integer not null default 0,
  new_date_advances integer not null default 0,
  date_counts jsonb not null default '{}'::jsonb,
  source text not null default 'amfi_navall',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists social_market_nav_ingest_runs_run_at_idx
  on public.social_market_nav_ingest_runs (run_at desc);

create index if not exists social_market_nav_ingest_runs_ist_date_idx
  on public.social_market_nav_ingest_runs (ist_date, run_at desc);

comment on table public.social_market_nav_ingest_runs is
  'One row per funds refresh: AMFI as_of_date distribution + how many schemes advanced to a new NAV date.';

alter table public.social_market_nav_ingest_runs enable row level security;

revoke all on table public.social_market_nav_ingest_runs from public, anon, authenticated;
grant select, insert on table public.social_market_nav_ingest_runs to service_role;
grant usage, select on sequence public.social_market_nav_ingest_runs_id_seq to service_role;
