-- Parallel 15s NSE stock/ETF quote refresh via edge function.
-- GitHub Actions equity workflow stays active as backup until this path is proven.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.social_market_job_config (
  job_name text primary key,
  auth_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_market_job_config enable row level security;

insert into public.social_market_job_config (job_name, auth_token)
values ('refresh-equity-prices', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

revoke all on table public.social_market_job_config from public, anon, authenticated;

do $$
declare
  refresh_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-equity-prices';
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'social-equity-refresh-15s' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  select jobid into job_id from cron.job where jobname = 'social-equity-refresh-eod' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  -- Live LTP into social_market_assets (no history). Function no-ops outside cash session.
  perform cron.schedule(
    'social-equity-refresh-15s',
    '15 seconds',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-equity-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-equity-prices')
        ),
        body := '{"write_history":false}'::jsonb,
        timeout_milliseconds := 25000
      );
      $cmd$,
      refresh_url
    )
  );

  -- Post-close history stamp at 15:45 IST (10:15 UTC), Mon–Fri.
  perform cron.schedule(
    'social-equity-refresh-eod',
    '15 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-equity-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-equity-prices')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cmd$,
      refresh_url
    )
  );
end
$$;
