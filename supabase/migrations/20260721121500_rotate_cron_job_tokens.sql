-- Re-schedule pg_cron jobs after token rotation (20260721120000).
-- Tokens are read from social_market_job_config at job execution time.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  index_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-index-prices';
  equity_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-equity-prices';
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  names text[] := array[
    'social-index-refresh-30s',
    'social-index-refresh-eod',
    'social-equity-refresh-15s',
    'social-equity-refresh-eod',
    'social-gh-dispatch-equity-session',
    'social-gh-dispatch-equity-eod',
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod'
  ];
  n text;
begin
  foreach n in array names loop
    select jobid into job_id from cron.job where jobname = n limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

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
      index_url
    )
  );

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
      index_url
    )
  );

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
      equity_url
    )
  );

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
      equity_url
    )
  );

  perform cron.schedule(
    'social-gh-dispatch-equity-session',
    '0,15,30,45 4-10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"equity"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );

  perform cron.schedule(
    'social-gh-dispatch-equity-eod',
    '15 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"equity"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );

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
