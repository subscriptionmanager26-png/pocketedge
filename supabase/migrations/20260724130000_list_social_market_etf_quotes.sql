-- Fast ETF quote list for Resources iNAV tracker (single scan, not N-key batch lookup).

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
      a.change_pct,
      a.previous_close,
      a.synced_at,
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
