-- PocketEdge as source of truth for Indian market quotes + daily close/NAV history.

alter table public.social_market_assets
  add column if not exists previous_close numeric,
  add column if not exists as_of_date date,
  add column if not exists price_source text;

comment on column public.social_market_assets.previous_close is
  'Prior session close (stocks/ETFs) or prior NAV when available.';
comment on column public.social_market_assets.as_of_date is
  'Trade date for equity LTP, or AMFI NAV date for funds.';
comment on column public.social_market_assets.price_source is
  'Upstream quote source, e.g. nse | amfi.';

create table if not exists public.social_market_price_history (
  asset_type text not null check (asset_type in ('stock', 'etf', 'fund')),
  asset_key text not null,
  as_of_date date not null,
  close_price numeric not null,
  previous_close numeric,
  change_pct numeric,
  source text not null default 'unknown',
  synced_at timestamptz not null default now(),
  primary key (asset_type, asset_key, as_of_date)
);

create index if not exists social_market_price_history_key_date_idx
  on public.social_market_price_history (asset_type, asset_key, as_of_date desc);

create index if not exists social_market_price_history_date_idx
  on public.social_market_price_history (as_of_date desc);

alter table public.social_market_price_history enable row level security;

drop policy if exists "social_market_price_history_select_authenticated"
  on public.social_market_price_history;
create policy "social_market_price_history_select_authenticated"
  on public.social_market_price_history for select
  to authenticated
  using (true);

grant select on public.social_market_price_history to authenticated;

create table if not exists public.social_market_price_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('equity', 'funds', 'all')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  equity_updated integer not null default 0,
  fund_updated integer not null default 0,
  history_upserted integer not null default 0,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

alter table public.social_market_price_fetch_runs enable row level security;

drop policy if exists "social_market_price_fetch_runs_select_authenticated"
  on public.social_market_price_fetch_runs;
create policy "social_market_price_fetch_runs_select_authenticated"
  on public.social_market_price_fetch_runs for select
  to authenticated
  using (true);

grant select on public.social_market_price_fetch_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Bulk upsert current quotes (service role / CI)
-- ---------------------------------------------------------------------------

