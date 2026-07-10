-- RPCs for social posts and asset reviews.

-- ---------------------------------------------------------------------------
-- Post helpers
-- ---------------------------------------------------------------------------

create or replace function public.social_post_row_to_json(p_post public.social_posts)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  like_count integer;
  comment_count integer;
  liked boolean := false;
begin
  select count(*)::integer into like_count
  from public.social_post_likes where post_id = p_post.id;
  select count(*)::integer into comment_count
  from public.social_post_comments where post_id = p_post.id;
  if uid is not null then
    select exists (
      select 1 from public.social_post_likes where post_id = p_post.id and user_id = uid
    ) into liked;
  end if;

  return json_build_object(
    'id', p_post.id,
    'author_id', p_post.author_id,
    'post_type', p_post.post_type,
    'body', p_post.body,
    'image_url', p_post.image_url,
    'trade', p_post.trade,
    'portfolio_share', p_post.portfolio_share,
    'via', p_post.via,
    'topics', coalesce(p_post.topics, '{}'),
    'created_at', p_post.created_at,
    'like_count', like_count,
    'comment_count', comment_count,
    'liked', liked
  );
end;
$$;

create or replace function public.create_social_post(
  p_body text default '',
  p_post_type text default 'text',
  p_image_url text default null,
  p_trade jsonb default null,
  p_portfolio_share jsonb default null,
  p_via jsonb default null,
  p_topics text[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_posts;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_body), '') = '' and p_image_url is null and p_trade is null and p_portfolio_share is null then
    raise exception 'Post cannot be empty';
  end if;

  insert into public.social_posts (
    author_id, post_type, body, image_url, trade, portfolio_share, via, topics
  )
  values (
    uid,
    coalesce(nullif(trim(p_post_type), ''), 'text'),
    coalesce(p_body, ''),
    p_image_url,
    p_trade,
    p_portfolio_share,
    p_via,
    coalesce(p_topics, '{}')
  )
  returning * into row;

  return public.social_post_row_to_json(row);
end;
$$;

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
    order by created_at desc
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset)
  ) p;

  return json_build_object('items', items);
end;
$$;

