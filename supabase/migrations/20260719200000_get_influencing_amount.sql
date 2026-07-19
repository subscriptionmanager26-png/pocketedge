-- Sum of published portfolio sizes across a user's followers.
-- "Influencing" = sum over followers of (sum of holding values in their published portfolios).

create or replace function public.get_influencing_amount(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(follower_total), 0)
  from (
    select coalesce((
      select sum(holding_value)
      from public.social_portfolios p
      cross join lateral (
        select coalesce(sum(coalesce(nullif(h->>'value', '')::numeric, 0)), 0) as holding_value
        from jsonb_array_elements(coalesce(p.holdings, '[]'::jsonb)) h
      ) hv
      where p.owner_id = f.follower_id
        and not p.is_draft
        and not coalesce(p.is_archived, false)
    ), 0) as follower_total
    from public.social_follows f
    where f.followee_id = p_user_id
  ) s;
$$;

revoke all on function public.get_influencing_amount(uuid) from public;
grant execute on function public.get_influencing_amount(uuid) to authenticated;
