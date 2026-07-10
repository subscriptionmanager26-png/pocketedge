-- Drafts are local-only in the app. DB stores published portfolios only.
-- is_archived is reserved for a future archive feature on published portfolios.

delete from public.social_portfolios where is_draft = true;

drop policy if exists "social_portfolios_select_authenticated" on public.social_portfolios;
create policy "social_portfolios_select_authenticated"
  on public.social_portfolios for select
  to authenticated
  using (not is_archived);

drop index if exists social_portfolios_owner_idx;
create index if not exists social_portfolios_owner_idx
  on public.social_portfolios (owner_id, updated_at desc)
  where not is_archived;

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
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if coalesce(p_is_draft, false) then
    raise exception 'Draft portfolios are local-only and cannot be saved to the database';
  end if;

  if p_id is null then
    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis, is_draft,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, coalesce(p_kind, 'live'), coalesce(p_name, ''), coalesce(p_objective, ''),
      coalesce(p_thesis, ''), false,
      coalesce(p_tickers, '[]'::jsonb), coalesce(p_holdings, '[]'::jsonb), p_watchlist_base_investment
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
      holdings = coalesce(p_holdings, holdings),
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

drop function if exists public.archive_social_portfolio_draft(uuid);

create or replace function public.archive_social_portfolio(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_portfolios;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  update public.social_portfolios
  set is_archived = true, updated_at = now()
  where id = p_id and owner_id = uid and not is_draft
  returning * into row;

  if row.id is null then
    raise exception 'Published portfolio not found';
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

revoke all on function public.archive_social_portfolio(uuid) from public;
grant execute on function public.archive_social_portfolio(uuid) to authenticated;
