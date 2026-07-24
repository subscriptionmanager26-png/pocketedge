-- Fast SGB + IBJA gold quote list for Resources SGB tracker (single scan, not N-key batch).

create or replace function public.list_social_market_sgb_quotes()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t) order by t.kind, t.asset_key), '[]'::json)
  into result
  from (
    select
      'bond'::text as kind,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.synced_at,
      a.as_of_date,
      a.isin,
      a.price_source
    from public.social_market_assets a
    where a.asset_type = 'bond'
      and a.as_of_date = (
        select max(x.as_of_date)
        from public.social_market_assets x
        where x.asset_type = 'bond'
      )

    union all

    select
      'gold'::text as kind,
      a.asset_key,
      a.name,
      a.price,
      a.change_pct,
      a.previous_close,
      a.synced_at,
      a.as_of_date,
      a.isin,
      a.price_source
    from public.social_market_assets a
    where a.asset_type = 'commodity'
      and a.asset_key = 'IBJA-GOLD-999'
  ) t;

  return coalesce(result, '[]'::json);
end;
$function$;

revoke all on function public.list_social_market_sgb_quotes() from public;
grant execute on function public.list_social_market_sgb_quotes() to anon, authenticated;