create or replace function public.get_social_post(p_post_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_posts;
  payload json;
  comments json;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into row from public.social_posts where id = p_post_id;
  if row.id is null then raise exception 'Post not found'; end if;

  payload := public.social_post_row_to_json(row);

  select coalesce(json_agg(
    json_build_object(
      'id', c.id,
      'author_id', c.author_id,
      'body', c.body,
      'parent_id', c.parent_id,
      'created_at', c.created_at
    ) order by c.created_at asc
  ), '[]'::json)
  into comments
  from public.social_post_comments c
  where c.post_id = p_post_id;

  return payload || json_build_object('comments', comments);
end;
$$;

create or replace function public.toggle_post_like(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_liked boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.social_posts where id = p_post_id) then
    raise exception 'Post not found';
  end if;

  if exists (select 1 from public.social_post_likes where post_id = p_post_id and user_id = uid) then
    delete from public.social_post_likes where post_id = p_post_id and user_id = uid;
    now_liked := false;
  else
    insert into public.social_post_likes (post_id, user_id) values (p_post_id, uid);
    now_liked := true;
  end if;

  return json_build_object(
    'liked', now_liked,
    'like_count', (select count(*)::integer from public.social_post_likes where post_id = p_post_id)
  );
end;
$$;

create or replace function public.add_post_comment(
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_post_comments;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.social_posts where id = p_post_id) then
    raise exception 'Post not found';
  end if;

  insert into public.social_post_comments (post_id, author_id, body, parent_id)
  values (p_post_id, uid, trim(p_body), p_parent_id)
  returning * into row;

  return json_build_object(
    'id', row.id,
    'author_id', row.author_id,
    'body', row.body,
    'parent_id', row.parent_id,
    'created_at', row.created_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Asset review helpers
-- ---------------------------------------------------------------------------

create or replace function public.asset_review_row_to_json(p_review public.social_asset_reviews)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  agree_count integer;
  disagree_count integer;
  user_vote text;
  comments json;
begin
  select count(*)::integer into agree_count
  from public.social_asset_review_votes
  where review_id = p_review.id and vote = 'agree';
  select count(*)::integer into disagree_count
  from public.social_asset_review_votes
  where review_id = p_review.id and vote = 'disagree';

  if uid is not null then
    select vote into user_vote
    from public.social_asset_review_votes
    where review_id = p_review.id and user_id = uid;
  end if;

  select coalesce(json_agg(
    json_build_object(
      'id', c.id,
      'author_id', c.author_id,
      'body', c.body,
      'parent_id', c.parent_id,
      'created_at', c.created_at
    ) order by c.created_at asc
  ), '[]'::json)
  into comments
  from public.social_asset_review_comments c
  where c.review_id = p_review.id;

  return json_build_object(
    'id', p_review.id,
    'author_id', p_review.author_id,
    'asset_type', p_review.asset_type,
    'asset_id', p_review.asset_id,
    'rating', p_review.rating,
    'body', p_review.body,
    'share_count', p_review.share_count,
    'created_at', p_review.created_at,
    'updated_at', p_review.updated_at,
    'agree_count', agree_count,
    'disagree_count', disagree_count,
    'user_vote', user_vote,
    'comments', comments
  );
end;
$$;

create or replace function public.upsert_asset_review(
  p_asset_type text,
  p_asset_id text,
  p_rating smallint,
  p_body text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_asset_reviews;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_asset_type not in ('fund', 'stock', 'etf', 'index', 'commodity') then
    raise exception 'Invalid asset type';
  end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1-5'; end if;
  if coalesce(trim(p_asset_id), '') = '' then raise exception 'Asset id required'; end if;

  insert into public.social_asset_reviews (author_id, asset_type, asset_id, rating, body)
  values (uid, p_asset_type, trim(p_asset_id), p_rating, coalesce(trim(p_body), ''))
  on conflict (author_id, asset_type, asset_id) do update
  set rating = excluded.rating,
      body = excluded.body,
      updated_at = now()
  returning * into row;

  return public.asset_review_row_to_json(row);
end;
$$;

create or replace function public.list_asset_reviews(
  p_asset_type text,
  p_asset_id text
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

  select coalesce(json_agg(public.asset_review_row_to_json(r) order by r.created_at desc), '[]'::json)
  into items
  from public.social_asset_reviews r
  where r.asset_type = p_asset_type and r.asset_id = trim(p_asset_id);

  return json_build_object('items', coalesce(items, '[]'::json));
end;
$$;

create or replace function public.list_reviews_by_author(p_author_id uuid)
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

  select coalesce(json_agg(public.asset_review_row_to_json(r) order by r.created_at desc), '[]'::json)
  into items
  from public.social_asset_reviews r
  where r.author_id = p_author_id;

  return json_build_object('items', coalesce(items, '[]'::json));
end;
$$;

create or replace function public.get_user_asset_review(
  p_asset_type text,
  p_asset_id text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_asset_reviews;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into row
  from public.social_asset_reviews
  where author_id = uid
    and asset_type = p_asset_type
    and asset_id = trim(p_asset_id);

  if row.id is null then return null; end if;
  return public.asset_review_row_to_json(row);
end;
$$;

create or replace function public.has_community_reviews_access()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  return exists (
    select 1 from public.social_asset_reviews where author_id = uid
  );
end;
$$;

create or replace function public.toggle_review_vote(
  p_review_id uuid,
  p_vote text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prev text;
  row public.social_asset_reviews;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_vote not in ('agree', 'disagree') then raise exception 'Invalid vote'; end if;

  select * into row from public.social_asset_reviews where id = p_review_id;
  if row.id is null then raise exception 'Review not found'; end if;

  select vote into prev
  from public.social_asset_review_votes
  where review_id = p_review_id and user_id = uid;

  if prev = p_vote then
    delete from public.social_asset_review_votes where review_id = p_review_id and user_id = uid;
  elsif prev is not null then
    update public.social_asset_review_votes
    set vote = p_vote
    where review_id = p_review_id and user_id = uid;
  else
    insert into public.social_asset_review_votes (review_id, user_id, vote)
    values (p_review_id, uid, p_vote);
  end if;

  return public.asset_review_row_to_json(row);
end;
$$;

create or replace function public.add_review_comment(
  p_review_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  comment_row public.social_asset_review_comments;
  review_row public.social_asset_reviews;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.social_asset_reviews where id = p_review_id) then
    raise exception 'Review not found';
  end if;

  insert into public.social_asset_review_comments (review_id, author_id, body, parent_id)
  values (p_review_id, uid, trim(p_body), p_parent_id)
  returning * into comment_row;

  select * into review_row from public.social_asset_reviews where id = p_review_id;
  return public.asset_review_row_to_json(review_row);
end;
$$;

create or replace function public.increment_review_share(p_review_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.social_asset_reviews;
begin
  update public.social_asset_reviews
  set share_count = share_count + 1
  where id = p_review_id
  returning * into row;

  if row.id is null then raise exception 'Review not found'; end if;
  return public.asset_review_row_to_json(row);
end;
$$;

-- Grants
revoke all on function public.social_post_row_to_json(public.social_posts) from public;
revoke all on function public.asset_review_row_to_json(public.social_asset_reviews) from public;

grant execute on function public.create_social_post(text, text, text, jsonb, jsonb, jsonb, text[]) to authenticated;
grant execute on function public.list_feed_posts(integer, integer) to authenticated;
grant execute on function public.get_social_post(uuid) to authenticated;
grant execute on function public.toggle_post_like(uuid) to authenticated;
grant execute on function public.add_post_comment(uuid, text, uuid) to authenticated;
grant execute on function public.upsert_asset_review(text, text, smallint, text) to authenticated;
grant execute on function public.list_asset_reviews(text, text) to authenticated;
grant execute on function public.list_reviews_by_author(uuid) to authenticated;
grant execute on function public.get_user_asset_review(text, text) to authenticated;
grant execute on function public.has_community_reviews_access() to authenticated;
grant execute on function public.toggle_review_vote(uuid, text) to authenticated;
grant execute on function public.add_review_comment(uuid, text, uuid) to authenticated;
grant execute on function public.increment_review_share(uuid) to authenticated;
