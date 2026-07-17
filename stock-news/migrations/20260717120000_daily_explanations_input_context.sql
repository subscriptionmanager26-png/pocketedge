alter table public.mn_daily_stock_explanations
  add column if not exists input_context jsonb not null default '{}'::jsonb;
