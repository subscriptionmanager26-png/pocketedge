-- A mutual-fund scheme may publish separate payout and reinvestment ISINs.
-- Keep these as first-class aliases instead of overloading the one-value
-- social_market_assets.isin field used by exchange-listed instruments.

create table if not exists public.social_market_asset_isins (
  asset_type text not null check (asset_type = 'fund'),
  asset_key text not null,
  isin text not null,
  synced_at timestamptz not null default now(),
  primary key (asset_type, isin),
  foreign key (asset_type, asset_key)
    references public.social_market_assets (asset_type, asset_key)
    on delete cascade
);

create index if not exists social_market_asset_isins_key_idx
  on public.social_market_asset_isins (asset_type, asset_key);

alter table public.social_market_asset_isins enable row level security;
create policy "social_market_asset_isins_select_authenticated"
  on public.social_market_asset_isins for select
  to authenticated
  using (true);
grant select on public.social_market_asset_isins to authenticated;

create or replace function public.bulk_upsert_social_market_asset_isins(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.social_market_asset_isins (asset_type, asset_key, isin, synced_at)
  select
    'fund',
    trim(r.asset_key),
    upper(trim(r.isin)),
    coalesce(r.synced_at::timestamptz, now())
  from jsonb_to_recordset(p_rows) as r(
    asset_key text,
    isin text,
    synced_at text
  )
  where trim(coalesce(r.asset_key, '')) <> ''
    and upper(trim(coalesce(r.isin, ''))) ~ '^[A-Z0-9]{12}$'
  on conflict (asset_type, isin) do update set
    asset_key = excluded.asset_key,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.bulk_upsert_social_market_asset_isins(jsonb)
  from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_asset_isins(jsonb) to service_role;

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
      a.synced_at,
      a.exchange,
      a.exchange_symbol,
      a.isin
    from (
      select
        trim(k) as raw_key,
        upper(trim(k)) as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*
      from public.social_market_assets a
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where (a.asset_type in ('stock', 'etf', 'commodity') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
         or (a.asset_type = 'fund' and i.isin = keys.norm_key)
      order by case a.asset_type
        when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 else 3 end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

revoke all on function public.lookup_social_market_assets_batch(text[]) from public;
grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
