-- Dual iNAV storage: NSE nav (existing) + AMC scrape amc_inav for analysis / tracker.

alter table public.social_market_assets
  add column if not exists amc_inav numeric,
  add column if not exists amc_inav_synced_at timestamptz;

comment on column public.social_market_assets.nav is
  'NSE published NAV / iNAV for ETFs.';
comment on column public.social_market_assets.amc_inav is
  'AMC indicative NAV scrape for ETFs (tracker truth unless |premium| > 30%).';
comment on column public.social_market_assets.amc_inav_synced_at is
  'When amc_inav was last written from the AMC scrape job.';

-- Fast list includes both iNAV sources.
create or replace function public.list_social_market_etf_quotes()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t) order by t.asset_key), '[]'::json)
  into result
  from (
    select
      a.asset_key,
      a.name,
      a.price,
      a.nav,
      a.amc_inav,
      a.change_pct,
      a.previous_close,
      a.synced_at,
      a.amc_inav_synced_at,
      a.as_of_date
    from public.social_market_assets a
    where a.asset_type = 'etf'
      and a.as_of_date = (
        select max(x.as_of_date)
        from public.social_market_assets x
        where x.asset_type = 'etf'
      )
  ) t;

  return coalesce(result, '[]'::json);
end;
$function$;

revoke all on function public.list_social_market_etf_quotes() from public;
grant execute on function public.list_social_market_etf_quotes() to anon, authenticated;

-- Upsert AMC iNAV only (does not touch LTP / NSE nav).
create or replace function public.bulk_upsert_etf_amc_inav(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return 0;
  end if;

  update public.social_market_assets a
  set
    amc_inav = v.amc_inav,
    amc_inav_synced_at = coalesce(v.synced_at, now()),
    name = case
      when v.name is not null and length(trim(v.name)) > 0 and trim(v.name) <> v.asset_key
        then trim(v.name)
      else a.name
    end
  from (
    select
      upper(trim(r.asset_key)) as asset_key,
      nullif(trim(r.name), '') as name,
      r.amc_inav,
      r.synced_at
    from jsonb_to_recordset(p_rows) as r(
      asset_key text,
      name text,
      amc_inav numeric,
      synced_at timestamptz
    )
    where trim(coalesce(r.asset_key, '')) <> ''
      and r.amc_inav is not null
      and r.amc_inav > 0
  ) v
  where a.asset_type = 'etf'
    and a.asset_key = v.asset_key;

  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.bulk_upsert_etf_amc_inav(jsonb) from public;
-- service role / edge only via supabase client with service key; no anon grant
