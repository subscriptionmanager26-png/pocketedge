-- Configure 30s index refresh cron without vault dependency.
-- This project does not have the `vault` extension available, so we use
-- a DB-stored opaque token readable only by service-role context.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.social_market_job_config (
  job_name text primary key,
  auth_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_market_job_config enable row level security;

drop policy if exists "social_market_job_config_no_client_access"
  on public.social_market_job_config;
create policy "social_market_job_config_no_client_access"
  on public.social_market_job_config for all
  to authenticated
  using (false)
  with check (false);

insert into public.social_market_job_config (job_name, auth_token)
values ('refresh-index-prices', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

create or replace function public.touch_social_market_job_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_social_market_job_config_updated_at on public.social_market_job_config;
create trigger trg_social_market_job_config_updated_at
before update on public.social_market_job_config
for each row execute function public.touch_social_market_job_config_updated_at();

revoke all on table public.social_market_job_config from public, anon, authenticated;

do $$
declare
  refresh_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-index-prices';
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'social-index-refresh-30s' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  select jobid into job_id from cron.job where jobname = 'social-index-refresh-eod' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'social-index-refresh-30s',
    '30 seconds',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-index-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-index-prices')
        ),
        body := '{"write_history":false}'::jsonb,
        timeout_milliseconds := 10000
      );
      $cmd$,
      refresh_url
    )
  );

  -- Post-close EOD snapshot.
  perform cron.schedule(
    'social-index-refresh-eod',
    '15 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-index-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-index-prices')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      refresh_url
    )
  );
end
$$;
