-- TradingView analyst consensus + target prices for listed equities
create table if not exists public.tradingview_analyst_consensus (
  asset_key text primary key,
  tv_symbol text not null,
  exchange text not null default 'NSE',
  name text,
  last_price numeric,
  currency text not null default 'INR',
  target_price_avg numeric,
  target_price_high numeric,
  target_price_low numeric,
  recommendation_buy integer,
  recommendation_hold integer,
  recommendation_sell integer,
  analyst_count integer,
  recommend_technical numeric,
  sync_status text not null default 'ok',
  error_message text,
  raw jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists tradingview_analyst_consensus_synced_at_idx
  on public.tradingview_analyst_consensus (synced_at desc);

create index if not exists tradingview_analyst_consensus_status_idx
  on public.tradingview_analyst_consensus (sync_status);

alter table public.tradingview_analyst_consensus enable row level security;

drop policy if exists tradingview_analyst_consensus_select_authenticated
  on public.tradingview_analyst_consensus;
create policy tradingview_analyst_consensus_select_authenticated
  on public.tradingview_analyst_consensus
  for select
  to authenticated
  using (true);

drop policy if exists tradingview_analyst_consensus_select_anon
  on public.tradingview_analyst_consensus;
create policy tradingview_analyst_consensus_select_anon
  on public.tradingview_analyst_consensus
  for select
  to anon
  using (true);

grant select on public.tradingview_analyst_consensus to anon, authenticated;
grant all on public.tradingview_analyst_consensus to service_role;

comment on table public.tradingview_analyst_consensus is
  'TradingView analyst Buy/Hold/Sell counts and 1Y avg/high/low price targets by asset_key.';
