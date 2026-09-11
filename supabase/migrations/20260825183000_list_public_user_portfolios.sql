-- Allow logged-out visitors to load redacted portfolio cards on public profiles.

create or replace function public.list_public_user_portfolios(p_owner_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner_id is null then
    return '[]'::json;
  end if;

  return coalesce(
    (
      select json_agg(public.map_social_portfolio_row_public(row) order by row.updated_at desc)
      from public.social_portfolios row
      where row.owner_id = p_owner_id
        and not coalesce(row.is_archived, false)
        and not coalesce(row.is_draft, false)
    ),
    '[]'::json
  );
end;
$$;

revoke all on function public.list_public_user_portfolios(uuid) from public;
grant execute on function public.list_public_user_portfolios(uuid) to anon, authenticated;

comment on function public.list_public_user_portfolios(uuid) is
  'Redacted portfolio list for public profile pages (guests and signed-in viewers).';
