-- Split PocketEdge AI news out of the main Feed into dedicated news RPCs.
-- News posts are identified by via.source = 'mn_news_ai_summaries'.

create or replace function public.list_feed_posts(
  p_limit integer default 50,
  p_offset integer default 0
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
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select *
    from public.social_posts
    where coalesce(via->>'source', '') is distinct from 'mn_news_ai_summaries'
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

create or replace function public.list_public_feed_posts(
  p_limit integer default 50,
  p_offset integer default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  items json;
begin
  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select *
    from public.social_posts
    where coalesce(via->>'source', '') is distinct from 'mn_news_ai_summaries'
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

create or replace function public.list_news_posts(
  p_limit integer default 50,
  p_offset integer default 0
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
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select *
    from public.social_posts
    where coalesce(via->>'source', '') = 'mn_news_ai_summaries'
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

create or replace function public.list_public_news_posts(
  p_limit integer default 50,
  p_offset integer default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  items json;
begin
  select coalesce(json_agg(public.social_post_row_to_json(p) order by p.created_at desc), '[]'::json)
  into items
  from (
    select *
    from public.social_posts
    where coalesce(via->>'source', '') = 'mn_news_ai_summaries'
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    offset greatest(0, coalesce(p_offset, 0))
  ) p;

  return json_build_object('items', items);
end;
$$;

revoke all on function public.list_feed_posts(integer, integer) from public;
grant execute on function public.list_feed_posts(integer, integer) to authenticated;

revoke all on function public.list_public_feed_posts(integer, integer) from public;
grant execute on function public.list_public_feed_posts(integer, integer) to anon, authenticated;

revoke all on function public.list_news_posts(integer, integer) from public;
grant execute on function public.list_news_posts(integer, integer) to authenticated;

revoke all on function public.list_public_news_posts(integer, integer) from public;
grant execute on function public.list_public_news_posts(integer, integer) to anon, authenticated;
