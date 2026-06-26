-- FX rates table + USD-normalized instrument prices for multi-currency basket NAV.

-- ---------------------------------------------------------------------------
-- FX rates (1 unit of currency → USD)
-- ---------------------------------------------------------------------------

create table if not exists public.fx_rates_to_usd (
  currency text primary key,
  rate_to_usd numeric(18, 8) not null check (rate_to_usd > 0),
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now()
);

create index if not exists fx_rates_to_usd_fetched_idx
  on public.fx_rates_to_usd (fetched_at desc);

alter table public.fx_rates_to_usd enable row level security;

create policy "fx_rates_to_usd_select_public"
  on public.fx_rates_to_usd for select
  to anon, authenticated
  using (true);

insert into public.fx_rates_to_usd (currency, rate_to_usd, source, fetched_at)
values ('USD', 1, 'static', now())
on conflict (currency) do nothing;

-- ---------------------------------------------------------------------------
-- USD-normalized prices
-- ---------------------------------------------------------------------------

alter table public.instrument_prices
  add column if not exists price_usd numeric(18, 6) check (price_usd is null or price_usd > 0),
  add column if not exists fx_rate_to_usd numeric(18, 8);

alter table public.instrument_price_history
  add column if not exists price_usd numeric(18, 6) check (price_usd is null or price_usd > 0),
  add column if not exists fx_rate_to_usd numeric(18, 8);

-- Backfill USD rows where local currency is already USD
update public.instrument_prices
set
  price_usd = price,
  fx_rate_to_usd = 1
where currency = 'USD'
  and price_usd is null
  and price > 0;

update public.instrument_price_history
set
  price_usd = price,
  fx_rate_to_usd = 1
where currency = 'USD'
  and price_usd is null
  and price > 0;

-- ---------------------------------------------------------------------------
-- RPC: latest FX rates as JSON object
-- ---------------------------------------------------------------------------

create or replace function public.get_fx_rates_to_usd()
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
  from public.fx_rates_to_usd;
$$;

revoke all on function public.get_fx_rates_to_usd() from public;
grant execute on function public.get_fx_rates_to_usd() to anon, authenticated, service_role;
