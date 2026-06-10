-- Confirmed waitlist members who can access the full app.
-- Everyone else stays on the waitlist page after sign-in.

create table if not exists public.waitlist_confirmed (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid unique references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now()
);

create index if not exists waitlist_confirmed_user_id_idx
  on public.waitlist_confirmed (user_id);

alter table public.waitlist_confirmed enable row level security;

create policy "Users can read own confirmation"
  on public.waitlist_confirmed
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

create or replace function public.link_waitlist_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.waitlist_confirmed wc
  set user_id = new.user_id
  where wc.user_id is null
    and lower(wc.email) = lower(
      (select email from auth.users where id = new.user_id)
    );
  return new;
end;
$$;

drop trigger if exists link_waitlist_confirmed_on_member on public.waitlist_members;
create trigger link_waitlist_confirmed_on_member
  after insert on public.waitlist_members
  for each row
  execute function public.link_waitlist_confirmed_user();

create or replace function public.is_my_access_confirmed()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.waitlist_confirmed wc
    join auth.users u on u.id = auth.uid()
    where lower(wc.email) = lower(u.email)
       or wc.user_id = auth.uid()
  );
$$;

grant execute on function public.is_my_access_confirmed() to authenticated;

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
  access_confirmed boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select public.is_my_access_confirmed() into access_confirmed;

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
    'last_rank_update_at', settings.last_rank_update_at,
    'access_confirmed', access_confirmed
  );
end;
$$;

insert into public.waitlist_confirmed (email)
values ('agarwalkushagra2603@gmail.com')
on conflict (email) do nothing;

-- Link if the user already exists in auth.
update public.waitlist_confirmed wc
set user_id = u.id
from auth.users u
where lower(wc.email) = lower(u.email)
  and wc.user_id is null;
