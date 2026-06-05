-- Auth-based waitlist with display numbers starting at 5001 (+2 per signup)

create sequence if not exists public.waitlist_signup_order_seq start with 1 increment by 1;

create table if not exists public.waitlist_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  signup_order bigint not null unique,
  waitlist_number integer not null unique,
  referral_code text,
  joined_at timestamptz not null default now()
);

create index if not exists waitlist_members_joined_at_idx on public.waitlist_members (joined_at asc);

alter table public.waitlist_members enable row level security;

create policy "members_select_own"
  on public.waitlist_members for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.enroll_waitlist_member(p_referral_code text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  order_num bigint;
  w_num integer;
  user_email text;
  user_name text;
  existing_num integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select waitlist_number into existing_num
  from public.waitlist_members
  where user_id = uid;

  if existing_num is not null then
    return json_build_object('waitlist_number', existing_num, 'status', 'already_joined');
  end if;

  select u.email,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', 'Investor')
  into user_email, user_name
  from auth.users u
  where u.id = uid;

  order_num := nextval('public.waitlist_signup_order_seq');
  w_num := 5001 + ((order_num - 1) * 2)::integer;

  insert into public.waitlist_members (user_id, email, display_name, signup_order, waitlist_number, referral_code)
  values (uid, user_email, user_name, order_num, w_num, nullif(trim(p_referral_code), ''));

  return json_build_object('waitlist_number', w_num, 'status', 'joined');
end;
$$;

revoke all on function public.enroll_waitlist_member(text) from public;
grant execute on function public.enroll_waitlist_member(text) to authenticated;