create or replace function public.bulk_upsert_social_market_assets(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.social_market_assets (
    asset_type, asset_key, name, price, change_pct, synced_at,
    previous_close, as_of_date, price_source
  )
  select
    r.asset_type,
    r.asset_key,
    coalesce(nullif(trim(r.name), ''), r.asset_key),
    r.price,
    r.change_pct,
    coalesce(r.synced_at::timestamptz, now()),
    r.previous_close,
    r.as_of_date::date,
    r.price_source
  from jsonb_to_recordset(p_rows) as r(
    asset_type text,
    asset_key text,
    name text,
    price numeric,
    change_pct numeric,
    synced_at text,
    previous_close numeric,
    as_of_date text,
    price_source text
  )
  on conflict (asset_type, asset_key) do update set
    name = case
      when excluded.name is not null and excluded.name <> excluded.asset_key
        then excluded.name
      else public.social_market_assets.name
    end,
    price = coalesce(excluded.price, public.social_market_assets.price),
    change_pct = coalesce(excluded.change_pct, public.social_market_assets.change_pct),
    synced_at = excluded.synced_at,
    previous_close = coalesce(excluded.previous_close, public.social_market_assets.previous_close),
    as_of_date = coalesce(excluded.as_of_date, public.social_market_assets.as_of_date),
    price_source = coalesce(excluded.price_source, public.social_market_assets.price_source);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.bulk_upsert_social_market_assets(jsonb) from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_assets(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Bulk upsert daily close / NAV history
-- ---------------------------------------------------------------------------

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
    asset_type, asset_key, as_of_date, close_price, previous_close, change_pct, source, synced_at
  )
  select
    r.asset_type,
    r.asset_key,
    r.as_of_date::date,
    r.close_price,
    r.previous_close,
    r.change_pct,
    coalesce(nullif(trim(r.source), ''), 'unknown'),
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
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.bulk_upsert_social_market_price_history(jsonb)
  from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_price_history(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Read APIs
-- ---------------------------------------------------------------------------

create or replace function public.lookup_social_market_asset(p_key text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'asset_type', a.asset_type,
    'asset_key', a.asset_key,
    'name', a.name,
    'price', a.price,
    'change_pct', a.change_pct,
    'previous_close', a.previous_close,
    'as_of_date', a.as_of_date,
    'price_source', a.price_source,
    'synced_at', a.synced_at
  )
  from public.social_market_assets a
  where (a.asset_type in ('stock', 'etf') and a.asset_key = upper(trim(p_key)))
     or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
  order by case a.asset_type when 'stock' then 0 when 'etf' then 1 else 2 end
  limit 1;
$$;

create or replace function public.search_social_market_assets(
  p_query text,
  p_asset_type text default null,
  p_limit integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  result json;
begin
  if char_length(q) < 2 then
    return json_build_object('items', '[]'::json, 'total', 0);
  end if;

  if p_asset_type is not null and p_asset_type not in ('stock', 'etf', 'fund') then
    raise exception 'Invalid asset type';
  end if;

  with scored as (
    select
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      a.price_source,
      a.synced_at,
      case
        when lower(a.asset_key) = q then 100
        when lower(a.asset_key) like q || '%' then 80
        when lower(a.name) like q || '%' then 60
        when lower(a.asset_key) like '%' || q || '%' then 45
        when lower(a.name) like '%' || q || '%' then 40
        else 0
      end as score
    from public.social_market_assets a
    where (p_asset_type is null or a.asset_type = p_asset_type)
      and (
        lower(a.asset_key) like q || '%'
        or lower(a.asset_key) like '%' || q || '%'
        or lower(a.name) like q || '%'
        or lower(a.name) like '%' || q || '%'
      )
  ),
  ranked as (
    select *
    from scored
    where score > 0
    order by score desc, asset_key asc
    limit lim
  )
  select json_build_object(
    'items', coalesce(json_agg(
      json_build_object(
        'asset_type', r.asset_type,
        'asset_key', r.asset_key,
        'name', r.name,
        'price', r.price,
        'change_pct', r.change_pct,
        'previous_close', r.previous_close,
        'as_of_date', r.as_of_date,
        'price_source', r.price_source,
        'synced_at', r.synced_at,
        'score', r.score
      )
      order by r.score desc, r.asset_key asc
    ), '[]'::json),
    'total', (select count(*)::int from scored where score > 0)
  )
  into result
  from ranked r;

  return coalesce(result, json_build_object('items', '[]'::json, 'total', 0));
end;
$$;

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

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select distinct on (norm_key)
      norm_key as query_key,
      a.asset_type,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.as_of_date,
      a.price_source,
      a.synced_at
    from (
      select
        trim(k) as raw_key,
        case
          when trim(k) ~ '^[0-9]+$' then trim(k)
          else upper(trim(k))
        end as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*
      from public.social_market_assets a
      where (a.asset_type in ('stock', 'etf') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
      order by case a.asset_type when 'stock' then 0 when 'etf' then 1 else 2 end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

create or replace function public.get_social_market_price_history(
  p_asset_type text,
  p_asset_key text,
  p_limit integer default 120
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 120), 500));
  key text;
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund') then
    raise exception 'Invalid asset type';
  end if;

  key := case
    when p_asset_type = 'fund' then trim(p_asset_key)
    else upper(trim(p_asset_key))
  end;

  if key is null or key = '' then
    return '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.as_of_date desc), '[]'::json)
  into result
  from (
    select
      h.asset_type,
      h.asset_key,
      h.as_of_date,
      h.close_price,
      h.previous_close,
      h.change_pct,
      h.source,
      h.synced_at
    from public.social_market_price_history h
    where h.asset_type = p_asset_type
      and h.asset_key = key
    order by h.as_of_date desc
    limit lim
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

revoke all on function public.get_social_market_price_history(text, text, integer) from public;
grant execute on function public.get_social_market_price_history(text, text, integer) to authenticated;
grant execute on function public.lookup_social_market_asset(text) to authenticated;
grant execute on function public.search_social_market_assets(text, text, integer) to authenticated;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;

-- Preview lists for Markets / Search landing (from live catalog, not static JSON).
create or replace function public.list_social_market_preview(
  p_asset_type text,
  p_limit integer default 40
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 40), 100));
  result json;
begin
  if p_asset_type is null or p_asset_type not in ('stock', 'etf', 'fund') then
    raise exception 'Invalid asset type';
  end if;

  if p_asset_type = 'fund' then
    select json_build_object(
      'synced_at', (select max(synced_at) from public.social_market_assets where asset_type = 'fund'),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select
        a.asset_type,
        a.asset_key,
        a.name,
        a.price,
        a.change_pct,
        a.previous_close,
        a.as_of_date,
        a.price_source,
        a.synced_at
      from public.social_market_assets a
      where a.asset_type = 'fund'
        and a.price is not null
        and a.name ~* 'direct'
        and a.name ~* 'growth'
      order by a.name asc
      limit lim
    ) t;
  else
    select json_build_object(
      'synced_at', (
        select max(synced_at) from public.social_market_assets where asset_type = p_asset_type
      ),
      'items', coalesce(json_agg(row_to_json(t)), '[]'::json)
    )
    into result
    from (
      select
        a.asset_type,
        a.asset_key,
        a.name,
        a.price,
        a.change_pct,
        a.previous_close,
        a.as_of_date,
        a.price_source,
        a.synced_at
      from public.social_market_assets a
      where a.asset_type = p_asset_type
        and a.price is not null
      order by abs(coalesce(a.change_pct, 0)) desc, a.asset_key asc
      limit lim
    ) t;
  end if;

  return coalesce(result, json_build_object('synced_at', null, 'items', '[]'::json));
end;
$$;

revoke all on function public.list_social_market_preview(text, integer) from public;
grant execute on function public.list_social_market_preview(text, integer) to authenticated;
