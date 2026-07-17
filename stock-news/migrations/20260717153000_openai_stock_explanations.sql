-- Apply to the stock-news Supabase project (imrcllmpldvjoyjyluhr).
-- Separate table for OpenAI-generated explanations so we can compare them
-- against the Mistral output stored in mn_daily_stock_explanations.

create table if not exists public.mn_daily_stock_explanations_openai (
  ticker text not null,
  as_of_date date not null,
  status text not null check (status in ('generated', 'no_recent_news', 'failed')),
  explanation text not null,
  confidence text check (confidence in ('High', 'Medium', 'Low')),
  price_context jsonb not null default '[]'::jsonb,
  news_context jsonb not null default '[]'::jsonb,
  input_context jsonb not null default '{}'::jsonb,
  model text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticker, as_of_date)
);

create index if not exists mn_daily_stock_explanations_openai_ticker_date_idx
  on public.mn_daily_stock_explanations_openai (ticker, as_of_date desc);

alter table public.mn_daily_stock_explanations_openai enable row level security;

create policy "mn_daily_stock_explanations_openai_select_public"
  on public.mn_daily_stock_explanations_openai for select
  to anon, authenticated
  using (true);

grant select on public.mn_daily_stock_explanations_openai to anon, authenticated;
