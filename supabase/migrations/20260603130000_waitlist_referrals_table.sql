-- Explicit referrer ↔ referee ledger (source of truth for rank calculation)

create table if not exists public.waitlist_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referee_id uuid not null references auth.users (id) on delete cascade,
  referral_code text,
  created_at timestamptz not null default now(),
  constraint waitlist_referrals_no_self check (referrer_id <> referee_id),
  constraint waitlist_referrals_referee_unique unique (referee_id)
);

create index if not exists waitlist_referrals_referrer_idx
  on public.waitlist_referrals (referrer_id);

create index if not exists waitlist_referrals_created_at_idx
  on public.waitlist_referrals (created_at asc);

insert into public.waitlist_referrals (referrer_id, referee_id, referral_code, created_at)
select wm.referred_by, wm.user_id, wm.referral_code, wm.joined_at
from public.waitlist_members wm
where wm.referred_by is not null
on conflict (referee_id) do nothing;

update public.waitlist_members wm
set referral_count = coalesce(r.cnt, 0)
from (
  select referrer_id, count(*)::integer as cnt
  from public.waitlist_referrals
  group by referrer_id
) r
where wm.user_id = r.referrer_id;

alter table public.waitlist_referrals enable row level security;

create policy "referrals_select_as_referrer"
  on public.waitlist_referrals for select
  to authenticated
  using (auth.uid() = referrer_id);

create policy "referrals_select_as_referee"
  on public.waitlist_referrals for select
  to authenticated
  using (auth.uid() = referee_id);

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
    wm.user_id,
    greatest(
      1,
      wm.waitlist_number - (
        coalesce((
          select count(*)::integer
          from public.waitlist_referrals wr
          where wr.referrer_id = wm.user_id
        ), 0) * 10
      )
    ),
    wm.joined_at
  from public.waitlist_members wm;

  -- Step 2: assign effective ranks one-by-one in priority order.
  -- Lower target rank goes first; ties broken by earlier signup.
  -- Each person claims the lowest available slot >= their target,
  -- accounting for slots already claimed earlier in this same run.
  for r in
    select * from _rank_plan
    order by target_rank asc, joined_at asc
  loop
    candidate := r.target_rank;
    loop
      select exists (
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

  -- Step 3: commit all new ranks in one update
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
  v_referrer_id uuid;
  ref_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into existing
  from public.waitlist_members
  where user_id = uid;

  if found then
    select count(*)::integer into ref_count
    from public.waitlist_referrals wr
    where wr.referrer_id = uid;

    return json_build_object(
      'status', 'already_joined',
      'waitlist_number', existing.waitlist_number,
      'effective_rank', existing.effective_rank,
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
    select 1 from public.waitlist_members where user_id = v_referrer_id
  ) then
    v_referrer_id := null;
  end if;

  order_num := nextval('public.waitlist_signup_order_seq');
  base_num := 5001 + ((order_num - 1) * 2)::integer;

  insert into public.waitlist_members (
    user_id, email, display_name, signup_order, waitlist_number,
    effective_rank, referred_by, referral_code
  )
  values (
    uid, user_email, user_name, order_num, base_num,
    base_num, v_referrer_id, p_referral_code
  );

  if v_referrer_id is not null then
    insert into public.waitlist_referrals (referrer_id, referee_id, referral_code)
    values (v_referrer_id, uid, p_referral_code)
    on conflict (referee_id) do nothing;

    update public.waitlist_members wm
    set referral_count = (
      select count(*)::integer
      from public.waitlist_referrals wr
      where wr.referrer_id = v_referrer_id
    )
    where wm.user_id = v_referrer_id;
  end if;

  return json_build_object(
    'status', 'joined',
    'waitlist_number', base_num,
    'effective_rank', base_num,
    'referral_count', 0,
    'referred_by', v_referrer_id
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
  ref_count integer;
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

  select count(*)::integer into ref_count
  from public.waitlist_referrals wr
  where wr.referrer_id = uid;

  return json_build_object(
    'waitlist_number', member.waitlist_number,
    'effective_rank', member.effective_rank,
    'referral_count', ref_count,
    'referred_by', member.referred_by,
    'next_rank_update_at', settings.next_rank_update_at,
    'last_rank_update_at', settings.last_rank_update_at
  );
end;
$$;
