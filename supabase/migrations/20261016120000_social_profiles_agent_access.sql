-- Per-user flag: may use Pocketedge AI / Personal Agents (checked server-side on /api/agent/*).

alter table public.social_profiles
  add column if not exists agent_access boolean not null default false;

comment on column public.social_profiles.agent_access is
  'When true, user may use www.pocketedge.in/ai (Personal Agents). Set via SQL or internal admin tools.';

create index if not exists social_profiles_agent_access_idx
  on public.social_profiles (agent_access)
  where agent_access = true;
