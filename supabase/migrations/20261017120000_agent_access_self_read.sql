-- Users may read their own agent_access flag via the Supabase client (RLS already allows select).

-- Prevent clients from self-granting via UPDATE (server / service role only).
create or replace function public.social_profiles_guard_agent_access()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.agent_access is distinct from old.agent_access then
    if current_setting('role', true) is distinct from 'service_role' then
      new.agent_access := old.agent_access;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists social_profiles_guard_agent_access on public.social_profiles;
create trigger social_profiles_guard_agent_access
  before update on public.social_profiles
  for each row
  execute function public.social_profiles_guard_agent_access();
