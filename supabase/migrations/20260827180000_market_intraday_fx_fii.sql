-- Intraday index samples (NIFTY 50 @ 30s), USD/INR (fx), and FII/DII daily flows.

-- ---------------------------------------------------------------------------
-- FX asset type on live catalog
-- ---------------------------------------------------------------------------
alter table public.social_market_assets
  drop constraint if exists social_market_assets_asset_type_check;
alter table public.social_market_assets
  add constraint social_market_assets_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond', 'index', 'fx'));

-- ---------------------------------------------------------------------------
-- Intraday index samples (~30s) — retained ~1 day for post-market briefs
-- ---------------------------------------------------------------------------
create table if not exists public.social_market_index_intraday (
  asset_key text not null,
  session_date date not null,
  sampled_at timestamptz not null,
  price numeric not null,
  open numeric,
  high numeric,
  low numeric,
  previous_close numeric,
  change_pct numeric,
  source text not null default 'nse',
  primary key (asset_key, sampled_at)
);

create index if not exists social_market_index_intraday_session_idx
  on public.social_market_index_intraday (asset_key, session_date desc, sampled_at desc);

create index if not exists social_market_index_intraday_sampled_at_idx
  on public.social_market_index_intraday (sampled_at desc);

alter table public.social_market_index_intraday enable row level security;

drop policy if exists "social_market_index_intraday_select_authenticated"
  on public.social_market_index_intraday;
create policy "social_market_index_intraday_select_authenticated"
  on public.social_market_index_intraday for select
  to authenticated
  using (true);

grant select on public.social_market_index_intraday to authenticated;

