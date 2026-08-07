-- Exclude PocketEdge AI news from asset/stock Posts (mention lookup).
-- Same discriminator as the News tab split: via.source = 'mn_news_ai_summaries'.

create or replace function public.list_posts_mentioning_tickers(
  p_tickers text[],
  p_days integer default 30,
  p_limit integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  days integer := greatest(1, least(coalesce(p_days, 30), 365));
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  since timestamptz := now() - make_interval(days => days);
  keys text[];
  items json;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select coalesce(array_agg(distinct upper(trim(t))), '{}'::text[])
  into keys
  from unnest(coalesce(p_tickers, '{}'::text[])) as t
  where trim(coalesce(t, '')) <> '';

  if keys is null or cardinality(keys) = 0 then
    return json_build_object('items', '[]'::json, 'since', since, 'days', days);
  end if;

  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select sp.*
    from public.social_posts sp
    where sp.created_at >= since
      and coalesce(sp.via->>'source', '') is distinct from 'mn_news_ai_summaries'
      and exists (
        select 1
        from unnest(keys) as k
        where
          position('@' || k in upper(sp.body)) > 0
          or position('$' || k in upper(sp.body)) > 0
          or position('@[' || k || ']' in upper(sp.body)) > 0
          or upper(coalesce(sp.trade->>'ticker', '')) = k
          or position('"' || k || '"' in upper(coalesce(sp.portfolio_share::text, ''))) > 0
      )
    order by sp.created_at desc
    limit lim
  ) p;

  return json_build_object(
    'items', coalesce(items, '[]'::json),
    'since', since,
    'days', days
  );
end;
$$;

revoke all on function public.list_posts_mentioning_tickers(text[], integer, integer) from public;
grant execute on function public.list_posts_mentioning_tickers(text[], integer, integer) to authenticated;
