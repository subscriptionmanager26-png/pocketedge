-- Replace waitlist with a simple referral program.

-- ---------------------------------------------------------------------------
-- Referrals ledger (migrated from waitlist_referrals)
-- ---------------------------------------------------------------------------

create table if not exists public.user_referrals (
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referee_id uuid not null references auth.users (id) on delete cascade,
  referral_code text,
  created_at timestamptz not null default now(),
  constraint user_referrals_referee_unique unique (referee_id),
  constraint user_referrals_no_self check (referrer_id <> referee_id)
);

create index if not exists user_referrals_referrer_idx
  on public.user_referrals (referrer_id);

insert into public.user_referrals (referrer_id, referee_id, referral_code, created_at)
select referrer_id, referee_id, referral_code, created_at
from public.waitlist_referrals
on conflict (referee_id) do nothing;

-- ---------------------------------------------------------------------------
-- App members (replaces waitlist_members — no ranks or access gates)
-- ---------------------------------------------------------------------------

create table if not exists public.app_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  joined_at timestamptz not null default now(),
  referred_by uuid references auth.users (id) on delete set null
);

create index if not exists app_members_joined_at_idx
  on public.app_members (joined_at asc);

insert into public.app_members (user_id, email, display_name, joined_at, referred_by)
select user_id, email, display_name, joined_at, referred_by
from public.waitlist_members
on conflict (user_id) do nothing;

alter table public.user_referrals enable row level security;
alter table public.app_members enable row level security;

create policy "user_referrals_select_own"
  on public.user_referrals for select
  to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid());

create policy "app_members_select_own"
  on public.app_members for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.record_app_signup(p_referral_code text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  user_name text;
  existing record;
  v_referrer_id uuid;
  ref_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into existing from public.app_members where user_id = uid;

  if found then
    select count(*)::integer into ref_count
    from public.user_referrals ur
    where ur.referrer_id = uid;

    return json_build_object(
      'status', 'already_joined',
      'referral_count', ref_count,
      'referred_by', existing.referred_by
    );
  end if;

  select u.email,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
  into user_email, user_name
  from auth.users u
  where u.id = uid;

  v_referrer_id := null;
  if p_referral_code is not null and trim(p_referral_code) <> '' and trim(p_referral_code) <> uid::text then
    begin
      v_referrer_id := trim(p_referral_code)::uuid;
    exception when others then
      v_referrer_id := null;
    end;
  end if;

  if v_referrer_id is not null and not exists (
    select 1 from public.app_members where user_id = v_referrer_id
  ) then
    v_referrer_id := null;
  end if;

  insert into public.app_members (user_id, email, display_name, referred_by)
  values (uid, user_email, user_name, v_referrer_id);

  if v_referrer_id is not null then
    insert into public.user_referrals (referrer_id, referee_id, referral_code)
    values (v_referrer_id, uid, p_referral_code)
    on conflict (referee_id) do nothing;
  end if;

  return json_build_object(
    'status', 'joined',
    'referral_count', 0,
    'referred_by', v_referrer_id
  );
end;
$$;

create or replace function public.get_my_referral_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  member record;
  ref_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into member from public.app_members where user_id = uid;

  if not found then
    raise exception 'Not registered';
  end if;

  select count(*)::integer into ref_count
  from public.user_referrals ur
  where ur.referrer_id = uid;

  return json_build_object(
    'referral_count', ref_count,
    'referred_by', member.referred_by
  );
end;
$$;

revoke all on function public.record_app_signup(text) from public;
grant execute on function public.record_app_signup(text) to authenticated;
revoke all on function public.get_my_referral_stats() from public;
grant execute on function public.get_my_referral_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Drop waitlist artifacts
-- ---------------------------------------------------------------------------

drop trigger if exists link_waitlist_confirmed_on_member on public.waitlist_members;
drop function if exists public.link_waitlist_confirmed_user();
drop function if exists public.recalculate_waitlist_ranks();
drop function if exists public.is_my_access_confirmed();
drop function if exists public.enroll_waitlist_member(text);
drop function if exists public.get_my_waitlist_status();
drop function if exists public.join_waitlist(text, text);

drop table if exists public.waitlist_confirmed;
drop table if exists public.waitlist_referrals;
drop table if exists public.waitlist_settings;
drop table if exists public.waitlist_members;
drop table if exists public.waitlist_signups;

drop sequence if exists public.waitlist_signup_order_seq;
