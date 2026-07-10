-- Social RPCs, portfolio CRUD (no delete), archive drafts only.

alter table public.social_portfolios
  add column if not exists is_archived boolean not null default false;

drop policy if exists "social_portfolios_delete_own" on public.social_portfolios;

drop index if exists social_portfolios_owner_idx;
create index if not exists social_portfolios_owner_idx
  on public.social_portfolios (owner_id, updated_at desc)
  where not is_draft and not is_archived;

drop policy if exists "social_portfolios_select_authenticated" on public.social_portfolios;
create policy "social_portfolios_select_authenticated"
  on public.social_portfolios for select
  to authenticated
  using ((not is_draft and not is_archived) or owner_id = auth.uid());

create or replace function public.social_sanitize_username(p_raw text)
returns text
language plpgsql
as $$
declare
  base text := lower(regexp_replace(coalesce(p_raw, ''), '[^a-z0-9_]', '', 'g'));
  candidate text;
  n integer := 0;
begin
  if base = '' or char_length(base) < 3 then
    base := 'investor';
  end if;
  base := left(base, 30);
  candidate := base;
  while exists (select 1 from public.social_profiles where lower(username) = candidate) loop
    n := n + 1;
    candidate := left(base, greatest(1, 30 - char_length(n::text))) || n::text;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_social_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_local text;
  suggested text;
begin
  email_local := split_part(coalesce(new.email, ''), '@', 1);
  suggested := public.social_sanitize_username(email_local);
  insert into public.social_profiles (user_id, username, display_name)
  values (
    new.id,
    suggested,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Investor')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_social_profile on auth.users;
create trigger on_auth_user_created_social_profile
  after insert on auth.users
  for each row execute function public.handle_new_social_user();

create or replace function public.get_social_profile_public(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.social_profiles;
begin
  select * into row from public.social_profiles where lower(username) = lower(trim(p_username));
  if row.user_id is null then return null; end if;
  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'avatar_url', row.avatar_url
  );
end;
$$;

revoke all on function public.get_social_profile_public(text) from public;
grant execute on function public.get_social_profile_public(text) to anon, authenticated;

create or replace function public.get_social_profile(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_profiles;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into row from public.social_profiles where lower(username) = lower(trim(p_username));
  if row.user_id is null then return null; end if;
  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'location', row.location,
    'focus', row.focus,
    'created_at', row.created_at,
    'updated_at', row.updated_at,
    'is_self', row.user_id = uid
  );
end;
$$;

revoke all on function public.get_social_profile(text) from public;
grant execute on function public.get_social_profile(text) to authenticated;

create or replace function public.ensure_social_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u auth.users;
  row public.social_profiles;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into row from public.social_profiles where user_id = uid;
  if row.user_id is not null then
    return json_build_object(
      'user_id', row.user_id,
      'username', row.username,
      'display_name', row.display_name,
      'bio', row.bio,
      'avatar_url', row.avatar_url,
      'location', row.location,
      'focus', row.focus,
      'is_self', true
    );
  end if;
  select * into u from auth.users where id = uid;
  insert into public.social_profiles (user_id, username, display_name)
  values (
    uid,
    public.social_sanitize_username(split_part(coalesce(u.email, ''), '@', 1)),
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
  )
  returning * into row;
  return json_build_object(
    'user_id', row.user_id,
    'username', row.username,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'location', row.location,
    'focus', row.focus,
    'is_self', true
  );
end;
$$;

revoke all on function public.ensure_social_profile() from public;
grant execute on function public.ensure_social_profile() to authenticated;

create or replace function public.map_social_portfolio_row(p public.social_portfolios)
returns json
language sql
immutable
as $$
  select json_build_object(
    'id', p.id,
    'owner_id', p.owner_id,
    'kind', p.kind,
    'name', p.name,
    'objective', p.objective,
    'thesis', p.thesis,
    'is_draft', p.is_draft,
    'is_archived', p.is_archived,
    'source_portfolio_id', p.source_portfolio_id,
    'source_user_id', p.source_user_id,
    'source_portfolio_name', p.source_portfolio_name,
    'source_user_name', p.source_user_name,
    'watchlist_base_investment', p.watchlist_base_investment,
    'tickers', p.tickers,
    'holdings', p.holdings,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

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

  if p_id is null then
    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis, is_draft,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, coalesce(p_kind, 'live'), coalesce(p_name, ''), coalesce(p_objective, ''),
      coalesce(p_thesis, ''), coalesce(p_is_draft, false),
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
      is_draft = coalesce(p_is_draft, is_draft),
      tickers = coalesce(p_tickers, tickers),
      holdings = coalesce(p_holdings, holdings),
      watchlist_base_investment = coalesce(p_watchlist_base_investment, watchlist_base_investment),
      updated_at = now()
    where id = p_id and owner_id = uid
    returning * into row;

    if row.id is null then
      raise exception 'Portfolio not found or not owned';
    end if;
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

revoke all on function public.upsert_social_portfolio(uuid, text, text, text, text, boolean, jsonb, jsonb, numeric) from public;
grant execute on function public.upsert_social_portfolio(uuid, text, text, text, text, boolean, jsonb, jsonb, numeric) to authenticated;

create or replace function public.archive_social_portfolio_draft(p_id uuid)
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
  where id = p_id and owner_id = uid and is_draft = true
  returning * into row;

  if row.id is null then
    raise exception 'Draft portfolio not found';
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

revoke all on function public.archive_social_portfolio_draft(uuid) from public;
grant execute on function public.archive_social_portfolio_draft(uuid) to authenticated;
