-- Funds keep ISINs in social_market_asset_isins, while exchange-listed
-- instruments may keep them directly on social_market_assets. Return either
-- representation to portfolio import callers.

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
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'bond')
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
      where (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
        and (
          (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = keys.norm_key)
          or (a.asset_type = 'fund' and a.asset_key = keys.raw_key)
          or i.isin = keys.norm_key
        )
      order by case a.asset_type
        when 'stock' then 0 when 'etf' then 1 when 'fund' then 2 when 'bond' then 3 else 4 end
      limit 1
    ) a on true
    order by norm_key
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

grant execute on function public.lookup_social_market_assets_batch(text[]) to authenticated;
