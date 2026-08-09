-- Filtered news feed: top N matching tickers / types / industries (not a
-- client-side slice of the global top 100).

drop function if exists public.list_news_posts(integer, integer);
drop function if exists public.list_public_news_posts(integer, integer);

create or replace function public.list_news_posts(
  p_limit integer default 50,
  p_offset integer default 0,
  p_tickers text[] default null,
  p_types text[] default null,
  p_industries text[] default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  items json;
  tickers text[];
  types text[];
  industries text[];
begin
  if uid is null then raise exception 'Authentication required'; end if;

  tickers := array(
    select distinct upper(trim(t))
    from unnest(coalesce(p_tickers, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );
  types := array(
    select distinct trim(t)
    from unnest(coalesce(p_types, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );
  industries := array(
    select distinct trim(t)
    from unnest(coalesce(p_industries, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );

  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select sp.*
    from public.social_posts sp
    where coalesce(sp.via->>'source', '') = 'mn_news_ai_summaries'
      and (
        cardinality(tickers) = 0
        or upper(nullif(trim(coalesce(sp.via->>'ticker', '')), '')) = any (tickers)
      )
      and (
        cardinality(types) = 0
        or nullif(trim(coalesce(sp.via->>'type', '')), '') = any (types)
      )
      and (
        cardinality(industries) = 0
        or exists (
          select 1
          from public.social_market_assets a
          where a.asset_type in ('stock', 'etf')
            and a.asset_key = upper(nullif(trim(coalesce(sp.via->>'ticker', '')), ''))
            and nullif(trim(coalesce(a.screener_industry, '')), '') = any (industries)
        )
      )
    order by sp.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

create or replace function public.list_public_news_posts(
  p_limit integer default 50,
  p_offset integer default 0,
  p_tickers text[] default null,
  p_types text[] default null,
  p_industries text[] default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  items json;
  tickers text[];
  types text[];
  industries text[];
begin
  tickers := array(
    select distinct upper(trim(t))
    from unnest(coalesce(p_tickers, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );
  types := array(
    select distinct trim(t)
    from unnest(coalesce(p_types, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );
  industries := array(
    select distinct trim(t)
    from unnest(coalesce(p_industries, array[]::text[])) as t
    where nullif(trim(t), '') is not null
  );

  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select sp.*
    from public.social_posts sp
    where coalesce(sp.via->>'source', '') = 'mn_news_ai_summaries'
      and (
        cardinality(tickers) = 0
        or upper(nullif(trim(coalesce(sp.via->>'ticker', '')), '')) = any (tickers)
      )
      and (
        cardinality(types) = 0
        or nullif(trim(coalesce(sp.via->>'type', '')), '') = any (types)
      )
      and (
        cardinality(industries) = 0
        or exists (
          select 1
          from public.social_market_assets a
          where a.asset_type in ('stock', 'etf')
            and a.asset_key = upper(nullif(trim(coalesce(sp.via->>'ticker', '')), ''))
            and nullif(trim(coalesce(a.screener_industry, '')), '') = any (industries)
        )
      )
    order by sp.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

-- Facets for the Custom filter panel (avoid shrinking options to the filtered set).
create or replace function public.list_news_post_types()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(t order by t),
    '[]'::json
  )
  from (
    select distinct nullif(trim(via->>'type'), '') as t
    from public.social_posts
    where coalesce(via->>'source', '') = 'mn_news_ai_summaries'
      and nullif(trim(via->>'type'), '') is not null
    order by 1
    limit 50
  ) s;
$$;

revoke all on function public.list_news_posts(integer, integer, text[], text[], text[]) from public;
grant execute on function public.list_news_posts(integer, integer, text[], text[], text[]) to authenticated;

revoke all on function public.list_public_news_posts(integer, integer, text[], text[], text[]) from public;
grant execute on function public.list_public_news_posts(integer, integer, text[], text[], text[]) to anon, authenticated;

revoke all on function public.list_news_post_types() from public;
grant execute on function public.list_news_post_types() to anon, authenticated;
