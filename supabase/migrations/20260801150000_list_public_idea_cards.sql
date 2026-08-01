-- Public Ideas hub cards: name, thesis, maker display name, 1D only (no total return).

create or replace function public.portfolio_day_return_pct(p_holdings jsonb)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with redacted as (
    select value as h
    from jsonb_array_elements(
      public.redact_holdings_for_public(coalesce(p_holdings, '[]'::jsonb), 'live'::text)
    )
  ),
  weighted as (
    select
      coalesce(sum(
        coalesce(nullif(h->>'weightPct', '')::numeric, 0)
        * coalesce(
            nullif(h->>'changePct', '')::numeric,
            nullif(h->>'change_pct', '')::numeric
          )
      ), 0) as weighted_sum,
      coalesce(sum(coalesce(nullif(h->>'weightPct', '')::numeric, 0)), 0) as weight_sum
    from redacted
    where coalesce(nullif(h->>'weightPct', '')::numeric, 0) > 0
      and coalesce(
        nullif(h->>'changePct', '')::numeric,
        nullif(h->>'change_pct', '')::numeric
      ) is not null
  )
  select case
    when weight_sum > 0 then weighted_sum / weight_sum
    else null
  end
  from weighted;
$$;

revoke all on function public.portfolio_day_return_pct(jsonb) from public, anon, authenticated;

create or replace function public.list_public_idea_cards(
  p_limit integer default 40,
  p_offset integer default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim int := greatest(1, least(coalesce(p_limit, 40), 80));
  off int := greatest(0, coalesce(p_offset, 0));
begin
  return coalesce(
    (
      select json_agg(row_json order by sort_updated desc)
      from (
        select
          json_build_object(
            'portfolio_id', p.id,
            'name', p.name,
            'thesis', coalesce(p.thesis, ''),
            'owner_id', sp.user_id,
            'owner_name', coalesce(nullif(trim(sp.display_name), ''), sp.username),
            'day_return_pct', public.portfolio_day_return_pct(p.holdings),
            'updated_at', p.updated_at
          ) as row_json,
          p.updated_at as sort_updated
        from public.social_portfolios p
        join public.social_profiles sp on sp.user_id = p.owner_id
        where not p.is_archived
          and not p.is_draft
        order by p.updated_at desc
        offset off
        limit lim
      ) ranked
    ),
    '[]'::json
  );
end;
$$;

revoke all on function public.list_public_idea_cards(integer, integer) from public;
grant execute on function public.list_public_idea_cards(integer, integer) to anon, authenticated;
