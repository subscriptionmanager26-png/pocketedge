-- Apply to the stock-news Supabase project (imrcllmpldvjoyjyluhr).
-- One current explanation is retained for each ticker and trading day.

create table if not exists public.mn_daily_stock_explanations (
  ticker text not null,
  as_of_date date not null,
  status text not null check (status in ('generated', 'no_recent_news', 'failed')),
  explanation text not null,
  confidence text check (confidence in ('High', 'Medium', 'Low')),
  price_context jsonb not null default '[]'::jsonb,
  news_context jsonb not null default '[]'::jsonb,
  model text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticker, as_of_date)
);

create index if not exists mn_daily_stock_explanations_ticker_date_idx
  on public.mn_daily_stock_explanations (ticker, as_of_date desc);

alter table public.mn_daily_stock_explanations enable row level security;

create policy "mn_daily_stock_explanations_select_public"
  on public.mn_daily_stock_explanations for select
  to anon, authenticated
  using (true);

grant select on public.mn_daily_stock_explanations to anon, authenticated;
