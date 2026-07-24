-- AMC profile avatars (logo) + disclaimer bio for seeded AMC users.

update public.social_profiles sp
set
  avatar_url = l.logo_icon_url,
  bio = 'Account is operated by individual not affiliated with the AMC and user should verify information before taking any investment decision'
from public.social_amc_logos l
where sp.display_name = l.mf_name
  and sp.bio ilike '%Mutual fund AMC%';

create or replace function public.seed_amc_auth_user(p_username text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_logo text;
  v_bio text := 'Account is operated by individual not affiliated with the AMC and user should verify information before taking any investment decision';
begin
  if p_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid username: %', p_username;
  end if;

  select logo_icon_url into v_logo
  from public.social_amc_logos
  where mf_name = p_display_name
  limit 1;

  select user_id into v_id from public.social_profiles where lower(username) = lower(p_username);
  if v_id is not null then
    update public.social_profiles
      set display_name = p_display_name,
          bio = v_bio,
          avatar_url = coalesce(v_logo, avatar_url)
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
        bio = v_bio,
        avatar_url = v_logo
    where user_id = v_id;

  return v_id;
end;
$$;

revoke all on function public.seed_amc_auth_user(text, text) from public;
revoke all on function public.seed_amc_auth_user(text, text) from anon, authenticated;
grant execute on function public.seed_amc_auth_user(text, text) to service_role;
