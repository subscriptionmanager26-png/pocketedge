-- One published live portfolio per owner; extras become watchlists.
-- Live display names converge to "{FirstName} Portfolio".
-- Copied books always land as watchlists so they never create a second live.

-- 1) Prefer a book named "My portfolio" as the keeper live; else oldest.
with ranked as (
  select
    id,
    owner_id,
    name,
    created_at,
    row_number() over (
      partition by owner_id
      order by
        case when lower(trim(name)) = 'my portfolio' then 0 else 1 end,
        created_at asc,
        id asc
    ) as rn
  from public.social_portfolios
  where kind = 'live'
    and coalesce(is_archived, false) = false
    and coalesce(is_draft, false) = false
),
extras as (
  select id from ranked where rn > 1
)
update public.social_portfolios p
set
  kind = 'watchlist',
  watchlist_base_investment = coalesce(p.watchlist_base_investment, 10000),
  updated_at = now()
where p.id in (select id from extras);

-- 2) Rename remaining lives to "{FirstName} Portfolio".
update public.social_portfolios p
set
  name = trim(
    both ' '
    from concat(
      coalesce(
        nullif(split_part(trim(coalesce(pr.display_name, '')), ' ', 1), ''),
        nullif(trim(coalesce(pr.username, '')), ''),
        'My'
      ),
      ' Portfolio'
    )
  ),
  updated_at = now()
from public.social_profiles pr
where pr.user_id = p.owner_id
  and p.kind = 'live'
  and coalesce(p.is_archived, false) = false
  and coalesce(p.is_draft, false) = false;

-- 3) Enforce at most one published live portfolio per owner.
create unique index if not exists social_portfolios_one_live_per_owner
  on public.social_portfolios (owner_id)
  where kind = 'live'
    and coalesce(is_archived, false) = false
    and coalesce(is_draft, false) = false;

-- 4) Guard upsert against a second live insert/update.
create or replace function public.upsert_social_portfolio(
  p_id uuid,
  p_kind text,
  p_name text,
  p_objective text,
  p_thesis text,
  p_is_draft boolean,
  p_tickers jsonb,
  p_holdings jsonb,
  p_watchlist_base_investment numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_portfolios;
  enriched jsonb;
  next_kind text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if coalesce(p_is_draft, false) then
    raise exception 'Draft portfolios are local-only and cannot be saved to the database';
  end if;

  enriched := public.enrich_portfolio_holdings(coalesce(p_holdings, '[]'::jsonb));
  next_kind := coalesce(p_kind, 'live');

  if next_kind = 'live' then
    if exists (
      select 1
      from public.social_portfolios sp
      where sp.owner_id = uid
        and sp.kind = 'live'
        and coalesce(sp.is_archived, false) = false
        and coalesce(sp.is_draft, false) = false
        and (p_id is null or sp.id <> p_id)
    ) then
      raise exception 'Only one live portfolio is allowed per user';
    end if;
  end if;

  if p_id is null then
    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis, is_draft,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, next_kind, coalesce(p_name, ''), coalesce(p_objective, ''),
      coalesce(p_thesis, ''), false,
      coalesce(p_tickers, '[]'::jsonb), enriched, p_watchlist_base_investment
    )
    returning * into row;
  else
    update public.social_portfolios
    set
      kind = coalesce(p_kind, kind),
      name = coalesce(p_name, name),
      objective = coalesce(p_objective, objective),
      thesis = coalesce(p_thesis, thesis),
      is_draft = false,
      tickers = coalesce(p_tickers, tickers),
      holdings = enriched,
      watchlist_base_investment = coalesce(p_watchlist_base_investment, watchlist_base_investment),
      updated_at = now()
    where id = p_id and owner_id = uid and not is_draft
    returning * into row;

    if row.id is null then
      raise exception 'Portfolio not found or not owned';
    end if;
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

-- 5) Copies always become watchlists (never a second live book).
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
      uid,
      'watchlist',
      src.name,
      src.objective,
      src.thesis,
      src.id,
      src.owner_id,
      src.name,
      src_owner_name,
      src.tickers,
      public.enrich_portfolio_holdings(src.holdings),
      coalesce(src.watchlist_base_investment, 10000)
    )
    returning id into copy_id;

    insert into public.social_portfolio_copies (portfolio_id, user_id, copied_portfolio_id)
    values (p_portfolio_id, uid, copy_id);
    now_copied := true;
  end if;

  return json_build_object('copied', now_copied, 'copied_portfolio_id', copy_id);
end;
$$;

revoke all on function public.upsert_social_portfolio(uuid, text, text, text, text, boolean, jsonb, jsonb, numeric) from public;
grant execute on function public.upsert_social_portfolio(uuid, text, text, text, text, boolean, jsonb, jsonb, numeric) to authenticated;

revoke all on function public.toggle_portfolio_copy(uuid) from public;
grant execute on function public.toggle_portfolio_copy(uuid) to authenticated;
