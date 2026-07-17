-- ISIN is the canonical security identity for portfolio imports and matching.
-- Exchange symbols/scheme codes remain the quote keys in social_market_assets.

alter table public.social_market_assets
  drop constraint if exists social_market_assets_asset_type_check;
alter table public.social_market_assets
  add constraint social_market_assets_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond'));

alter table public.social_market_price_history
  drop constraint if exists social_market_price_history_asset_type_check;
alter table public.social_market_price_history
  add constraint social_market_price_history_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond'));

alter table public.social_market_asset_isins
  drop constraint if exists social_market_asset_isins_asset_type_check;
alter table public.social_market_asset_isins
  add constraint social_market_asset_isins_asset_type_check
  check (asset_type in ('stock', 'etf', 'fund', 'bond'));

create unique index if not exists social_market_asset_isins_isin_unique_idx
  on public.social_market_asset_isins (isin);

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
    r.asset_type,
    trim(r.asset_key),
    upper(trim(r.isin)),
    coalesce(r.synced_at::timestamptz, now())
  from jsonb_to_recordset(p_rows) as r(
    asset_type text,
    asset_key text,
    isin text,
    synced_at text
  )
  where r.asset_type in ('stock', 'etf', 'fund', 'bond')
    and trim(coalesce(r.asset_key, '')) <> ''
    and upper(trim(coalesce(r.isin, ''))) ~ '^[A-Z0-9]{12}$'
  on conflict (isin) do update set
    asset_type = excluded.asset_type,
    asset_key = excluded.asset_key,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
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
      a.synced_at,
      a.exchange,
      a.exchange_symbol,
      a.isin
    from (
      select trim(k) as raw_key, upper(trim(k)) as norm_key
      from unnest(p_keys) as k
      where trim(coalesce(k, '')) <> ''
    ) keys
    join lateral (
      select a.*
      from public.social_market_assets a
      left join public.social_market_asset_isins i
        on i.asset_type = a.asset_type and i.asset_key = a.asset_key
      where (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = keys.norm_key)
         or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
         or i.isin = keys.norm_key
      order by case a.asset_type
        when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 when 'bond' then 3 else 4 end
      limit 1
    ) a on true
    order by norm_key
  ) t;
  return coalesce(result, '[]'::json);
end;
$$;
