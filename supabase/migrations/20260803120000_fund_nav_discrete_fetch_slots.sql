-- Retarget AMFI fund NAV edge fetches to discrete night + morning slots.
-- Replaces every-10-min evening polling (21:30–00:20 IST).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  funds_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-fund-navs';
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-fund-nav-refresh-evening',
    'social-fund-nav-refresh-0030',
    'social-fund-nav-refresh-2300',
    'social-fund-nav-refresh-2330',
    'social-fund-nav-refresh-0030-catchup',
    'social-fund-nav-refresh-1000',
    'social-fund-nav-refresh-1030'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- 23:00 IST = 17:00 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-2300',
    '0 17 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );

  -- 23:30 IST = 17:30 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-2330',
    '30 17 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );

  -- 00:30 IST = 19:00 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-0030-catchup',
    '0 19 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );

  -- 10:00 IST = 04:30 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-1000',
    '30 4 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );

  -- 10:30 IST = 05:00 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-1030',
    '0 5 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );
end
$$;
