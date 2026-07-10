-- Engagement RPCs for social portfolios.

create or replace function public.get_portfolio_engagement(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  liked boolean := false;
  copied boolean := false;
  unread integer := 0;
  last_read timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select owner_id into owner from public.social_portfolios where id = p_portfolio_id;
  if owner is null then raise exception 'Portfolio not found'; end if;

  select exists (
    select 1 from public.social_portfolio_likes where portfolio_id = p_portfolio_id and user_id = uid
  ) into liked;
  select exists (
    select 1 from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid
  ) into copied;

  if owner = uid then
    select last_read_at into last_read
    from public.social_portfolio_comment_reads
    where portfolio_id = p_portfolio_id and user_id = uid;
    select count(*)::integer into unread
    from public.social_portfolio_comments c
    where c.portfolio_id = p_portfolio_id
      and c.author_id <> uid
      and (last_read is null or c.created_at > last_read);
  end if;

  return json_build_object(
    'likes', (select count(*)::integer from public.social_portfolio_likes where portfolio_id = p_portfolio_id),
    'shares', (select count(*)::integer from public.social_portfolio_shares where portfolio_id = p_portfolio_id),
    'copies', (select count(*)::integer from public.social_portfolio_copies where portfolio_id = p_portfolio_id),
    'comment_count', (select count(*)::integer from public.social_portfolio_comments where portfolio_id = p_portfolio_id),
    'liked', liked,
    'copied', copied,
    'unread_comments', case when owner = uid then unread else 0 end
  );
end;
$$;

revoke all on function public.get_portfolio_engagement(uuid) from public;
grant execute on function public.get_portfolio_engagement(uuid) to authenticated;

create or replace function public.toggle_portfolio_like(p_portfolio_id uuid)
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
  if exists (select 1 from public.social_portfolio_likes where portfolio_id = p_portfolio_id and user_id = uid) then
    delete from public.social_portfolio_likes where portfolio_id = p_portfolio_id and user_id = uid;
    now_liked := false;
  else
    insert into public.social_portfolio_likes (portfolio_id, user_id) values (p_portfolio_id, uid);
    now_liked := true;
  end if;
  return json_build_object('liked', now_liked);
end;
$$;

revoke all on function public.toggle_portfolio_like(uuid) from public;
grant execute on function public.toggle_portfolio_like(uuid) to authenticated;

create or replace function public.toggle_portfolio_copy(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_copied boolean;
  src public.social_portfolios;
  copy_id uuid;
  src_owner_name text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid) then
    delete from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid;
    now_copied := false;
    copy_id := null;
  else
    select * into src from public.social_portfolios where id = p_portfolio_id and not is_archived;
    if src.id is null then raise exception 'Portfolio not found'; end if;
    if src.owner_id = uid then raise exception 'Cannot copy own portfolio'; end if;

    select display_name into src_owner_name from public.social_profiles where user_id = src.owner_id;

    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis,
      source_portfolio_id, source_user_id, source_portfolio_name, source_user_name,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, src.kind, src.name, src.objective, src.thesis,
      src.id, src.owner_id, src.name, src_owner_name,
      src.tickers, src.holdings, src.watchlist_base_investment
    )
    returning id into copy_id;

    insert into public.social_portfolio_copies (portfolio_id, user_id, copied_portfolio_id)
    values (p_portfolio_id, uid, copy_id);
    now_copied := true;
  end if;

  return json_build_object('copied', now_copied, 'copied_portfolio_id', copy_id);
end;
$$;

revoke all on function public.toggle_portfolio_copy(uuid) from public;
grant execute on function public.toggle_portfolio_copy(uuid) to authenticated;

create or replace function public.record_portfolio_share(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inserted boolean;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  with ins as (
    insert into public.social_portfolio_shares (portfolio_id, user_id)
    values (p_portfolio_id, uid)
    on conflict do nothing
    returning 1
  )
  select exists (select 1 from ins) into inserted;
  return json_build_object('recorded', inserted);
end;
$$;

revoke all on function public.record_portfolio_share(uuid) from public;
grant execute on function public.record_portfolio_share(uuid) to authenticated;

create or replace function public.add_portfolio_comment(p_portfolio_id uuid, p_body text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_portfolio_comments;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  insert into public.social_portfolio_comments (portfolio_id, author_id, body)
  values (p_portfolio_id, uid, trim(p_body))
  returning * into row;
  return json_build_object(
    'id', row.id,
    'portfolio_id', row.portfolio_id,
    'author_id', row.author_id,
    'body', row.body,
    'created_at', row.created_at
  );
end;
$$;

revoke all on function public.add_portfolio_comment(uuid, text) from public;
grant execute on function public.add_portfolio_comment(uuid, text) to authenticated;

create or replace function public.mark_portfolio_comments_read(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select owner_id into owner from public.social_portfolios where id = p_portfolio_id;
  if owner is null or owner <> uid then
    raise exception 'Only portfolio owner can mark comments read';
  end if;
  insert into public.social_portfolio_comment_reads (portfolio_id, user_id, last_read_at)
  values (p_portfolio_id, uid, now())
  on conflict (portfolio_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_portfolio_comments_read(uuid) from public;
grant execute on function public.mark_portfolio_comments_read(uuid) to authenticated;

-- Backfill social profiles for existing auth users.
insert into public.social_profiles (user_id, username, display_name)
select
  u.id,
  public.social_sanitize_username(split_part(coalesce(u.email, ''), '@', 1)),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
from auth.users u
where not exists (select 1 from public.social_profiles sp where sp.user_id = u.id)
on conflict (user_id) do nothing;
