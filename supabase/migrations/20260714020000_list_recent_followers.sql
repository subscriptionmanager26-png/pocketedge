-- Recent followers with timestamps for activity / notifications.

create or replace function public.list_recent_followers(
  p_user_id uuid,
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
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  items json;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_user_id is null then
    return json_build_object('items', '[]'::json);
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'follower_id', f.follower_id,
        'created_at', f.created_at
      )
      order by f.created_at desc
    ),
    '[]'::json
  )
  into items
  from (
    select follower_id, created_at
    from public.social_follows
    where followee_id = p_user_id
    order by created_at desc
    limit lim
  ) f;

  return json_build_object('items', coalesce(items, '[]'::json));
end;
$$;

revoke all on function public.list_recent_followers(uuid, integer) from public;
grant execute on function public.list_recent_followers(uuid, integer) to authenticated;