create or replace function public.insert_social_market_index_intraday(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  insert into public.social_market_index_intraday (
    asset_key,
    session_date,
    sampled_at,
    price,
    open,
    high,
    low,
    previous_close,
    change_pct,
    source
  )
  select
    upper(trim(r.asset_key)),
    (r.session_date)::date,
    (r.sampled_at)::timestamptz,
    (r.price)::numeric,
    nullif(r.open, '')::numeric,
    nullif(r.high, '')::numeric,
    nullif(r.low, '')::numeric,
    nullif(r.previous_close, '')::numeric,
    nullif(r.change_pct, '')::numeric,
    coalesce(nullif(trim(r.source), ''), 'nse')
  from jsonb_to_recordset(p_rows) as r(
    asset_key text,
    session_date text,
    sampled_at text,
    price numeric,
    open numeric,
    high numeric,
    low numeric,
    previous_close numeric,
    change_pct numeric,
    source text
  )
  where trim(coalesce(r.asset_key, '')) <> ''
    and r.price is not null
    and r.sampled_at is not null
  on conflict (asset_key, sampled_at) do update set
    price = excluded.price,
    open = excluded.open,
    high = excluded.high,
    low = excluded.low,
    previous_close = excluded.previous_close,
    change_pct = excluded.change_pct,
    source = excluded.source;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.purge_social_market_index_intraday(
  p_asset_key text default null,
  p_older_than interval default interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer := 0;
begin
  delete from public.social_market_index_intraday
  where sampled_at < now() - coalesce(p_older_than, interval '1 day')
    and (p_asset_key is null or asset_key = upper(trim(p_asset_key)));
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

create or replace function public.get_social_market_index_intraday(
  p_asset_key text,
  p_session_date date default null,
  p_limit integer default 2000
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  key text := upper(trim(coalesce(p_asset_key, '')));
  session date := coalesce(p_session_date, (timezone('Asia/Kolkata', now()))::date);
  lim integer := greatest(1, least(coalesce(p_limit, 2000), 5000));
  result json;
begin
  if key = '' then
    return '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.sampled_at asc), '[]'::json)
  into result
  from (
    select
      i.asset_key,
      i.session_date,
      i.sampled_at,
      i.price,
      i.open,
      i.high,
      i.low,
      i.previous_close,
      i.change_pct,
      i.source
    from public.social_market_index_intraday i
    where i.asset_key = key
      and i.session_date = session
    order by i.sampled_at asc
    limit lim
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------------
-- FII / DII daily cash-market flows (NSE, ~4 PM IST)
-- ---------------------------------------------------------------------------
create table if not exists public.social_market_fii_dii (
  trade_date date not null,
  category text not null,
  buy_value_cr numeric not null,
  sell_value_cr numeric not null,
  net_value_cr numeric not null,
  source text not null default 'nse',
  synced_at timestamptz not null default now(),
  primary key (trade_date, category)
);

create index if not exists social_market_fii_dii_trade_date_idx
  on public.social_market_fii_dii (trade_date desc);

alter table public.social_market_fii_dii enable row level security;

drop policy if exists "social_market_fii_dii_select_authenticated"
  on public.social_market_fii_dii;
create policy "social_market_fii_dii_select_authenticated"
  on public.social_market_fii_dii for select
  to authenticated
  using (true);

grant select on public.social_market_fii_dii to authenticated;

create or replace function public.bulk_upsert_social_market_fii_dii(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  upserted integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  insert into public.social_market_fii_dii (
    trade_date,
    category,
    buy_value_cr,
    sell_value_cr,
    net_value_cr,
    source,
    synced_at
  )
  select
    to_date(r.trade_date, 'DD-Mon-YYYY'),
    trim(r.category),
    (r.buy_value_cr)::numeric,
    (r.sell_value_cr)::numeric,
    (r.net_value_cr)::numeric,
    coalesce(nullif(trim(r.source), ''), 'nse'),
    coalesce((r.synced_at)::timestamptz, now())
  from jsonb_to_recordset(p_rows) as r(
    trade_date text,
    category text,
    buy_value_cr numeric,
    sell_value_cr numeric,
    net_value_cr numeric,
    source text,
    synced_at text
  )
  where trim(coalesce(r.category, '')) <> ''
    and r.trade_date is not null
  on conflict (trade_date, category) do update set
    buy_value_cr = excluded.buy_value_cr,
    sell_value_cr = excluded.sell_value_cr,
    net_value_cr = excluded.net_value_cr,
    source = excluded.source,
    synced_at = excluded.synced_at;

  get diagnostics upserted = row_count;
  return upserted;
end;
$$;

create or replace function public.get_social_market_fii_dii(
  p_trade_date date default null,
  p_limit integer default 10
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 10), 60));
  result json;
begin
  if p_trade_date is not null then
    select coalesce(json_agg(row_to_json(t) order by t.category asc), '[]'::json)
    into result
    from (
      select *
      from public.social_market_fii_dii f
      where f.trade_date = p_trade_date
    ) t;
    return coalesce(result, '[]'::json);
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.trade_date desc, t.category asc), '[]'::json)
  into result
  from (
    select *
    from public.social_market_fii_dii f
    order by f.trade_date desc, f.category asc
    limit lim
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

revoke all on function public.insert_social_market_index_intraday(jsonb) from public;
revoke all on function public.purge_social_market_index_intraday(text, interval) from public;
revoke all on function public.bulk_upsert_social_market_fii_dii(jsonb) from public;
grant execute on function public.insert_social_market_index_intraday(jsonb) to service_role;
grant execute on function public.purge_social_market_index_intraday(text, interval) to service_role;
grant execute on function public.bulk_upsert_social_market_fii_dii(jsonb) to service_role;
grant execute on function public.get_social_market_index_intraday(text, date, integer) to authenticated;
grant execute on function public.get_social_market_fii_dii(date, integer) to authenticated;

-- Extend batch lookup to include fx
create or replace function public.lookup_social_market_assets_batch(p_keys text[])
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if p_keys is null or cardinality(p_keys) = 0 then
    return '[]'::json;
  end if;

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond', 'index', 'fx')
    group by asset_type
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select distinct on (norm_key)
      norm_key as query_key,
      a.asset_type, a.asset_key, a.name, a.price, a.change_pct, a.previous_close,
      a.as_of_date, a.price_source, a.synced_at, a.exchange, a.exchange_symbol,
      coalesce(a.isin, a.mapped_isin) as isin
    from (
      select trim(k) as raw_key, upper(trim(k)) as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*, i.isin as mapped_isin
      from public.social_market_assets a
      left join latest_dates d on d.asset_type = a.asset_type
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where (
          a.asset_type in ('fund', 'fx')
          or a.as_of_date = d.as_of_date
        )
        and (
          (a.asset_type in ('stock', 'etf', 'commodity', 'bond', 'index', 'fx') and a.asset_key = keys.norm_key)
          or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
          or i.isin = keys.norm_key
        )
      order by case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        when 'bond' then 3
        when 'index' then 4
        when 'fx' then 5
        else 6
      end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------------
-- FII/DII cron (~4 PM IST with retries)
-- ---------------------------------------------------------------------------
insert into public.social_market_job_config (job_name, auth_token)
values ('refresh-fii-dii', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

do $$
declare
  fii_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-fii-dii';
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-fii-dii-1600',
    'social-fii-dii-1615',
    'social-fii-dii-1630',
    'social-fii-dii-1645'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- 16:00 / 16:15 / 16:30 / 16:45 IST Mon–Fri = 10:30–11:15 UTC
  perform cron.schedule(
    'social-fii-dii-1600',
    '30 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fii-dii-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fii-dii')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cmd$,
      fii_url
    )
  );

  perform cron.schedule(
    'social-fii-dii-1615',
    '45 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fii-dii-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fii-dii')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cmd$,
      fii_url
    )
  );

  perform cron.schedule(
    'social-fii-dii-1630',
    '0 11 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fii-dii-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fii-dii')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cmd$,
      fii_url
    )
  );

  perform cron.schedule(
    'social-fii-dii-1645',
    '15 11 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fii-dii-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fii-dii')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cmd$,
      fii_url
    )
  );
end
$$;
