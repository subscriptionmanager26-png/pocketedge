-- Open full app access for all waitlist members (current and future).

insert into public.waitlist_confirmed (email, user_id, confirmed_at)
select lower(trim(wm.email)), wm.user_id, now()
from public.waitlist_members wm
on conflict (email) do update
set
  user_id = coalesce(excluded.user_id, public.waitlist_confirmed.user_id),
  confirmed_at = coalesce(public.waitlist_confirmed.confirmed_at, excluded.confirmed_at);

-- Link any confirmed rows that only had email pre-auth.
update public.waitlist_confirmed wc
set user_id = wm.user_id
from public.waitlist_members wm
where wc.user_id is null
  and lower(trim(wc.email)) = lower(trim(wm.email));

create or replace function public.link_waitlist_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.waitlist_confirmed (email, user_id, confirmed_at)
  values (lower(trim(new.email)), new.user_id, now())
  on conflict (email) do update
  set user_id = coalesce(excluded.user_id, public.waitlist_confirmed.user_id);

  return new;
end;
$$;
