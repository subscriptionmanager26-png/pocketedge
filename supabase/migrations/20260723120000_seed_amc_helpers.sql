-- AMC seed helpers (service_role only). Used to create no-email auth users
-- for Mutual Fund AMCs and upsert per-scheme watchlist portfolios.

create or replace function public.seed_amc_auth_user(p_username text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  if p_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid username: %', p_username;
  end if;

  select user_id into v_id from public.social_profiles where lower(username) = lower(p_username);
  if v_id is not null then
    update public.social_profiles
      set display_name = p_display_name,
          bio = coalesce(nullif(bio, ''), 'Mutual fund AMC · scheme holdings published as watchlists')
      where user_id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    null,
    null,
    now(),
    jsonb_build_object('provider', 'amc_seed', 'providers', jsonb_build_array('amc_seed')),
    jsonb_build_object('full_name', p_display_name, 'amc_seed', true, 'username', p_username),
    now(), now(),
    '', '', '', '',
    false, false
  );

  update public.social_profiles
    set username = p_username,
        display_name = p_display_name,
        bio = 'Mutual fund AMC · scheme holdings published as watchlists'
    where user_id = v_id;

  return v_id;
end;
$$;

revoke all on function public.seed_amc_auth_user(text, text) from public;
revoke all on function public.seed_amc_auth_user(text, text) from anon, authenticated;
grant execute on function public.seed_amc_auth_user(text, text) to service_role;

create or replace function public.seed_amc_watchlists(p_username text, p_portfolios jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_item jsonb;
  v_id uuid;
  v_inserted int := 0;
  v_updated int := 0;
  v_objective text;
begin
  select user_id into v_owner
  from public.social_profiles
  where lower(username) = lower(p_username);

  if v_owner is null then
    raise exception 'unknown AMC username: %', p_username;
  end if;

  if p_portfolios is null or jsonb_typeof(p_portfolios) <> 'array' then
    raise exception 'p_portfolios must be a json array';
  end if;

  for v_item in select * from jsonb_array_elements(p_portfolios)
  loop
    v_objective := coalesce(v_item->>'objective', '');

    select id into v_id
    from public.social_portfolios
    where owner_id = v_owner
      and kind = 'watchlist'
      and objective = v_objective
    limit 1;

    if v_id is null then
      insert into public.social_portfolios (
        owner_id, kind, name, objective, thesis,
        is_draft, is_archived, watchlist_base_investment,
        tickers, holdings
      ) values (
        v_owner,
        'watchlist',
        coalesce(nullif(v_item->>'name', ''), 'Untitled scheme'),
        v_objective,
        coalesce(v_item->>'thesis', ''),
        false,
        false,
        10000,
        coalesce(v_item->'tickers', '[]'::jsonb),
        coalesce(v_item->'holdings', '[]'::jsonb)
      );
      v_inserted := v_inserted + 1;
    else
      update public.social_portfolios
      set name = coalesce(nullif(v_item->>'name', ''), name),
          thesis = coalesce(v_item->>'thesis', thesis),
          tickers = coalesce(v_item->'tickers', tickers),
          holdings = coalesce(v_item->'holdings', holdings),
          watchlist_base_investment = 10000,
          is_draft = false,
          is_archived = false,
          updated_at = now()
      where id = v_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'username', p_username,
    'owner_id', v_owner,
    'inserted', v_inserted,
    'updated', v_updated
  );
end;
$$;

revoke all on function public.seed_amc_watchlists(text, jsonb) from public;
revoke all on function public.seed_amc_watchlists(text, jsonb) from anon, authenticated;
grant execute on function public.seed_amc_watchlists(text, jsonb) to service_role;
