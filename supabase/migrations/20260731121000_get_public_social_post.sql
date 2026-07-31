-- Public post detail for logged-out Shell (deep links + comments read-only).

create or replace function public.get_public_social_post(p_post_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.social_posts;
  payload json;
  comments json;
begin
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

  return (payload::jsonb || jsonb_build_object('comments', coalesce(comments, '[]'::json)::jsonb))::json;
end;
$$;

revoke all on function public.get_public_social_post(uuid) from public;
grant execute on function public.get_public_social_post(uuid) to anon, authenticated;
