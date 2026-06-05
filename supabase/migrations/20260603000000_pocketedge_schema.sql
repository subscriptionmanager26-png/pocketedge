-- Email waitlist for landing page

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  referral_code text,
  created_at timestamptz not null default now()
);

create unique index waitlist_signups_email_lower_idx on public.waitlist_signups (lower(trim(email)));

create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at asc);

alter table public.waitlist_signups enable row level security;

create policy "anon_insert_waitlist"
  on public.waitlist_signups for insert
  to anon, authenticated
  with check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  );

create or replace function public.join_waitlist(p_email text, p_referral_code text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  signup_id uuid;
begin
  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required';
  end if;

  insert into public.waitlist_signups (email, referral_code)
  values (normalized_email, nullif(trim(p_referral_code), ''))
  on conflict do nothing
  returning id into signup_id;

  if signup_id is null then
    select id into signup_id from public.waitlist_signups where lower(trim(email)) = normalized_email;
    return json_build_object('status', 'already_joined', 'id', signup_id);
  end if;

  return json_build_object('status', 'joined', 'id', signup_id);
end;
$$;

revoke all on function public.join_waitlist(text, text) from public;
grant execute on function public.join_waitlist(text, text) to anon, authenticated;
