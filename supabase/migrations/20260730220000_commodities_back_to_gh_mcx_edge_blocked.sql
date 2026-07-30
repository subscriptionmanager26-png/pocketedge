-- MCX blocks Supabase edge egress (403 on mcxindia.com). Keep commodities on GH.
-- Unschedule edge commodity writers; restore GH dispatch crons.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-commodity-refresh-hourly',
    'social-commodity-refresh-eod',
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  perform cron.schedule(
    'social-gh-dispatch-commodities-hourly',
    '0 4-18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"commodities"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );

  perform cron.schedule(
    'social-gh-dispatch-commodities-eod',
    '45 18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"commodities"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;
