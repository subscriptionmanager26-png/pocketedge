-- Referral tracking + 3-hour rank recalculation

alter table public.waitlist_members
  add column if not exists referred_by uuid references auth.users (id),
  add column if not exists referral_count integer not null default 0,
  add column if not exists effective_rank integer;

update public.waitlist_members
set effective_rank = waitlist_number
where effective_rank is null;

alter table public.waitlist_members
  alter column effective_rank set not null;

create unique index if not exists waitlist_members_effective_rank_idx
  on public.waitlist_members (effective_rank);

create table if not exists public.waitlist_settings (
  id integer primary key default 1 check (id = 1),
  last_rank_update_at timestamptz,
  next_rank_update_at timestamptz not null default (now() + interval '3 hours')
);

insert into public.waitlist_settings (id, next_rank_update_at)
values (1, now() + interval '3 hours')
on conflict (id) do nothing;

create or replace function public.recalculate_waitlist_ranks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  candidate integer;
  taken boolean;
begin
  create temp table _rank_plan (
    user_id uuid primary key,
    target_rank integer not null,
    effective_rank integer,
    joined_at timestamptz not null
  ) on commit drop;

  insert into _rank_plan (user_id, target_rank, joined_at)
  select
    user_id,
    greatest(1, waitlist_number - (referral_count * 10)),
    joined_at
  from public.waitlist_members;

  for r in
    select * from _rank_plan
    order by target_rank asc, joined_at asc
  loop
    candidate := r.target_rank;
    loop
      select exists (
        select 1
        from public.waitlist_members wm
        where wm.effective_rank = candidate
          and wm.user_id <> r.user_id
      ) or exists (
        select 1
        from _rank_plan rp
        where rp.effective_rank = candidate
          and rp.user_id <> r.user_id
      ) into taken;

      exit when not taken;
      candidate := candidate + 1;
    end loop;

    update _rank_plan set effective_rank = candidate where user_id = r.user_id;
  end loop;

  update public.waitlist_members wm
  set effective_rank = rp.effective_rank
  from _rank_plan rp
  where wm.user_id = rp.user_id;

  update public.waitlist_settings
  set
    last_rank_update_at = now(),
    next_rank_update_at = now() + interval '3 hours'
  where id = 1;
end;
$$;

create or replace function public.enroll_waitlist_member(p_referral_code text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  order_num bigint;
  base_num integer;
  user_email text;
  user_name text;
  existing record;
  referrer_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into existing
  from public.waitlist_members
  where user_id = uid;

  if found then
    return json_build_object(
      'status', 'already_joined',
      'waitlist_number', existing.waitlist_number,
      'effective_rank', existing.effective_rank,
      'referral_count', existing.referral_count,
      'referred_by', existing.referred_by
    );
  end if;

  select u.email,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
  into user_email, user_name
  from auth.users u
  where u.id = uid;

  referrer_id := null;
  if p_referral_code is not null and trim(p_referral_code) <> '' and trim(p_referral_code) <> uid::text then
    begin
      referrer_id := trim(p_referral_code)::uuid;
    exception when others then
      referrer_id := null;
    end;
  end if;

  if referrer_id is not null and not exists (
    select 1 from public.waitlist_members where user_id = referrer_id
  ) then
    referrer_id := null;
  end if;

  order_num := nextval('public.waitlist_signup_order_seq');
  base_num := 5001 + ((order_num - 1) * 2)::integer;

  insert into public.waitlist_members (
    user_id, email, display_name, signup_order, waitlist_number,
    effective_rank, referred_by, referral_code
  )
  values (
    uid, user_email, user_name, order_num, base_num,
    base_num, referrer_id, p_referral_code
  );

  if referrer_id is not null then
    update public.waitlist_members
    set referral_count = referral_count + 1
    where user_id = referrer_id;
  end if;

  return json_build_object(
    'status', 'joined',
    'waitlist_number', base_num,
    'effective_rank', base_num,
    'referral_count', 0,
    'referred_by', referrer_id
  );
end;
$$;

create or replace function public.get_my_waitlist_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  member record;
  settings record;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into settings from public.waitlist_settings where id = 1;

  if settings.next_rank_update_at <= now() then
    perform public.recalculate_waitlist_ranks();
    select * into settings from public.waitlist_settings where id = 1;
  end if;

  select * into member from public.waitlist_members where user_id = uid;

  if not found then
    raise exception 'Not on waitlist';
  end if;

  return json_build_object(
    'waitlist_number', member.waitlist_number,
    'effective_rank', member.effective_rank,
    'referral_count', member.referral_count,
    'referred_by', member.referred_by,
    'next_rank_update_at', settings.next_rank_update_at,
    'last_rank_update_at', settings.last_rank_update_at
  );
end;
$$;

revoke all on function public.recalculate_waitlist_ranks() from public;
grant execute on function public.recalculate_waitlist_ranks() to authenticated;
revoke all on function public.get_my_waitlist_status() from public;
grant execute on function public.get_my_waitlist_status() to authenticated;
revoke all on function public.enroll_waitlist_member(text) from public;
grant execute on function public.enroll_waitlist_member(text) to authenticated;
