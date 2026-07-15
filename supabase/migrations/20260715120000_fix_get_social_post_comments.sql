-- get_social_post used invalid `json || json` (no such operator),
-- so loading a post with comments always failed after add_post_comment.
-- Comments were saved, but the client rolled back UI and could not reload them.

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
  payload jsonb;
  comments jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into row from public.social_posts where id = p_post_id;
  if row.id is null then raise exception 'Post not found'; end if;

  payload := public.social_post_row_to_json(row)::jsonb;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'author_id', c.author_id,
        'body', c.body,
        'parent_id', c.parent_id,
        'created_at', c.created_at
      )
      order by c.created_at asc
    ),
    '[]'::jsonb
  )
  into comments
  from public.social_post_comments c
  where c.post_id = p_post_id;

  return (payload || jsonb_build_object('comments', comments))::json;
end;
$$;

grant execute on function public.get_social_post(uuid) to authenticated;
