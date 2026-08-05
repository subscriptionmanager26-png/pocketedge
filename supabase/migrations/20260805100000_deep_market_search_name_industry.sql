-- Deep market search: match whole-word tokens in name and screener
-- industry/sector fields (so "IT" finds NIFTY IT + Information Technology stocks),
-- and demote short ticker-prefix noise so industry hits can surface.

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
  q_esc text;
  word_re text;
  result json;
begin
  if char_length(q) < 2 then
    return json_build_object('items', '[]'::json, 'total', 0);
  end if;
  if p_asset_type is not null and p_asset_type not in ('stock', 'etf', 'fund', 'commodity', 'index') then
    raise exception 'Invalid asset type';
  end if;

  -- Escape regex metacharacters so user input is matched literally.
  q_esc := regexp_replace(q, '([\.\\\?\*\+\|\^\$\(\)\[\]\{\}])', '\\\1', 'g');
  word_re := '(^|[^a-z0-9])' || q_esc || '([^a-z0-9]|$)';

  with latest_dates as (
    select asset_type, max(as_of_date) as as_of_date
    from public.social_market_assets
    where asset_type in ('stock', 'etf', 'fund', 'commodity', 'index')
    group by asset_type
  ),
  candidates as (
    select
      a.*,
      lower(a.asset_key) as key_l,
      lower(coalesce(a.exchange_symbol, '')) as exch_l,
      lower(a.name) as name_l,
      lower(coalesce(a.isin, '')) as isin_l,
      lower(coalesce(a.screener_industry, '')) as industry_l,
      lower(coalesce(a.screener_sector, '')) as sector_l,
      lower(coalesce(a.screener_broad_sector, '')) as broad_sector_l,
      lower(coalesce(a.screener_broad_industry, '')) as broad_industry_l
    from public.social_market_assets a
    left join latest_dates d on d.asset_type = a.asset_type
    where (a.asset_type = 'fund' or a.as_of_date = d.as_of_date)
      and (p_asset_type is null or a.asset_type = p_asset_type)
      and (
        lower(a.asset_key) like q || '%'
        or lower(coalesce(a.exchange_symbol, '')) like q || '%'
        or lower(a.name) like q || '%'
        or lower(coalesce(a.isin, '')) like q || '%'
        -- Whole-word token in name / symbol / key (enables "IT" → "NIFTY IT").
        or lower(a.name) ~ word_re
        or lower(a.asset_key) ~ word_re
        or lower(coalesce(a.exchange_symbol, '')) ~ word_re
        -- Industry / sector taxonomy (enables "IT" → IT & Information Technology names).
        or lower(coalesce(a.screener_industry, '')) ~ word_re
        or lower(coalesce(a.screener_sector, '')) ~ word_re
        or lower(coalesce(a.screener_broad_sector, '')) ~ word_re
        or lower(coalesce(a.screener_broad_industry, '')) ~ word_re
        or lower(coalesce(a.screener_industry, '')) like q || '%'
        or lower(coalesce(a.screener_sector, '')) like q || '%'
        or lower(coalesce(a.screener_broad_sector, '')) like q || '%'
        or lower(coalesce(a.screener_broad_industry, '')) like q || '%'
        or (
          char_length(q) >= 4
          and (
            lower(a.asset_key) like '%' || q || '%'
            or lower(coalesce(a.exchange_symbol, '')) like '%' || q || '%'
            or lower(coalesce(a.isin, '')) like '%' || q || '%'
            or lower(a.name) like '%' || q || '%'
            or lower(coalesce(a.screener_industry, '')) like '%' || q || '%'
            or lower(coalesce(a.screener_sector, '')) like '%' || q || '%'
            or lower(coalesce(a.screener_broad_sector, '')) like '%' || q || '%'
            or lower(coalesce(a.screener_broad_industry, '')) like '%' || q || '%'
          )
        )
      )
  ),
  scored as (
    select
      c.*,
      case
        when c.key_l = q then 100
        when c.exch_l = q then 95
        when c.isin_l = q then 90
        -- Whole-word name/key hits outrank short ticker-prefix noise ("IT" → NIFTY IT).
        when c.name_l ~ word_re then 88
        when c.key_l ~ word_re or c.exch_l ~ word_re then 86
        -- Industry / sector whole-word (or taxonomy prefix).
        when c.industry_l ~ word_re
          or c.sector_l ~ word_re
          or c.broad_sector_l ~ word_re
          or c.broad_industry_l ~ word_re
          then 78
        when c.industry_l like q || '%'
          or c.sector_l like q || '%'
          or c.broad_sector_l like q || '%'
          or c.broad_industry_l like q || '%'
          then 74
        when c.key_l like q || '%' then
          case when char_length(q) <= 3 then 65 else 80 end
        when c.exch_l like q || '%' then
          case when char_length(q) <= 3 then 62 else 75 end
        when c.name_l like q || '%' then 60
        when char_length(q) >= 4 and c.key_l like '%' || q || '%' then 45
        when char_length(q) >= 4 and c.exch_l like '%' || q || '%' then 43
        when char_length(q) >= 4 and c.isin_l like '%' || q || '%' then 42
        when char_length(q) >= 4 and c.name_l like '%' || q || '%' then 40
        when char_length(q) >= 4 and (
          c.industry_l like '%' || q || '%'
          or c.sector_l like '%' || q || '%'
          or c.broad_sector_l like '%' || q || '%'
          or c.broad_industry_l like '%' || q || '%'
        ) then 36
        else 0
      end as score
    from candidates c
  ),
  ranked as (
    select * from scored
    where score > 0
    order by
      score desc,
      market_cap_cr desc nulls last,
      asset_key asc
    limit lim
  )
  select json_build_object(
    'items', coalesce((
      select json_agg(json_build_object(
        'asset_type', r.asset_type,
        'asset_key', r.asset_key,
        'name', r.name,
        'price', r.price,
        'change_pct', r.change_pct,
        'previous_close', r.previous_close,
        'as_of_date', r.as_of_date,
        'price_source', r.price_source,
        'synced_at', r.synced_at,
        'exchange', r.exchange,
        'exchange_symbol', r.exchange_symbol,
        'isin', r.isin,
        'logo_url', r.logo_url,
        'logo_icon_url', r.logo_icon_url,
        'screener_industry', r.screener_industry,
        'screener_sector', r.screener_sector,
        'screener_broad_sector', r.screener_broad_sector,
        'score', r.score
      ) order by r.score desc, r.market_cap_cr desc nulls last, r.asset_key asc)
      from ranked r
    ), '[]'::json),
    'total', (select count(*)::int from ranked)
  ) into result;

  return coalesce(result, json_build_object('items', '[]'::json, 'total', 0));
end;
$$;

revoke all on function public.search_social_market_assets(text, text, integer) from public;
grant execute on function public.search_social_market_assets(text, text, integer) to authenticated;
